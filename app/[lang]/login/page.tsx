import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.login };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.login.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.login.intro}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-xs text-muted-foreground">
        {t.login.privacyBefore}
        <Link href={localePath(locale, "/privacy")} className="underline">
          {t.login.privacyLink}
        </Link>
        {t.login.privacyAfter}
      </p>
    </div>
  );
}
