"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, action] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="font-medium">Zkontrolujte e-mail</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Odkaz pro přihlášení jsme poslali na <strong>{state.email}</strong>. Otevřete ho ve stejném prohlížeči.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-3">
      {searchParams.get("error") === "link" && (
        <FormMessage status="error" message="Odkaz je neplatný nebo vypršel. Pošlete si nový." />
      )}
      <input type="hidden" name="next" value={searchParams.get("next") ?? "/"} />
      <label className="block text-sm font-medium" htmlFor="email">
        E-mail
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={state.email}
        className={inputClass}
      />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Odesílám…" className="w-full">
        Poslat přihlašovací odkaz
      </SubmitButton>
    </form>
  );
}
