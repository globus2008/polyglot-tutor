import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { isLanguage, isNativeLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.onboarding };
}

export default async function OnboardingPage({ searchParams }: PageProps<"/[lang]/onboarding">) {
  const t = await getDictionary();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.onboarding.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.onboarding.intro}</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
        <ProfileLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProfileLoader({ searchParams }: Pick<PageProps<"/[lang]/onboarding">, "searchParams">) {
  const { language: requested } = await searchParams;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select(
      "language, cefr_level, native_lang, interests, goals, tutor_initiative, turn_mode, end_of_turn_pause_ms, idle_prompt_s",
    )
    .eq("user_id", user.id);

  const language = isLanguage(requested) ? requested : undefined;
  const existing = profiles?.find((p) => p.language === language);
  // new profiles explain in the language the learner already uses elsewhere, else the UI language
  const nativeDefault = profiles?.find((p) => isNativeLanguage(p.native_lang))?.native_lang ?? locale;

  return (
    <ProfileForm
      key={language ?? "new"}
      initial={existing ?? (language ? { language } : undefined)}
      existingLanguages={(profiles ?? []).map((p) => p.language)}
      nativeDefault={nativeDefault}
    />
  );
}
