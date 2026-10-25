import { NextResponse } from "next/server";
import { getKeyInfo } from "@/lib/api-keys";
import { getRequestDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// GDPR data export: everything stored about the signed-in user, as one JSON file.
export async function GET() {
  const [t, supabase] = await Promise.all([getRequestDictionary(), createClient()]);
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: t.errors.notSignedIn }, { status: 401 });

  // RLS limits every query to the caller's own rows
  const [settings, profiles, lessons, mistakes, vocabulary, usage, membership, apiKey] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("learner_profiles").select("*").eq("user_id", userId),
    supabase.from("lessons").select("*").eq("user_id", userId).order("started_at"),
    supabase.from("mistakes").select("*").eq("user_id", userId),
    supabase.from("vocab_items").select("*").eq("user_id", userId),
    supabase.from("usage_daily").select("*").eq("user_id", userId).order("day"),
    supabase.from("household_members").select("role, daily_minutes_limit, joined_at, households(name)").eq("user_id", userId),
    getKeyInfo({ kind: "user", id: userId }),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: userId, email: auth.claims.email ?? null },
    // the key itself stays encrypted on the server
    openai_api_key: apiKey ? { last4: apiKey.last4, updated_at: apiKey.updatedAt } : null,
    settings: settings.data,
    learner_profiles: profiles.data ?? [],
    lessons: lessons.data ?? [],
    mistakes: mistakes.data ?? [],
    vocabulary: vocabulary.data ?? [],
    usage_daily: usage.data ?? [],
    household: membership.data ?? [],
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="polyglot-tutor-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
