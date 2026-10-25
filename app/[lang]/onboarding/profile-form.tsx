"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage, inputClass } from "@/components/ui";
import {
  DEFAULT_CONVERSATION_STYLE,
  END_OF_TURN_PAUSE,
  IDLE_PROMPT_OPTIONS,
  TURN_MODE_CODES,
  TUTOR_INITIATIVE_CODES,
} from "@/lib/conversation-style";
import { useI18n } from "@/lib/i18n/client";
import { CEFR_CODES, INTEREST_KEYS, LANGUAGE_CODES, LANGUAGES, NATIVE_LANGUAGE_CODES } from "@/lib/languages";
import { saveProfile, type ProfileState } from "./actions";

type Initial = {
  language: string;
  cefr_level?: string;
  native_lang?: string;
  interests?: string[];
  goals?: string;
  tutor_initiative?: string;
  turn_mode?: string;
  end_of_turn_pause_ms?: number;
  idle_prompt_s?: number;
};

const chip =
  "cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:checked]:text-accent";
const optionCard =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 has-[:checked]:border-accent";

export function ProfileForm({
  initial,
  existingLanguages,
  nativeDefault,
}: {
  initial?: Initial;
  existingLanguages: string[];
  nativeDefault: string;
}) {
  const { t, intl } = useI18n();
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, { status: "idle" });
  const [language, setLanguage] = useState(
    initial?.language ?? LANGUAGE_CODES.find((l) => !existingLanguages.includes(l)) ?? LANGUAGE_CODES[0],
  );
  const style = { ...DEFAULT_CONVERSATION_STYLE, ...initial };
  const [turnMode, setTurnMode] = useState(style.turn_mode);
  const [pauseMs, setPauseMs] = useState(style.end_of_turn_pause_ms);
  const presetInterests = new Set<string>(INTEREST_KEYS);
  const customInterests = (initial?.interests ?? []).filter((i) => !presetInterests.has(i));

  return (
    <form action={action} className="space-y-8">
      <fieldset>
        <legend className="mb-3 font-medium">{t.onboarding.language}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LANGUAGE_CODES.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-4 has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent/30"
            >
              <input
                type="radio"
                name="language"
                value={code}
                checked={language === code}
                onChange={() => setLanguage(code)}
                className="sr-only"
              />
              <span className="text-2xl" aria-hidden>
                {LANGUAGES[code].flag}
              </span>
              <span>
                <span className="block font-medium">{t.languages[code]}</span>
                {existingLanguages.includes(code) && (
                  <span className="text-xs text-muted-foreground">{t.onboarding.profileExists}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-medium">{t.onboarding.level}</legend>
        <div className="space-y-2">
          {CEFR_CODES.map((level) => (
            <label key={level} className={optionCard}>
              <input
                type="radio"
                name="cefr_level"
                value={level}
                required
                defaultChecked={(initial?.cefr_level ?? "A2") === level}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="font-medium">{level}</span>{" "}
                <span className="text-sm text-muted-foreground">{t.cefr[level]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t.onboarding.levelHint}</p>
      </fieldset>

      <div>
        <label className="mb-3 block font-medium" htmlFor="native_lang">
          {t.onboarding.nativeLanguage}
        </label>
        <select
          id="native_lang"
          name="native_lang"
          defaultValue={initial?.native_lang ?? nativeDefault}
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
      </div>

      <fieldset>
        <legend className="mb-3 font-medium">{t.onboarding.interests}</legend>
        <div className="flex flex-wrap gap-2">
          {INTEREST_KEYS.map((interest) => (
            <label key={interest} className={chip}>
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={initial?.interests?.includes(interest)}
                className="sr-only"
              />
              {t.interests[interest]}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-sm text-muted-foreground" htmlFor="custom_interests">
          {t.onboarding.customInterests}
        </label>
        <input
          id="custom_interests"
          name="custom_interests"
          defaultValue={customInterests.join(", ")}
          placeholder={t.onboarding.customPlaceholder}
          className={`${inputClass} mt-1`}
        />
      </fieldset>

      <div>
        <label className="mb-3 block font-medium" htmlFor="goals">
          {t.onboarding.goals}
        </label>
        <textarea
          id="goals"
          name="goals"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.goals}
          placeholder={t.onboarding.goalsPlaceholder}
          className={inputClass}
        />
      </div>

      <fieldset className="space-y-6">
        <legend className="mb-3 font-medium">{t.onboarding.style}</legend>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t.onboarding.initiativeQuestion}</p>
          {TUTOR_INITIATIVE_CODES.map((code) => (
            <label key={code} className={optionCard}>
              <input
                type="radio"
                name="tutor_initiative"
                value={code}
                defaultChecked={style.tutor_initiative === code}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium">{t.style.initiative[code].label}</span>
                <span className="text-sm text-muted-foreground">{t.style.initiative[code].description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t.onboarding.turnQuestion}</p>
          {TURN_MODE_CODES.map((code) => (
            <label key={code} className={optionCard}>
              <input
                type="radio"
                name="turn_mode"
                value={code}
                checked={turnMode === code}
                onChange={() => setTurnMode(code)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium">{t.style.turnMode[code].label}</span>
                <span className="text-sm text-muted-foreground">{t.style.turnMode[code].description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className={turnMode === "push_to_talk" ? "hidden" : undefined}>
          <label htmlFor="end_of_turn_pause_ms" className="flex justify-between text-sm">
            <span>{t.onboarding.pause}</span>
            <span className="font-medium tabular-nums">{(pauseMs / 1000).toLocaleString(intl)} s</span>
          </label>
          <input
            id="end_of_turn_pause_ms"
            name="end_of_turn_pause_ms"
            type="range"
            min={END_OF_TURN_PAUSE.min}
            max={END_OF_TURN_PAUSE.max}
            step={END_OF_TURN_PAUSE.step}
            value={pauseMs}
            onChange={(e) => setPauseMs(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
          <p className="mt-1 text-sm text-muted-foreground">{t.onboarding.pauseHint}</p>
        </div>

        <div>
          <label htmlFor="idle_prompt_s" className="block text-sm">
            {t.onboarding.idle}
          </label>
          <select
            id="idle_prompt_s"
            name="idle_prompt_s"
            defaultValue={style.idle_prompt_s}
            className={`${inputClass} mt-1 sm:w-60`}
          >
            {IDLE_PROMPT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t.onboarding.idleNever : t.onboarding.idleSeconds(s)}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <FormMessage status={state.status} message={state.message} />
      <SubmitButton className="w-full sm:w-auto">{t.onboarding.save}</SubmitButton>
    </form>
  );
}
