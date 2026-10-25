import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ApiKeyForm } from "@/components/api-key-form";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, Card } from "@/components/ui";
import { getKeyInfo, resolveOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { INTL_LOCALE, localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLanguage, LANGUAGE_CODES, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { removeApiKey, saveApiKey } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.settings };
}

export default async function SettingsPage() {
  const t = await getDictionary();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>
      <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const [t, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  const supabase = await createClient();
  const [keyInfo, resolved, { data: profiles }] = await Promise.all([
    getKeyInfo({ kind: "user", id: user.id }),
    resolveOpenAIKey(user.id),
    supabase.from("learner_profiles").select("language, cefr_level, interests").eq("user_id", user.id).order("language"),
  ]);
  const missingLanguages = LANGUAGE_CODES.filter((l) => !profiles?.some((p) => p.language === l));
  const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: "medium" });
  const interestLabel = (i: string) => (t.interests as Record<string, string>)[i] ?? i;

  return (
    <>
      <Card title={t.settings.keyTitle}>
        <p className="mb-4 text-sm text-muted-foreground">
          {t.settings.keyIntroBefore}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-accent underline">
            platform.openai.com/api-keys
          </a>
          {t.settings.keyIntroAfter}
        </p>
        {keyInfo && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <span className="text-sm">{t.apiKey.stored(keyInfo.last4, dateFormat.format(new Date(keyInfo.updatedAt)))}</span>
            <form action={removeApiKey}>
              <SubmitButton variant="danger" pendingText={t.common.deleting}>
                {t.common.delete}
              </SubmitButton>
            </form>
          </div>
        )}
        {!keyInfo && resolved?.source === "household" && (
          <p className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm">
            {t.settings.householdNoteBefore}
            <Link href={localePath(locale, "/household")} className="text-accent underline">
              {t.settings.householdNoteLink}
            </Link>
            {t.settings.householdNoteAfter}
          </p>
        )}
        <ApiKeyForm hasKey={Boolean(keyInfo)} saveAction={saveApiKey} />
      </Card>

      <Card title={t.settings.profiles}>
        <ul className="divide-y divide-line">
          {profiles
            ?.filter((p) => isLanguage(p.language))
            .map((p) => {
              const language = p.language as keyof typeof LANGUAGES;
              return (
                <li key={p.language} className="flex items-center justify-between gap-3 py-3">
                  <span>
                    <span className="mr-2" aria-hidden>
                      {LANGUAGES[language].flag}
                    </span>
                    {t.languages[language]} · {p.cefr_level}
                    {p.interests.length > 0 && (
                      <span className="block text-sm text-muted-foreground">
                        {p.interests.map(interestLabel).join(", ")}
                      </span>
                    )}
                  </span>
                  <Link href={localePath(locale, `/onboarding?language=${p.language}`)} className={buttonClass("secondary")}>
                    {t.settings.edit}
                  </Link>
                </li>
              );
            })}
        </ul>
        {missingLanguages.length > 0 && (
          <Link
            href={localePath(locale, `/onboarding?language=${missingLanguages[0]}`)}
            className={`${buttonClass("secondary")} mt-3`}
          >
            {t.settings.addLanguage}
          </Link>
        )}
      </Card>

      <p className="text-sm text-muted-foreground">{t.settings.signedInAs(user.email)}</p>
    </>
  );
}
