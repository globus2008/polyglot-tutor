import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { resolveOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { VoiceLesson } from "./voice-lesson";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.lesson };
}

export default async function LessonPage({ params }: PageProps<"/[lang]/lesson/[language]">) {
  const t = await getDictionary();
  return (
    <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
      <LessonLoader params={params} />
    </Suspense>
  );
}

async function LessonLoader({ params }: Pick<PageProps<"/[lang]/lesson/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const [t, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  const supabase = await createClient();
  const [{ data: profile }, key] = await Promise.all([
    supabase.from("learner_profiles").select("language").eq("user_id", user.id).eq("language", language).maybeSingle(),
    resolveOpenAIKey(user.id),
  ]);
  if (!profile) redirect(localePath(locale, `/onboarding?language=${language}`));

  if (!key) {
    return (
      <Card title={t.lesson.missingKeyTitle}>
        <p className="text-sm text-muted-foreground">{t.lesson.missingKeyText}</p>
        <Link href={localePath(locale, "/settings")} className={`${buttonClass()} mt-3`}>
          {t.dashboard.enterKey}
        </Link>
      </Card>
    );
  }

  return <VoiceLesson language={language} languageName={t.languages[language]} flag={LANGUAGES[language].flag} />;
}
