"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import type { StoredAnalysis } from "@/lib/analysis";
import { useI18n } from "@/lib/i18n/client";

type Analysis = Partial<StoredAnalysis> & { error?: string; short?: boolean };
type LessonStatus = { status: string; analysis: Analysis | null };

const POLL_MS = 2500;
const POLL_LIMIT_MS = 120_000;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Waits for the post-lesson analysis and shows what the tutor will remember. */
export function LessonResult({ lessonId, durationS }: { lessonId: string; durationS: number | null }) {
  const { t, path } = useI18n();
  const [result, setResult] = useState<LessonStatus | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const ready = result?.status === "analyzed";
  const failed = Boolean(result?.analysis?.error) && result?.status === "finished";

  useEffect(() => {
    if (ready || failed) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}`);
        if (res.ok && !cancelled) {
          const data: LessonStatus = await res.json();
          setResult(data);
          if (data.status === "analyzed" || (data.status === "finished" && data.analysis?.error)) return;
        }
      } catch {
        // keep polling
      }
      if (cancelled) return;
      if (Date.now() - startedAt > POLL_LIMIT_MS) setTimedOut(true);
      else timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lessonId, ready, failed]);

  async function retry() {
    setRetrying(true);
    setTimedOut(false);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/analyze`, { method: "POST" });
      if (res.ok) setResult(await res.json());
    } finally {
      setRetrying(false);
    }
  }

  const analysis = result?.analysis;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div>
        <p className="font-medium">
          {t.result.saved}
          {durationS !== null && ` · ${formatTime(durationS)}`}
        </p>
        {!ready && !failed && !timedOut && (
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            {t.result.analyzing}
          </p>
        )}
        {(failed || timedOut) && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-danger">{failed ? t.result.failed : t.result.slow}</span>
            <button type="button" onClick={retry} disabled={retrying} className={buttonClass("secondary")}>
              {retrying ? t.result.retrying : t.result.retry}
            </button>
          </div>
        )}
      </div>

      {ready && analysis && (
        <div className="space-y-4 text-sm">
          {analysis.short && <p>{t.result.short}</p>}
          {analysis.feedback && <p>{analysis.feedback}</p>}
          {analysis.strengths && (
            <p>
              <span className="font-medium text-success">{t.result.strengths}</span>
              {analysis.strengths}
            </p>
          )}
          {analysis.next_focus && (
            <p>
              <span className="font-medium text-accent">{t.result.next}</span>
              {analysis.next_focus}
            </p>
          )}

          {!!analysis.mastered?.length && (
            <div>
              <p className="font-medium">{t.result.masteredTitle}</p>
              <p className="text-muted-foreground">{t.result.masteredText(analysis.mastered.join(", "))}</p>
            </div>
          )}

          {!!analysis.mistakes?.length && (
            <div>
              <p className="mb-2 font-medium">{t.result.watchOut}</p>
              <ul className="space-y-2">
                {analysis.mistakes.map((m) => (
                  <li key={m.pattern_key} className="rounded-xl bg-muted px-3 py-2">
                    <span className="text-danger line-through decoration-1">{m.original}</span>{" "}
                    → <span className="font-medium text-success">{m.corrected}</span>
                    {m.recurring && (
                      <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                        {t.result.recurring}
                      </span>
                    )}
                    <span className="block text-muted-foreground">{m.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!analysis.new_vocabulary?.length && (
            <div>
              <p className="mb-2 font-medium">{t.result.newWords}</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {analysis.new_vocabulary.map((v) => (
                  <li key={v.term}>
                    <span className="font-medium">{v.term}</span>{" "}
                    <span className="text-muted-foreground">– {v.translation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => window.location.reload()} className={buttonClass()}>
          {t.result.nextLesson}
        </button>
        <Link href={path("/")} className={buttonClass("secondary")}>
          {t.common.dashboard}
        </Link>
      </div>
    </div>
  );
}
