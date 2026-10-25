export const LANGUAGES = {
  es: { name: "Španělština", native: "Español", flag: "🇪🇸", speech: "es-ES", adverb: "španělsky" },
  en: { name: "Angličtina", native: "English", flag: "🇬🇧", speech: "en-GB", adverb: "anglicky" },
  de: { name: "Němčina", native: "Deutsch", flag: "🇩🇪", speech: "de-DE", adverb: "německy" },
  it: { name: "Italština", native: "Italiano", flag: "🇮🇹", speech: "it-IT", adverb: "italsky" },
  fr: { name: "Francouzština", native: "Français", flag: "🇫🇷", speech: "fr-FR", adverb: "francouzsky" },
  ru: { name: "Ruština", native: "Русский", flag: "🇷🇺", speech: "ru-RU", adverb: "rusky" },
} as const;

export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as Language[];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in LANGUAGES;
}

export const CEFR_LEVELS = {
  A1: "Začátečník – pozdravím, představím se, objednám si",
  A2: "Mírně pokročilý – zvládnu běžné situace jednoduchými větami",
  B1: "Středně pokročilý – domluvím se na cestách, popíšu zážitky",
  B2: "Pokročilý – plynule diskutuji o běžných i odborných tématech",
  C1: "Velmi pokročilý – mluvím přirozeně a přesně, i o složitých věcech",
  C2: "Téměř rodilý mluvčí",
} as const;

export type CefrLevel = keyof typeof CEFR_LEVELS;
export const CEFR_CODES = Object.keys(CEFR_LEVELS) as CefrLevel[];

export const INTEREST_OPTIONS = [
  "cestování",
  "jídlo a vaření",
  "sport",
  "práce a kariéra",
  "technologie",
  "filmy a seriály",
  "hudba",
  "knihy",
  "příroda",
  "zdraví",
  "rodina a vztahy",
  "historie a kultura",
  "věda",
  "politika a společnost",
  "byznys a finance",
  "hry",
] as const;
