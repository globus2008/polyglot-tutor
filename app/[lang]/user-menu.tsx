import { localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { NavLinks } from "./nav-links";

// Not getCurrentUser(): the header also renders on /login, where redirecting would loop.
export async function UserMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <NavLinks
        items={[
          { href: localePath(locale, "/"), label: t.nav.dashboard, sections: ["/", "/lesson", "/review", "/history"] },
          { href: localePath(locale, "/household"), label: t.nav.household, sections: ["/household", "/join"] },
          { href: localePath(locale, "/settings"), label: t.nav.settings, sections: ["/settings", "/onboarding"] },
        ]}
      />
      <form action={signOut}>
        <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
          {t.nav.signOut}
        </button>
      </form>
    </>
  );
}
