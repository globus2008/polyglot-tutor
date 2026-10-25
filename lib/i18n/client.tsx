"use client";

import { createContext, use, type ReactNode } from "react";
import { getDictionaryFor, INTL_LOCALE, localePath, type Locale } from ".";

const LocaleContext = createContext<Locale | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

/** Dictionary and helpers for Client Components. */
export function useI18n() {
  const locale = use(LocaleContext);
  if (!locale) throw new Error("useI18n must be used inside I18nProvider");
  return {
    locale,
    t: getDictionaryFor(locale),
    intl: INTL_LOCALE[locale],
    path: (path: string) => localePath(locale, path),
  };
}
