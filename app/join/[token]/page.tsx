import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "Pozvánka do rodiny – Polyglot Tutor" };

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <div className="mx-auto max-w-md pt-4">
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <Invite params={params} />
      </Suspense>
    </div>
  );
}

async function Invite({ params }: Pick<PageProps<"/join/[token]">, "params">) {
  const { token } = await params;
  const user = await getCurrentUser();
  const supabase = await createClient();
  const [{ data: invite }, { data: membership }] = await Promise.all([
    supabase.rpc("household_for_invite", { p_token: token }).maybeSingle(),
    supabase.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!invite) {
    return (
      <Card title="Pozvánka neplatí">
        <p className="text-sm text-muted-foreground">Odkaz vypršel nebo ho správce zrušil. Požádejte o nový.</p>
        <Link href="/" className={`${buttonClass("secondary")} mt-4`}>
          Na přehled
        </Link>
      </Card>
    );
  }

  if (membership?.household_id === invite.household_id) {
    return (
      <Card title={`Už jste v rodině ${invite.name}`}>
        <Link href="/household" className={`${buttonClass()} mt-2`}>
          Otevřít rodinu
        </Link>
      </Card>
    );
  }

  return (
    <Card title={`Pozvánka do rodiny ${invite.name}`}>
      <p className="text-sm text-muted-foreground">
        Po připojení můžete mít lekce na rodinném OpenAI klíči s denním limitem, který nastavuje správce rodiny. Správce
        uvidí váš e-mail a kolik minut jste na rodinném klíči strávili. Vaše lekce, chyby a slovíčka zůstávají
        soukromé.
      </p>
      {membership ? (
        <p className="mt-4 text-sm text-danger">
          Už jste členem jiné rodiny. Nejdřív ji opusťte na stránce{" "}
          <Link href="/household" className="underline">
            Rodina
          </Link>
          .
        </p>
      ) : (
        <JoinButton token={token} />
      )}
    </Card>
  );
}
