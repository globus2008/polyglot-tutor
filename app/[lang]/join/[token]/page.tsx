import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { JoinButton } from "./join-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.join };
}

export default async function JoinPage({ params }: PageProps<"/[lang]/join/[token]">) {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-md pt-4">
      <Suspense fallback={<p className="text-muted-foreground">{t.common.loading}</p>}>
        <Invite params={params} />
      </Suspense>
    </div>
  );
}

async function Invite({ params }: Pick<PageProps<"/[lang]/join/[token]">, "params">) {
  const { token } = await params;
  const [t, locale, user] = await Promise.all([getDictionary(), getLocale(), getCurrentUser()]);
  const supabase = await createClient();
  const [{ data: invite }, { data: membership }] = await Promise.all([
    supabase.rpc("household_for_invite", { p_token: token }).maybeSingle(),
    supabase.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!invite) {
    return (
      <Card title={t.join.invalidTitle}>
        <p className="text-sm text-muted-foreground">{t.join.invalidText}</p>
        <Link href={localePath(locale, "/")} className={`${buttonClass("secondary")} mt-4`}>
          {t.common.dashboard}
        </Link>
      </Card>
    );
  }

  if (membership?.household_id === invite.household_id) {
    return (
      <Card title={t.join.alreadyIn(invite.name)}>
        <Link href={localePath(locale, "/household")} className={`${buttonClass()} mt-2`}>
          {t.join.openHousehold}
        </Link>
      </Card>
    );
  }

  return (
    <Card title={t.join.title(invite.name)}>
      <p className="text-sm text-muted-foreground">{t.join.text}</p>
      {membership ? (
        <p className="mt-4 text-sm text-danger">
          {t.join.otherHouseholdBefore}
          <Link href={localePath(locale, "/household")} className="underline">
            {t.join.otherHouseholdLink}
          </Link>
          {t.join.otherHouseholdAfter}
        </p>
      ) : (
        <JoinButton token={token} />
      )}
    </Card>
  );
}
