import Link from "next/link";
import { localePath } from "@/lib/i18n";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Not getCurrentUser(): the header also renders on /login, where redirecting would loop.
export async function UserMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <nav className="flex items-center gap-3 text-sm sm:gap-4">
      <Link href={localePath(locale, "/")} className="hover:text-accent">
        {t.nav.dashboard}
      </Link>
      <Link href={localePath(locale, "/household")} className="hover:text-accent">
        {t.nav.household}
      </Link>
      <Link href={localePath(locale, "/settings")} className="hover:text-accent">
        {t.nav.settings}
      </Link>
      <form action={signOut}>
        <button type="submit" className="text-muted-foreground hover:text-foreground">
          {t.nav.signOut}
        </button>
      </form>
    </nav>
  );
}
