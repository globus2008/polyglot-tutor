"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, FormMessage, inputClass } from "@/components/ui";
import { createHousehold, createInvite, type FormState } from "./actions";

export function CreateHouseholdForm() {
  const [state, action] = useActionState<FormState, FormData>(createHousehold, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="name">
        Název rodiny
      </label>
      <input id="name" name="name" required maxLength={80} placeholder="např. Veselí" className={inputClass} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText="Zakládám…">Založit rodinu</SubmitButton>
    </form>
  );
}

export function InviteLink() {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function share(url: string) {
    if (navigator.share) {
      await navigator.share({ title: "Polyglot Tutor", text: "Pozvánka do rodiny v Polyglot Tutor", url }).catch(() => {});
    } else {
      await copy(url);
    }
  }

  return (
    <div className="space-y-3">
      {state.url ? (
        <div className="space-y-2">
          <input readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-sm`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(state.url!)} className={buttonClass()}>
              {copied ? "Zkopírováno ✓" : "Zkopírovat odkaz"}
            </button>
            <button type="button" onClick={() => share(state.url!)} className={buttonClass("secondary")}>
              Sdílet…
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Odkaz ukažte jen členům rodiny – platí 7 dní a může ho použít kdokoli, kdo ho dostane.
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await createInvite()))}
          className={buttonClass()}
        >
          {pending ? "Vytvářím…" : "Vytvořit pozvánku"}
        </button>
      )}
      <FormMessage status={state.status} message={state.message} />
    </div>
  );
}
