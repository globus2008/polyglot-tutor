import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { localizeReviewItems } from "@/lib/localize";
import { createClient } from "@/lib/supabase/server";
import { getNativeLanguage } from "@/lib/user-settings";
import { ReviewSession } from "./review-session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.review };
}

const SESSION_WORDS = 30;
const SESSION_MISTAKES = 8;

export default async function ReviewPage({ params }: PageProps<"/[lang]/review/[language]">) {
  const t = await getDictionary();
  return (
    <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
      <ReviewLoader params={params} />
    </Suspense>
  );
}

async function ReviewLoader({ params }: Pick<PageProps<"/[lang]/review/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const supabase = await createClient();
  const [{ data: words }, { data: mistakes }, native] = await Promise.all([
    supabase
      .from("vocab_items")
      .select("id, term, translation, example, translation_lang")
      .eq("user_id", user.id)
      .eq("language", language)
      .lte("due", new Date().toISOString())
      .order("due")
      .limit(SESSION_WORDS),
    supabase
      .from("mistakes")
      .select("id, original, corrected, explanation, explanation_lang, occurrences")
      .eq("user_id", user.id)
      .eq("language", language)
      .is("mastered_at", null)
      .order("occurrences", { ascending: false })
      .order("last_seen_at", { ascending: false })
      .limit(SESSION_MISTAKES),
    getNativeLanguage(supabase, user.id, locale),
  ]);
  // items from before a change of native language get translated once
  const localized = await localizeReviewItems(user.id, language, native, words ?? [], mistakes ?? []);

  return (
    <ReviewSession
      language={language}
      flag={LANGUAGES[language].flag}
      speechLang={LANGUAGES[language].speech}
      words={localized.words}
      mistakes={localized.mistakes}
    />
  );
}
