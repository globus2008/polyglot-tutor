import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveOpenAIKey } from "@/lib/api-keys";
import { getHouseholdAllowance } from "@/lib/households";
import { closeAbandonedLessons } from "@/lib/lessons";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import type { TurnMode, TutorInitiative } from "@/lib/conversation-style";
import { LANGUAGE_CODES, type CefrLevel } from "@/lib/languages";
import { planLesson, type LessonPlan } from "@/lib/planner";
import { createRealtimeClientSecret, describeOpenAIError, OpenAIError } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/server";
import { getNativeLanguage } from "@/lib/user-settings";
import {
  buildRealtimeSession,
  buildTutorInstructions,
  isRealtimeModel,
  LESSON_MODES,
  MAX_LESSON_MINUTES,
  type TutorProfile,
} from "@/lib/tutor-prompt";
import { allowedLessonMinutes } from "@/lib/usage";

// leaves room for analysing abandoned lessons after the response
export const maxDuration = 120;

const bodySchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  model: z.string().refine(isRealtimeModel),
  mode: z.enum(LESSON_MODES).default("conversation"),
});

const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

// Starts a voice lesson: records it and returns an ephemeral Realtime token carrying the tutor setup.
export async function POST(request: NextRequest) {
  const [t, locale, supabase] = await Promise.all([getRequestDictionary(), getRequestLocale(), createClient()]);
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return fail(401, t.errors.notSignedIn);

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, t.errors.badRequest);
  const { language, model, mode } = body.data;
  if (!isRealtimeModel(model)) return fail(400, t.errors.badRequest);

  const [{ data: profile }, { data: recent }, { data: topics }, { data: mistakes }, { data: vocab }, key, nativeLang] =
    await Promise.all([
      supabase.from("learner_profiles").select("*").eq("user_id", userId).eq("language", language).maybeSingle(),
      supabase
        .from("lessons")
        .select("topic_id, summary, plan")
        .eq("user_id", userId)
        .eq("language", language)
        .in("status", ["finished", "analyzing", "analyzed"])
        .order("started_at", { ascending: false })
        .limit(20),
      supabase.from("topics").select("id, cefr_level, title, title_cs, scenario, tags").eq("language", language),
      supabase
        .from("mistakes")
        .select("id, pattern_key, original, corrected, explanation, occurrences")
        .eq("user_id", userId)
        .eq("language", language)
        .is("mastered_at", null)
        .order("occurrences", { ascending: false })
        .order("last_seen_at", { ascending: false })
        .limit(10),
      supabase
        .from("vocab_items")
        .select("id, term, translation")
        .eq("user_id", userId)
        .eq("language", language)
        .lte("due", new Date().toISOString())
        .order("due")
        .limit(10),
      resolveOpenAIKey(userId),
      getNativeLanguage(supabase, userId, locale),
    ]);
  if (!profile) return fail(404, t.errors.profileFirst);

  // lessons whose finish never arrived (crash, lost connection) must not block or skew history
  await closeAbandonedLessons(supabase, userId);
  if (!key) return fail(402, t.errors.missingKey);

  // the household key is shared money: each member has a daily allowance
  let maxMinutes = MAX_LESSON_MINUTES;
  if (key.source === "household") {
    const { limitMinutes, usedSeconds } = await getHouseholdAllowance(userId, key.householdId);
    maxMinutes = allowedLessonMinutes(limitMinutes, usedSeconds, MAX_LESSON_MINUTES);
    if (maxMinutes === 0) {
      return fail(429, t.errors.limitReached(limitMinutes));
    }
  }

  const tutorProfile: TutorProfile = {
    ...profile,
    language,
    cefr_level: profile.cefr_level as CefrLevel,
    native_lang: nativeLang,
    tutor_initiative: profile.tutor_initiative as TutorInitiative,
    turn_mode: profile.turn_mode as TurnMode,
  };
  const plan = planLesson({
    language,
    level: tutorProfile.cefr_level,
    interests: profile.interests,
    topics: topics ?? [],
    recentLessons: (recent ?? []).map((l) => ({
      topic_id: l.topic_id,
      summary: l.summary,
      grammar: (l.plan as { lesson?: LessonPlan }).lesson?.grammar ?? null,
    })),
    openMistakes: mistakes ?? [],
    dueVocab: vocab ?? [],
  });
  const instructions = buildTutorInstructions(tutorProfile, { plan, maxMinutes, mode });
  const session = buildRealtimeSession(tutorProfile, model, instructions);

  let secret;
  try {
    secret = await createRealtimeClientSecret(key.key, userId, session);
  } catch (error) {
    if (error instanceof OpenAIError) return fail(502, t.errors.openai[describeOpenAIError(error)]);
    throw error;
  }

  const { data: lesson, error } = await supabase
    .from("lessons")
    .insert({
      user_id: userId,
      language,
      model,
      topic_id: plan.topic?.id ?? null,
      plan: {
        lesson: plan,
        mode,
        maxMinutes,
        instructions,
        keySource: key.source,
        householdId: key.source === "household" ? key.householdId : null,
      },
    })
    .select("id")
    .single();
  if (error) return fail(500, t.errors.lessonCreateFailed);

  return NextResponse.json({
    lessonId: lesson.id,
    clientSecret: secret.value,
    model,
    turnMode: tutorProfile.turn_mode,
    idlePromptS: tutorProfile.idle_prompt_s,
    maxMinutes,
    topic:
      mode === "grammar"
        ? plan.grammar
        : plan.topic
          ? locale === "cs"
            ? plan.topic.title_cs
            : plan.topic.title
          : null,
  });
}
