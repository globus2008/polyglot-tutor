"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { deleteWord, rateWord } from "./actions";

type Word = { id: string; term: string; translation: string; example: string };
type Mistake = { id: string; original: string; corrected: string; explanation_cs: string; occurrences: number };
type Card = { kind: "word"; word: Word; retry: boolean } | { kind: "mistake"; mistake: Mistake };

// Values of ts-fsrs Rating, kept here so the client bundle doesn't pull in the scheduler.
const RATINGS = [
  { value: 1, label: "Nevěděl jsem", variant: "danger" },
  { value: 2, label: "Těžké", variant: "secondary" },
  { value: 3, label: "Věděl jsem", variant: "primary" },
  { value: 4, label: "Snadné", variant: "secondary" },
] as const;

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function ReviewSession({
  language,
  languageName,
  adverb,
  flag,
  speechLang,
  words,
  mistakes,
}: {
  language: string;
  languageName: string;
  adverb: string;
  flag: string;
  speechLang: string;
  words: Word[];
  mistakes: Mistake[];
}) {
  const [queue, setQueue] = useState<Card[]>(() => [
    ...words.map((word) => ({ kind: "word" as const, word, retry: false })),
    ...mistakes.map((mistake) => ({ kind: "mistake" as const, mistake })),
  ]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState({ known: 0, again: 0, mistakes: 0 });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const card = queue[0];
  const total = words.length + mistakes.length;
  const remaining = queue.length;

  function advance(requeue?: Card) {
    setRevealed(false);
    setQueue((q) => (requeue ? [...q.slice(1), requeue] : q.slice(1)));
  }

  function rate(rating: number) {
    if (card?.kind !== "word") return;
    const { word, retry } = card;
    setError(null);
    startTransition(async () => {
      // a word repeated within the session only counts once in the schedule
      if (!retry) {
        const result = await rateWord(word.id, rating);
        if ("error" in result) {
          setError(result.error);
          return;
        }
      }
      setDone((d) => (rating === 1 ? { ...d, again: d.again + 1 } : { ...d, known: d.known + (retry ? 0 : 1) }));
      advance(rating === 1 ? { kind: "word", word, retry: true } : undefined);
    });
  }

  function remove() {
    if (card?.kind !== "word") return;
    const { word } = card;
    startTransition(async () => {
      await deleteWord(word.id);
      advance();
    });
  }

  if (total === 0) {
    return (
      <div className="space-y-4">
        <Header flag={flag} languageName={languageName} />
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-medium">Dnes není co opakovat 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nová slovíčka přibývají z lekcí. Až přijde jejich čas, objeví se tu.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/lesson/${language}`} className={buttonClass()}>
              Začít lekci
            </Link>
            <Link href="/" className={buttonClass("secondary")}>
              Přehled
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="space-y-4">
        <Header flag={flag} languageName={languageName} />
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-medium">Hotovo!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {words.length > 0 && `Slovíčka: ${done.known} z ${words.length} jste věděl napoprvé. `}
            {mistakes.length > 0 && `Prošli jste ${mistakes.length} častých chyb.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/lesson/${language}`} className={buttonClass()}>
              Začít lekci
            </Link>
            <Link href="/" className={buttonClass("secondary")}>
              Přehled
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header flag={flag} languageName={languageName} />
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${Math.round(((total - Math.min(remaining, total)) / total) * 100)}%` }}
        />
      </div>

      {card.kind === "word" ? (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {card.retry ? "Ještě jednou" : `Jak se řekne ${adverb}?`}
          </p>
          <p className="text-2xl font-semibold">{card.word.translation}</p>
          {revealed ? (
            <>
              <div className="space-y-2">
                <p className="text-2xl font-semibold text-accent">{card.word.term}</p>
                {card.word.example && <p className="text-muted-foreground italic">{card.word.example}</p>}
                <button
                  type="button"
                  onClick={() => speak(`${card.word.term}. ${card.word.example}`, speechLang)}
                  className="text-sm text-accent underline"
                >
                  Přehrát výslovnost
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    disabled={pending}
                    onClick={() => rate(r.value)}
                    className={buttonClass(r.variant)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {!card.retry && (
                <button type="button" onClick={remove} disabled={pending} className="text-xs text-muted-foreground underline">
                  Tohle slovíčko neopakovat
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRevealed(true);
                speak(card.word.term, speechLang);
              }}
              className={`${buttonClass()} w-full`}
            >
              Ukázat odpověď
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Opravte větu{card.mistake.occurrences > 1 && ` · chyba se opakovala ${card.mistake.occurrences}×`}
          </p>
          <p className="text-xl text-danger">{card.mistake.original}</p>
          {revealed ? (
            <>
              <div className="space-y-2">
                <p className="text-xl font-semibold text-success">{card.mistake.corrected}</p>
                <p className="text-sm text-muted-foreground">{card.mistake.explanation_cs}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDone((d) => ({ ...d, mistakes: d.mistakes + 1 }));
                  advance();
                }}
                className={`${buttonClass()} w-full`}
              >
                Další
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRevealed(true);
                speak(card.mistake.corrected, speechLang);
              }}
              className={`${buttonClass()} w-full`}
            >
              Ukázat správně
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">Zbývá {remaining}</p>
    </div>
  );
}

function Header({ flag, languageName }: { flag: string; languageName: string }) {
  return (
    <h1 className="text-xl font-semibold tracking-tight">
      <span aria-hidden className="mr-2">
        {flag}
      </span>
      Opakování · {languageName}
    </h1>
  );
}
