import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { resolveOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { isLanguage, LANGUAGES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: profiles }, key] = await Promise.all([
    supabase.from("learner_profiles").select("language, cefr_level").eq("user_id", user.id).order("language"),
    resolveOpenAIKey(user.id),
  ]);

  if (!profiles?.length) redirect("/onboarding");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Vítejte zpět</h1>

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

      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.filter((p) => isLanguage(p.language)).map((p) => {
          const lang = LANGUAGES[p.language as keyof typeof LANGUAGES];
          return (
            <Card key={p.language}>
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>
                  {lang.flag}
                </span>
                <div>
                  <p className="font-semibold">{lang.name}</p>
                  <p className="text-sm text-muted-foreground">Úroveň {p.cefr_level}</p>
                </div>
              </div>
              <button type="button" disabled className={`${buttonClass()} mt-4 w-full`} title="Připravujeme">
                Začít lekci
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
