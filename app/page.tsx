import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, Card } from "@/components/ui";
import { resolveOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGES, type CefrLevel, type Language } from "@/lib/languages";
import { computeStreak, suggestLevel } from "@/lib/progress";
import { createClient } from "@/lib/supabase/server";
import { acceptLevel } from "./dashboard-actions";

export default function Home() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
      <Dashboard />
    </Suspense>
  );
}

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long" });

function plural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

async function Dashboard() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const now = new Date();
  const [{ data: profiles }, { data: lessons }, { data: vocab }, { data: mistakes }, key] = await Promise.all([
    supabase.from("learner_profiles").select("language, cefr_level").eq("user_id", user.id).order("created_at"),
    supabase
      .from("lessons")
      .select("language, status, duration_s, ended_at, summary_cs:analysis->>summary_cs, cefr_estimate:analysis->>cefr_estimate")
      .eq("user_id", user.id)
      .in("status", ["finished", "analyzing", "analyzed"])
      .order("started_at", { ascending: false })
      .limit(300),
    supabase.from("vocab_items").select("language, due, last_review:fsrs->>last_review").eq("user_id", user.id),
    supabase
      .from("mistakes")
      .select("language, corrected, occurrences, mastered_at")
      .eq("user_id", user.id)
      .order("occurrences", { ascending: false })
      .order("last_seen_at", { ascending: false }),
    resolveOpenAIKey(user.id),
  ]);

  if (!profiles?.length) redirect("/onboarding");

  const activity = [
    ...(lessons ?? []).map((l) => l.ended_at),
    ...(vocab ?? []).map((v) => v.last_review),
  ]
    .filter((d): d is string => Boolean(d))
    .map((d) => new Date(d));
  const streak = computeStreak(activity, now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vítejte zpět</h1>
        {streak > 0 && (
          <p className="text-sm">
            🔥 Série <strong>{streak}</strong> {plural(streak, "den", "dny", "dní")}
          </p>
        )}
      </div>

      {!key && (
        <Card className="border-accent/40">
          <p className="font-medium">Chybí OpenAI API klíč</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bez klíče nelze spustit hlasovou lekci. Zadejte vlastní, nebo se připojte k rodině, která klíč sdílí.
          </p>
          <Link href="/settings" className={`${buttonClass()} mt-3`}>
            Zadat klíč
          </Link>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {profiles
          .filter((p) => isLanguage(p.language))
          .map((p) => {
            const language = p.language as Language;
            const lang = LANGUAGES[language];
            const langLessons = (lessons ?? []).filter((l) => l.language === language);
            const langVocab = (vocab ?? []).filter((v) => v.language === language);
            const langMistakes = (mistakes ?? []).filter((m) => m.language === language);
            const open = langMistakes.filter((m) => !m.mastered_at);
            const due = langVocab.filter((v) => new Date(v.due) <= now).length;
            const minutes = Math.round(langLessons.reduce((sum, l) => sum + (l.duration_s ?? 0), 0) / 60);
            const last = langLessons.find((l) => l.summary_cs);
            const suggested = suggestLevel(
              langLessons.map((l) => l.cefr_estimate),
              p.cefr_level as CefrLevel,
            );

            return (
              <Card key={language}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>
                    {lang.flag}
                  </span>
                  <div>
                    <p className="font-semibold">{lang.name}</p>
                    <p className="text-sm text-muted-foreground">Úroveň {p.cefr_level}</p>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    [langLessons.length, plural(langLessons.length, "lekce", "lekce", "lekcí")],
                    [minutes, "minut"],
                    [langVocab.length, plural(langVocab.length, "slovíčko", "slovíčka", "slovíček")],
                    [langMistakes.length - open.length, "zvládnuto"],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="rounded-xl bg-muted px-1 py-2">
                      <dt className="sr-only">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                      <dd className="text-xs text-muted-foreground">{label}</dd>
                    </div>
                  ))}
                </dl>

                {suggested && (
                  <form action={acceptLevel} className="mt-4 rounded-xl border border-accent/40 p-3 text-sm">
                    <input type="hidden" name="language" value={language} />
                    <input type="hidden" name="level" value={suggested} />
                    <p>
                      Podle posledních lekcí odhaduje lektor vaši úroveň na <strong>{suggested}</strong>.
                    </p>
                    <SubmitButton variant="secondary" className="mt-2" pendingText="Měním…">
                      Změnit na {suggested}
                    </SubmitButton>
                  </form>
                )}

                {last?.summary_cs && (
                  <p className="mt-4 text-sm">
                    <span className="text-muted-foreground">
                      Minule{last.ended_at && ` (${dateFormat.format(new Date(last.ended_at))})`}:{" "}
                    </span>
                    {last.summary_cs}
                  </p>
                )}

                {open.length > 0 && (
                  <div className="mt-3 text-sm">
                    <p className="text-muted-foreground">Lektor hlídá:</p>
                    <ul className="mt-1 space-y-0.5">
                      {open.slice(0, 3).map((m) => (
                        <li key={m.corrected}>
                          {m.corrected}
                          {m.occurrences > 1 && <span className="text-muted-foreground"> · {m.occurrences}×</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/lesson/${language}`} className={`${buttonClass()} flex-1`}>
                    Začít lekci
                  </Link>
                  <Link href={`/review/${language}`} className={`${buttonClass("secondary")} flex-1`}>
                    Opakovat{due > 0 && ` (${due})`}
                  </Link>
                  {langLessons.length > 0 && (
                    <Link href={`/history/${language}`} className={buttonClass("secondary")}>
                      Historie
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
