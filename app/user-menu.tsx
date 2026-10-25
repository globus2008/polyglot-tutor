import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

// Not getCurrentUser(): the header also renders on /login, where redirecting would loop.
export async function UserMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/" className="hover:text-accent">
        Přehled
      </Link>
      <Link href="/settings" className="hover:text-accent">
        Nastavení
      </Link>
      <form action={signOut}>
        <button type="submit" className="text-muted-foreground hover:text-foreground">
          Odhlásit
        </button>
      </form>
    </nav>
  );
}
