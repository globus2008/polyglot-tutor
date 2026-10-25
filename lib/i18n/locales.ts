// UI locales. Every page lives under /[lang]; the proxy picks one for bare URLs.

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
/** Remembers the last locale used, for redirects of bare URLs and for server actions. */
export const LOCALE_COOKIE = "locale";

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", cs: "Čeština" };
/** BCP 47 tag for Intl formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", cs: "cs-CZ" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Slovak speakers read Czech without effort, so they get Czech rather than English.
const LANGUAGE_TO_LOCALE: Record<string, Locale> = { cs: "cs", sk: "cs", en: "en" };

/** Best UI locale for an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { language: tag.toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.language && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);
  for (const { language } of ranked) {
    const locale = LANGUAGE_TO_LOCALE[language];
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/** Prefixes an app path with the locale: ("cs", "/settings") → "/cs/settings". */
export function localePath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}
