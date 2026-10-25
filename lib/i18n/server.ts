import "server-only";
import { cookies, headers } from "next/headers";
import { lang } from "next/root-params";
import { DEFAULT_LOCALE, getDictionaryFor, isLocale, LOCALE_COOKIE, matchLocale, type Locale } from ".";

/** Locale of the current page, from the /[lang] segment. Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary() {
  return getDictionaryFor(await getLocale());
}

/**
 * Locale for Server Actions and Route Handlers, where the /[lang] segment isn't available:
 * the cookie the proxy sets on every page view, then the browser's languages.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return matchLocale((await headers()).get("accept-language"));
}

export async function getRequestDictionary() {
  return getDictionaryFor(await getRequestLocale());
}
