import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, Card } from "@/components/ui";
import { getKeyInfo } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGE_CODES, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { removeApiKey } from "./actions";
import { ApiKeyForm } from "./api-key-form";

export const metadata: Metadata = { title: "Nastavení – Polyglot Tutor" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nastavení</h1>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" });

async function SettingsContent() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [keyInfo, { data: profiles }] = await Promise.all([
    getKeyInfo({ kind: "user", id: user.id }),
    supabase.from("learner_profiles").select("language, cefr_level, interests").eq("user_id", user.id).order("language"),
  ]);
  const missingLanguages = LANGUAGE_CODES.filter((l) => !profiles?.some((p) => p.language === l));

  return (
    <>
      <Card title="OpenAI API klíč">
        <p className="mb-4 text-sm text-muted-foreground">
          Hlasové lekce běží přes OpenAI Realtime API na váš účet. Klíč vytvoříte na{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent underline">
            platform.openai.com/api-keys
          </a>
          . Ukládáme ho šifrovaně a do prohlížeče se už nikdy nevrací.
        </p>
        {keyInfo && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <span className="text-sm">
              Uložený klíč <code className="font-mono">sk-…{keyInfo.last4}</code>, změněn{" "}
              {dateFormat.format(new Date(keyInfo.updatedAt))}
            </span>
            <form action={removeApiKey}>
              <SubmitButton variant="danger" pendingText="Mažu…">
                Smazat
              </SubmitButton>
            </form>
          </div>
        )}
        <ApiKeyForm hasKey={Boolean(keyInfo)} />
      </Card>

      <Card title="Jazykové profily">
        <ul className="divide-y divide-line">
          {profiles?.filter((p) => isLanguage(p.language)).map((p) => (
            <li key={p.language} className="flex items-center justify-between gap-3 py-3">
              <span>
                <span className="mr-2" aria-hidden>
                  {LANGUAGES[p.language as keyof typeof LANGUAGES].flag}
                </span>
                {LANGUAGES[p.language as keyof typeof LANGUAGES].name} · {p.cefr_level}
                {p.interests.length > 0 && (
                  <span className="block text-sm text-muted-foreground">{p.interests.join(", ")}</span>
                )}
              </span>
              <Link href={`/onboarding?lang=${p.language}`} className={buttonClass("secondary")}>
                Upravit
              </Link>
            </li>
          ))}
        </ul>
        {missingLanguages.length > 0 && (
          <Link href={`/onboarding?lang=${missingLanguages[0]}`} className={`${buttonClass("secondary")} mt-3`}>
            Přidat jazyk
          </Link>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">Přihlášen jako {user.email}</p>
    </>
  );
}
