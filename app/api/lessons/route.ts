import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveOpenAIKey } from "@/lib/api-keys";
import type { TurnMode, TutorInitiative } from "@/lib/conversation-style";
import { LANGUAGE_CODES, type CefrLevel } from "@/lib/languages";
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

  const [{ data: profile }, { data: recent }, key] = await Promise.all([
    supabase.from("learner_profiles").select("*").eq("user_id", userId).eq("language", language).maybeSingle(),
    supabase
      .from("lessons")
      .select("summary, plan")
      .eq("user_id", userId)
      .eq("language", language)
      .neq("status", "active")
      .order("started_at", { ascending: false })
      .limit(8),
    resolveOpenAIKey(userId),
  ]);
  if (!profile) return fail(404, "Nejdřív si vyplňte profil pro tento jazyk.");
  if (!key) return fail(402, "Chybí OpenAI API klíč. Zadejte ho v Nastavení.");

  const tutorProfile: TutorProfile = {
    ...profile,
    language,
    cefr_level: profile.cefr_level as CefrLevel,
    tutor_initiative: profile.tutor_initiative as TutorInitiative,
    turn_mode: profile.turn_mode as TurnMode,
  };
  const recentTopics = (recent ?? []).map((l) => l.summary).filter((s): s is string => Boolean(s));
  const instructions = buildTutorInstructions(tutorProfile, { recentTopics, maxMinutes: MAX_LESSON_MINUTES });
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
    .insert({ user_id: userId, language, model, plan: {
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
  });
}
