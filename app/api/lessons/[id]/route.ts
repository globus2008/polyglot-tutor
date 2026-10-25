import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Lesson status and analysis, polled by the lesson page while the analysis runs.
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/lessons/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("status, analysis, duration_s").eq("id", id).maybeSingle();
  if (!lesson) return NextResponse.json({ error: "Lekce nenalezena." }, { status: 404 });
  return NextResponse.json(lesson);
}
