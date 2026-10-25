import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Přihlášení – Polyglot Tutor" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Přihlášení</h1>
      <p className="mt-2 text-muted-foreground">
        Pošleme vám na e-mail odkaz, kterým se přihlásíte. Žádné heslo není potřeba – nový účet se založí automaticky.
      </p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
