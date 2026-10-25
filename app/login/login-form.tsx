"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [sent, sendAction] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (sent.status === "sent" && sent.email) return <CodeForm email={sent.email} next={next} />;

  return (
    <form action={sendAction} className="mt-6 space-y-3">
      {searchParams.get("error") === "link" && (
        <FormMessage status="error" message="Odkaz je neplatný nebo vypršel. Pošlete si nový." />
      )}
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium" htmlFor="email">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={sent.email}
        className={inputClass}
      />
      <FormMessage status={sent.status} message={sent.message} />
      <SubmitButton pendingText="Odesílám…" className="w-full">
        Poslat přihlašovací kód
      </SubmitButton>
    </form>
  );
}

function CodeForm({ email, next }: { email: string; next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(verifyCode, { status: "sent", email });

  return (
    <form action={action} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5">
      <p className="font-medium">Zkontrolujte e-mail</p>
      <p className="text-sm text-muted-foreground">
        Na <strong>{email}</strong> jsme poslali kód. Opište ho sem, nebo v e-mailu klikněte na odkaz.
      </p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium" htmlFor="code">
        Kód z e-mailu
      </label>
      <input
        id="code"
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,12}"
        autoFocus
        className={`${inputClass} text-center font-mono text-2xl tracking-[0.3em]`}
      />
      <FormMessage status="error" message={state.message} />
      <SubmitButton pendingText="Ověřuji…" className="w-full">
        Přihlásit se
      </SubmitButton>
      <button type="button" onClick={() => window.location.reload()} className="w-full text-sm text-muted-foreground">
        Jiný e-mail / poslat znovu
      </button>
    </form>
  );
}
