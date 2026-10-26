import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { analyzeLesson } from "@/lib/analysis";
import { getRequestDictionary } from "@/lib/i18n/server";
import { bookUsage, lessonDuration, type StoredLessonPlan } from "@/lib/lessons";
import { createClient } from "@/lib/supabase/server";

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
  // "active": a progress save during the lesson
  status: z.enum(["finished", "failed", "active"]),
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

  const endedAt = new Date();
  const { transcript, corrections, status } = body.data;

  // ended_at of an active lesson is the last progress save, used if the finish never arrives
  if (status === "active") {
    await supabase
      .from("lessons")
      .update({ transcript, corrections, ended_at: endedAt.toISOString() })
      .eq("id", id)
      .eq("status", "active");
    return NextResponse.json({ ok: true });
  }

  const plan = lesson.plan as StoredLessonPlan;
  const durationS = lessonDuration(lesson.started_at, endedAt, plan);

  const { data: closed, error } = await supabase
    .from("lessons")
    .update({ status, transcript, corrections, ended_at: endedAt.toISOString(), duration_s: durationS })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (error) return NextResponse.json({ error: t.errors.lessonSaveFailed }, { status: 500 });
  // a parallel request (beacon and button at once) already closed it – book the time only once
  if (!closed?.length) return NextResponse.json({ ok: true, durationS });

  await bookUsage(userId, endedAt, durationS, plan);

  if (status === "finished") after(() => analyzeLesson(id));

  return NextResponse.json({ ok: true, durationS });
}
