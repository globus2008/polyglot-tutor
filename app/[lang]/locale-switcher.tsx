"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALE_NAMES, LOCALES } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/** Dropdown that opens the current page in another UI language. */
export function LocaleSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <select
      aria-label={t.nav.language}
      value={locale}
      onChange={(e) => router.push(`/${e.target.value}${rest}${search ? `?${search}` : ""}`)}
      className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} lang={l} aria-label={LOCALE_NAMES[l]}>
          {l.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
