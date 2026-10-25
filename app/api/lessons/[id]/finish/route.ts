import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { analyzeLesson } from "@/lib/analysis";
import { getRequestDictionary } from "@/lib/i18n/server";
import { localDay } from "@/lib/progress";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { MAX_LESSON_MINUTES } from "@/lib/tutor-prompt";

// leaves room for the post-lesson analysis that runs after the response
export const maxDuration = 120;

const bodySchema = z.object({
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(5000) }))
    .max(500),
  corrections: z
    .array(
      z.object({
        original: z.string().max(500),
        corrected: z.string().max(500),
        category: z.string().max(40),
        explanation: z.string().max(500),
      }),
    )
    .max(100),
  status: z.enum(["finished", "failed"]),
});

// Saves the transcript and corrections of a lesson and books the audio time.
export async function POST(request: NextRequest, { params }: RouteContext<"/api/lessons/[id]/finish">) {
  const { id } = await params;
  const [t, supabase] = await Promise.all([getRequestDictionary(), createClient()]);
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: t.errors.notSignedIn }, { status: 401 });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: t.errors.badRequest }, { status: 400 });

  const { data: lesson } = await supabase
    .from("lessons")
    .select("started_at, status, plan")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!lesson) return NextResponse.json({ error: t.errors.lessonNotFound }, { status: 404 });
  if (lesson.status !== "active") return NextResponse.json({ ok: true });

  // duration comes from the server clock, not the client, capped at the lesson's allowance
  const plan = lesson.plan as { keySource?: string; householdId?: string; maxMinutes?: number };
  const endedAt = new Date();
  const durationS = Math.min(
    Math.round((endedAt.getTime() - new Date(lesson.started_at).getTime()) / 1000),
    ((plan.maxMinutes ?? MAX_LESSON_MINUTES) + 1) * 60,
  );

  const { error } = await supabase
    .from("lessons")
    .update({
      status: body.data.status,
      transcript: body.data.transcript,
      corrections: body.data.corrections,
      ended_at: endedAt.toISOString(),
      duration_s: durationS,
    })
    .eq("id", id)
    .eq("status", "active");
  if (error) return NextResponse.json({ error: t.errors.lessonSaveFailed }, { status: 500 });

  await createAdminClient().rpc("add_usage", {
    p_user_id: userId,
    p_day: localDay(endedAt),
    p_seconds: durationS,
    ...(plan.keySource === "household" && plan.householdId ? { p_household_id: plan.householdId } : {}),
  });

  if (body.data.status === "finished") after(() => analyzeLesson(id));

  return NextResponse.json({ ok: true, durationS });
}
