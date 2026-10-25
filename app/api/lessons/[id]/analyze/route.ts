import { NextResponse, type NextRequest } from "next/server";
import { analyzeLesson } from "@/lib/analysis";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

// Retries the analysis of a finished lesson after a failure.
export async function POST(_request: NextRequest, { params }: RouteContext<"/api/lessons/[id]/analyze">) {
  const { id } = await params;
  const supabase = await createClient();
  // RLS limits this to the caller's own lessons
  const { data: lesson } = await supabase.from("lessons").select("status").eq("id", id).maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lekce nenalezena." }, { status: 404 });

  if (lesson.status === "finished") await analyzeLesson(id);
  const { data } = await supabase.from("lessons").select("status, analysis").eq("id", id).single();
  return NextResponse.json(data);
}
