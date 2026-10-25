import { NextResponse, type NextRequest } from "next/server";
import { getRequestDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// Lesson status and analysis, polled by the lesson page while the analysis runs.
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/lessons/[id]">) {
  const { id } = await params;
  const [t, supabase] = await Promise.all([getRequestDictionary(), createClient()]);
  const { data: lesson } = await supabase.from("lessons").select("status, analysis, duration_s").eq("id", id).maybeSingle();
  if (!lesson) return NextResponse.json({ error: t.errors.lessonNotFound }, { status: 404 });
  return NextResponse.json(lesson);
}
