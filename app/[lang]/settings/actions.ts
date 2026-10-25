"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkNewKey, deleteKey, saveKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { localePath } from "@/lib/i18n";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type KeyState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveApiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const [user, t] = await Promise.all([getCurrentUser(), getRequestDictionary()]);
  const key = String(formData.get("api_key") ?? "").trim();
  const check = await checkNewKey(key);
  if (check !== "ok") return { status: "error", message: t.apiKey[check] };

  await saveKey({ kind: "user", id: user.id }, key);
  revalidatePath("/[lang]/settings", "page");
  return { status: "saved", message: t.apiKey.saved };
}

export async function removeApiKey() {
  const user = await getCurrentUser();
  await deleteKey({ kind: "user", id: user.id });
  revalidatePath("/[lang]/settings", "page");
}

/** Deletes the auth user; every table cascades from auth.users, so all data goes with it. */
export async function deleteAccount() {
  const [user, locale] = await Promise.all([getCurrentUser(), getRequestLocale()]);
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw error;
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(localePath(locale, "/login"));
}
