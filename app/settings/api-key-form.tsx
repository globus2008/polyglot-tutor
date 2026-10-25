"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
import { saveApiKey, type KeyState } from "./actions";

export function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, action] = useActionState<KeyState, FormData>(saveApiKey, { status: "idle" });

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
