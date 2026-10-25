import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveOpenAIKey } from "@/lib/api-keys";
import type { TurnMode, TutorInitiative } from "@/lib/conversation-style";
import { LANGUAGE_CODES, type CefrLevel } from "@/lib/languages";
import { planLesson, type LessonPlan } from "@/lib/planner";
import { createRealtimeClientSecret, describeOpenAIError, OpenAIError } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/server";
import {
  buildRealtimeSession,
  buildTutorInstructions,
  isRealtimeModel,
  MAX_LESSON_MINUTES,
  type TutorProfile,
} from "@/lib/tutor-prompt";

const bodySchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  model: z.string().refine(isRealtimeModel),
});

const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

// Starts a voice lesson: records it and returns an ephemeral Realtime token carrying the tutor setup.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return fail(401, "Nejste přihlášeni.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "Neplatný požadavek.");
  const { language, model } = body.data;
  if (!isRealtimeModel(model)) return fail(400, "Neplatný model.");

  const [{ data: profile }, { data: recent }, { data: topics }, { data: mistakes }, { data: vocab }, key] =
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
        .select("id, pattern_key, original, corrected, explanation_cs, occurrences")
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
    ]);
  if (!profile) return fail(404, "Nejdřív si vyplňte profil pro tento jazyk.");

  // lessons whose finish never arrived (crash, lost connection) must not block or skew history
  await supabase
    .from("lessons")
    .update({ status: "failed", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("started_at", new Date(Date.now() - (MAX_LESSON_MINUTES + 5) * 60_000).toISOString());
  if (!key) return fail(402, "Chybí OpenAI API klíč. Zadejte ho v Nastavení.");

  const tutorProfile: TutorProfile = {
    ...profile,
    language,
    cefr_level: profile.cefr_level as CefrLevel,
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
  const instructions = buildTutorInstructions(tutorProfile, { plan, maxMinutes: MAX_LESSON_MINUTES });
  const session = buildRealtimeSession(tutorProfile, model, instructions);

  let secret;
  try {
    secret = await createRealtimeClientSecret(key.key, userId, session);
  } catch (error) {
    if (error instanceof OpenAIError) return fail(502, describeOpenAIError(error));
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
        instructions,
        keySource: key.source,
        householdId: key.source === "household" ? key.householdId : null,
      },
    })
    .select("id")
    .single();
  if (error) return fail(500, "Lekci se nepodařilo založit.");

  return NextResponse.json({
    lessonId: lesson.id,
    clientSecret: secret.value,
    model,
    turnMode: tutorProfile.turn_mode,
    idlePromptS: tutorProfile.idle_prompt_s,
    maxMinutes: MAX_LESSON_MINUTES,
    topicCs: plan.topic?.title_cs ?? null,
  });
}
