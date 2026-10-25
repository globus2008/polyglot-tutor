"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
import { useI18n } from "@/lib/i18n/client";
import { NATIVE_LANGUAGE_CODES, type NativeLanguage } from "@/lib/languages";
import { saveNativeLanguage, type NativeState } from "./actions";

export function NativeLanguageForm({ current }: { current: NativeLanguage }) {
  const { t, intl } = useI18n();
  const [state, action] = useActionState<NativeState, FormData>(saveNativeLanguage, { status: "idle" });

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select
          name="native_lang"
          aria-label={t.settings.nativeTitle}
          defaultValue={current}
          className={`${inputClass} sm:w-72`}
        >
          {[...NATIVE_LANGUAGE_CODES]
            .sort((a, b) => t.nativeLanguages[a].localeCompare(t.nativeLanguages[b], intl))
            .map((code) => (
              <option key={code} value={code}>
                {t.nativeLanguages[code]}
              </option>
            ))}
        </select>
        <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
      </div>
      <FormMessage status={state.status} message={state.message} />
    </form>
  );
}
