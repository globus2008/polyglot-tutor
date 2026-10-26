// Languages the app teaches, and languages it can explain in. UI labels live in the
// i18n dictionaries; English names here are for model instructions.

export const LANGUAGES = {
  es: { english: "Spanish", flag: "🇪🇸", speech: "es-ES" },
  en: { english: "English", flag: "🇬🇧", speech: "en-GB" },
  de: { english: "German", flag: "🇩🇪", speech: "de-DE" },
  it: { english: "Italian", flag: "🇮🇹", speech: "it-IT" },
  fr: { english: "French", flag: "🇫🇷", speech: "fr-FR" },
  ru: { english: "Russian", flag: "🇷🇺", speech: "ru-RU" },
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
}

/** Languages explanations, translations and feedback can be given in. */
export const NATIVE_LANGUAGES = {
  cs: "Czech",
  en: "English",
  es: "Spanish",
  de: "German",
  it: "Italian",
  fr: "French",
  ru: "Russian",
} as const;

export type NativeLanguage = keyof typeof NATIVE_LANGUAGES;
export const NATIVE_LANGUAGE_CODES = Object.keys(NATIVE_LANGUAGES) as NativeLanguage[];

export function isNativeLanguage(value: unknown): value is NativeLanguage {
  return typeof value === "string" && value in NATIVE_LANGUAGES;
}

export const CEFR_CODES = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_CODES)[number];

/** Interest keys; they double as topic tags so the planner can match them. */
export const INTEREST_KEYS = [
  "travel",
  "food",
  "sport",
  "work",
  "technology",
  "films",
  "music",
  "books",
  "nature",
  "health",
  "family",
  "culture",
  "science",
  "society",
  "business",
  "games",
] as const;

export type InterestKey = (typeof INTEREST_KEYS)[number];
