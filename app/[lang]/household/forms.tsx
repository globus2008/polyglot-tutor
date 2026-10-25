"use client";

import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/submit-button";
import { buttonClass, FormMessage, inputClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import { createHousehold, createInvite, type FormState } from "./actions";

export function CreateHouseholdForm() {
  const { t } = useI18n();
  const [state, action] = useActionState<FormState, FormData>(createHousehold, { status: "idle" });
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="name">
        {t.household.name}
      </label>
      <input id="name" name="name" required maxLength={80} placeholder={t.household.namePlaceholder} className={inputClass} />
      <FormMessage status={state.status} message={state.message} />
      <SubmitButton pendingText={t.household.creating}>{t.household.create}</SubmitButton>
    </form>
  );
}

export function InviteLink() {
  const { t } = useI18n();
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
      await navigator.share({ title: "Polyglot Tutor", text: t.household.shareText, url }).catch(() => {});
    } else {
      await copy(url);
    }
  }

  return (
    <div className="space-y-3">
      {state.url ? (
        <div className="space-y-2">
          <input
            readOnly
            value={state.url}
            onFocus={(e) => e.currentTarget.select()}
            className={`${inputClass} font-mono text-sm`}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(state.url!)} className={buttonClass()}>
              {copied ? t.household.copied : t.household.copy}
            </button>
            <button type="button" onClick={() => share(state.url!)} className={buttonClass("secondary")}>
              {t.household.share}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t.household.inviteNote}</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await createInvite()))}
          className={buttonClass()}
        >
          {pending ? t.household.creatingInvite : t.household.createInvite}
        </button>
      )}
      <FormMessage status={state.status} message={state.message} />
    </div>
  );
}
