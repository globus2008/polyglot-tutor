import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui";
import type { StoredAnalysis } from "@/lib/analysis";
import { getCurrentUser } from "@/lib/auth";
import { INTL_LOCALE, localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.history };
}

export default async function HistoryPage({ params }: PageProps<"/[lang]/history/[language]">) {
  const t = await getDictionary();
  return (
    <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
      <HistoryLoader params={params} />
    </Suspense>
  );
}

async function HistoryLoader({ params }: Pick<PageProps<"/[lang]/history/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const [t, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, started_at, duration_s, status, transcript, analysis, topics(title, title_cs)")
    .eq("user_id", user.id)
    .eq("language", language)
    .in("status", ["finished", "analyzing", "analyzed"])
    .order("started_at", { ascending: false })
    .limit(50);

  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">
        <span aria-hidden className="mr-2">
          {LANGUAGES[language].flag}
        </span>
        {t.history.title(t.languages[language])}
      </h1>

      {!lessons?.length && <p className="text-muted-foreground">{t.history.empty}</p>}

      <ul className="space-y-3">
        {lessons?.map((lesson) => {
          const analysis = lesson.analysis as Partial<StoredAnalysis> | null;
          const transcript = (lesson.transcript as { role: string; text: string }[]) ?? [];
          const topic = lesson.topics ? (locale === "cs" ? lesson.topics.title_cs : lesson.topics.title) : null;
          return (
            <li key={lesson.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{topic ?? t.history.freeConversation}</p>
                <p className="text-sm text-muted-foreground">
                  {dateFormat.format(new Date(lesson.started_at))}
                  {lesson.duration_s ? ` · ${t.common.minutesShort(Math.max(1, Math.round(lesson.duration_s / 60)))}` : ""}
                </p>
              </div>
              {analysis?.feedback && <p className="mt-2 text-sm">{analysis.feedback}</p>}

              {(!!analysis?.mistakes?.length || !!analysis?.new_vocabulary?.length || transcript.length > 0) && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-accent">{t.history.details}</summary>
                  <div className="mt-3 space-y-4">
                    {!!analysis?.mistakes?.length && (
                      <div>
                        <p className="mb-1 font-medium">{t.history.mistakes}</p>
                        <ul className="space-y-1">
                          {analysis.mistakes.map((m) => (
                            <li key={m.pattern_key}>
                              <span className="text-danger line-through decoration-1">{m.original}</span> →{" "}
                              <span className="text-success">{m.corrected}</span>
                              <span className="block text-muted-foreground">{m.explanation}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!analysis?.new_vocabulary?.length && (
                      <div>
                        <p className="mb-1 font-medium">{t.history.newWords}</p>
                        <p>{analysis.new_vocabulary.map((v) => `${v.term} – ${v.translation}`).join(" · ")}</p>
                      </div>
                    )}
                    {transcript.length > 0 && (
                      <div>
                        <p className="mb-1 font-medium">{t.history.transcript}</p>
                        <div className="space-y-1">
                          {transcript.map((line, i) => (
                            <p key={i}>
                              <span className="font-medium">{line.role === "user" ? t.history.you : t.history.tutor}:</span>{" "}
                              {line.text}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <Link href={localePath(locale, "/")} className={buttonClass("secondary")}>
        {t.common.backToDashboard}
      </Link>
    </div>
  );
}
