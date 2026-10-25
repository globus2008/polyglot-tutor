import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { ReviewSession } from "./review-session";

export const metadata: Metadata = { title: "Opakování – Polyglot Tutor" };

const SESSION_WORDS = 30;
const SESSION_MISTAKES = 8;

export default function ReviewPage({ params }: PageProps<"/review/[language]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
      <ReviewLoader params={params} />
    </Suspense>
  );
}

async function ReviewLoader({ params }: Pick<PageProps<"/review/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: words }, { data: mistakes }] = await Promise.all([
    supabase
      .from("vocab_items")
      .select("id, term, translation, example")
      .eq("user_id", user.id)
      .eq("language", language)
      .lte("due", new Date().toISOString())
      .order("due")
      .limit(SESSION_WORDS),
    supabase
      .from("mistakes")
      .select("id, original, corrected, explanation_cs, occurrences")
      .eq("user_id", user.id)
      .eq("language", language)
      .is("mastered_at", null)
      .order("occurrences", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(SESSION_MISTAKES),
  ]);

  const lang = LANGUAGES[language];
  return (
    <ReviewSession
      language={language}
      languageName={lang.name}
      adverb={lang.adverb}
      flag={lang.flag}
      speechLang={lang.speech}
      words={words ?? []}
      mistakes={mistakes ?? []}
    />
  );
}
