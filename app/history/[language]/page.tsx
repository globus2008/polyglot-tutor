import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui";
import type { StoredAnalysis } from "@/lib/analysis";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Historie lekcí – Polyglot Tutor" };

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Prague" });

export default function HistoryPage({ params }: PageProps<"/history/[language]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
      <HistoryLoader params={params} />
    </Suspense>
  );
}

async function HistoryLoader({ params }: Pick<PageProps<"/history/[language]">, "params">) {
  const { language } = await params;
  if (!isLanguage(language)) notFound();

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, started_at, duration_s, status, transcript, analysis, topics(title_cs)")
    .eq("user_id", user.id)
    .eq("language", language)
    .in("status", ["finished", "analyzing", "analyzed"])
    .order("started_at", { ascending: false })
    .limit(50);

  const lang = LANGUAGES[language];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">
        <span aria-hidden className="mr-2">
          {lang.flag}
        </span>
        Historie · {lang.name}
      </h1>

      {!lessons?.length && <p className="text-muted-foreground">Zatím žádné lekce.</p>}

      <ul className="space-y-3">
        {lessons?.map((lesson) => {
          const analysis = lesson.analysis as Partial<StoredAnalysis> | null;
          const transcript = (lesson.transcript as { role: string; text: string }[]) ?? [];
          return (
            <li key={lesson.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{lesson.topics?.title_cs ?? "Volná konverzace"}</p>
                <p className="text-sm text-muted-foreground">
                  {dateFormat.format(new Date(lesson.started_at))}
                  {lesson.duration_s ? ` · ${Math.max(1, Math.round(lesson.duration_s / 60))} min` : ""}
                </p>
              </div>
              {analysis?.summary_cs && <p className="mt-2 text-sm">{analysis.summary_cs}</p>}

              {(!!analysis?.mistakes?.length || !!analysis?.new_vocabulary?.length || transcript.length > 0) && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-accent">Podrobnosti</summary>
                  <div className="mt-3 space-y-4">
                    {!!analysis?.mistakes?.length && (
                      <div>
                        <p className="mb-1 font-medium">Chyby</p>
                        <ul className="space-y-1">
                          {analysis.mistakes.map((m) => (
                            <li key={m.pattern_key}>
                              <span className="text-danger line-through decoration-1">{m.original}</span> →{" "}
                              <span className="text-success">{m.corrected}</span>
                              <span className="block text-muted-foreground">{m.explanation_cs}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!analysis?.new_vocabulary?.length && (
                      <div>
                        <p className="mb-1 font-medium">Nová slovíčka</p>
                        <p>{analysis.new_vocabulary.map((v) => `${v.term} – ${v.translation_cs}`).join(" · ")}</p>
                      </div>
                    )}
                    {transcript.length > 0 && (
                      <div>
                        <p className="mb-1 font-medium">Přepis</p>
                        <div className="space-y-1">
                          {transcript.map((line, i) => (
                            <p key={i}>
                              <span className="font-medium">{line.role === "user" ? "Vy" : "Lektor"}:</span> {line.text}
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

      <Link href="/" className={buttonClass("secondary")}>
        Zpět na přehled
      </Link>
    </div>
  );
}
