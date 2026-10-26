import "server-only";
import { after } from "next/server";
import { analyzeLesson } from "./analysis";
import { localDay } from "./progress";
import { createAdminClient, type createClient } from "./supabase/server";
import { MAX_LESSON_MINUTES } from "./tutor-prompt";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type StoredLessonPlan = { keySource?: string; householdId?: string | null; maxMinutes?: number };

/** Lesson length from the server clock, capped at the lesson's allowance (plus a minute of wrap-up). */
export function lessonDuration(startedAt: string, endedAt: Date, plan: StoredLessonPlan): number {
  return Math.max(
    0,
    Math.min(
      Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000),
      ((plan.maxMinutes ?? MAX_LESSON_MINUTES) + 1) * 60,
    ),
  );
}

/** Books the audio time of a lesson on the learner's daily usage (and the household's, if its key paid). */
export async function bookUsage(userId: string, endedAt: Date, durationS: number, plan: StoredLessonPlan) {
  await createAdminClient().rpc("add_usage", {
    p_user_id: userId,
    p_day: localDay(endedAt),
    p_seconds: durationS,
    ...(plan.keySource === "household" && plan.householdId ? { p_household_id: plan.householdId } : {}),
  });
}

/**
 * Closes lessons whose finish never arrived (phone killed the page, lost connection). Those
 * with a saved transcript count up to the last progress save; the rest are marked failed.
 */
export async function closeAbandonedLessons(supabase: Supabase, userId: string) {
  const { data: stale } = await supabase
    .from("lessons")
    .select("id, started_at, ended_at, plan, transcript")
    .eq("user_id", userId)
    .eq("status", "active")
    .lt("started_at", new Date(Date.now() - (MAX_LESSON_MINUTES + 5) * 60_000).toISOString());

  for (const lesson of stale ?? []) {
    const plan = lesson.plan as StoredLessonPlan;
    const saved = Array.isArray(lesson.transcript) && lesson.transcript.length > 0 && lesson.ended_at;
    if (!saved) {
      await supabase.from("lessons").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", lesson.id);
      continue;
    }
    const endedAt = new Date(lesson.ended_at!);
    const durationS = lessonDuration(lesson.started_at, endedAt, plan);
    const { data: closed } = await supabase
      .from("lessons")
      .update({ status: "finished", duration_s: durationS })
      .eq("id", lesson.id)
      .eq("status", "active")
      .select("id");
    if (!closed?.length) continue;
    await bookUsage(userId, endedAt, durationS, plan);
    after(() => analyzeLesson(lesson.id));
  }
}
