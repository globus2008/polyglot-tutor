import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).meta.login };
}

export default async function LoginPage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.login.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.login.intro}</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
