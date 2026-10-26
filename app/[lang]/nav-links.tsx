"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; /** path prefixes (after the locale) that belong to this item */ sections: string[] };

/** Main navigation; the item for the current page is highlighted. On phones it is a row of tabs below the logo. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const rest = usePathname().replace(/^\/[^/]+/, "") || "/";
  const active = (item: NavItem) =>
    item.sections.some((s) => (s === "/" ? rest === "/" : rest === s || rest.startsWith(`${s}/`)));

  return (
    <nav className="order-last -mx-1 flex w-full gap-1 pb-2 text-sm sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
      {items.map((item) => {
        const current = active(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={`flex-1 rounded-lg px-2.5 py-1.5 text-center sm:flex-none ${
              current ? "bg-accent/10 font-medium text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
