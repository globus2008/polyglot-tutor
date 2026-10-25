"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LOCALES } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/client";

/** Links to the current page in the other UI languages. */
export function LocaleSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <nav aria-label={t.nav.language} className="flex gap-1 text-xs font-medium uppercase">
      {LOCALES.map((l) =>
        l === locale ? (
          <span key={l} aria-current="true" className="rounded px-1.5 py-0.5 text-accent">
            {l}
          </span>
        ) : (
          <Link
            key={l}
            href={`/${l}${rest}${search ? `?${search}` : ""}`}
            hrefLang={l}
            className="rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
          >
            {l}
          </Link>
        ),
      )}
    </nav>
  );
}
