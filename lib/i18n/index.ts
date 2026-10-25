import { cs } from "./dictionaries/cs";
import { en, type Dictionary } from "./dictionaries/en";
import type { Locale } from "./locales";

export type { Dictionary };
export * from "./locales";

const dictionaries: Record<Locale, Dictionary> = { en, cs };

export function getDictionaryFor(locale: Locale): Dictionary {
  return dictionaries[locale];
}
