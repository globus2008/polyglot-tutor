import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { resolveOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { VoiceLesson } from "./voice-lesson";

export const metadata: Metadata = { title: "Lekce – Polyglot Tutor" };

export default function LessonPage({ params }: PageProps<"/lesson/[language]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
      <LessonLoader params={params} />
    </Suspense>
  );
}

async function LessonLoader({ params }: Pick<PageProps<"/lesson/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profile }, key] = await Promise.all([
    supabase.from("learner_profiles").select("language").eq("user_id", user.id).eq("language", language).maybeSingle(),
    resolveOpenAIKey(user.id),
  ]);
  if (!profile) redirect(`/onboarding?lang=${language}`);

  if (!key) {
    return (
      <Card title="Chybí OpenAI API klíč">
        <p className="text-sm text-muted-foreground">Hlasová lekce běží přes OpenAI, bez klíče ji nelze spustit.</p>
        <Link href="/settings" className={`${buttonClass()} mt-3`}>
          Zadat klíč
        </Link>
      </Card>
    );
  }

  const lang = LANGUAGES[language];
  return <VoiceLesson language={language} languageName={lang.name} flag={lang.flag} />;
}
