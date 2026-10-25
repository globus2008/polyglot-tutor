"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
type KeyState = { status: string; message?: string };

export function ApiKeyForm<S extends KeyState>({
  hasKey,
  saveAction,
}: {
  hasKey: boolean;
  saveAction: (prev: S, formData: FormData) => Promise<S>;
}) {
  const [state, action] = useActionState<S, FormData>(saveAction, { status: "idle" } as Awaited<S>);

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="api_key">
        {hasKey ? "Nahradit klíčem" : "OpenAI API klíč"}
      </label>
      <input
        id="api_key"
        name="api_key"
        type="password"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder="sk-…"
        className={`${inputClass} font-mono`}
      />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Ověřuji…">Ověřit a uložit</SubmitButton>
    </form>
  );
}
