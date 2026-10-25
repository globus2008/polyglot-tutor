"use server";

import { redirect } from "next/navigation";
import { localePath } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(localePath(await getRequestLocale(), "/login"));
}
