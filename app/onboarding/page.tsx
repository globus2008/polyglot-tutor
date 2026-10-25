import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil studenta – Polyglot Tutor" };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Co se chcete učit?</h1>
        <p className="mt-2 text-muted-foreground">
          Podle úrovně a zájmů lektor vybírá témata rozhovorů. Pro každý jazyk máte samostatný profil a vše jde později
          změnit.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <ProfileLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProfileLoader({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const { lang } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("learner_profiles")
    .select("language, cefr_level, interests, goals, tutor_initiative, turn_mode, end_of_turn_pause_ms, idle_prompt_s")
    .eq("user_id", user.id);

  const language = isLanguage(lang) ? lang : undefined;
  const existing = profiles?.find((p) => p.language === language);

  return (
    <ProfileForm
      key={language ?? "new"}
      initial={existing ?? (language ? { language } : undefined)}
      existingLanguages={(profiles ?? []).map((p) => p.language)}
    />
  );
}
