"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkNewKey, deleteKey, saveKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { localePath } from "@/lib/i18n";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import { isNativeLanguage } from "@/lib/languages";
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

export type NativeState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveNativeLanguage(_prev: NativeState, formData: FormData): Promise<NativeState> {
  const [user, t] = await Promise.all([getCurrentUser(), getRequestDictionary()]);
  const nativeLang = formData.get("native_lang");
  if (!isNativeLanguage(nativeLang)) return { status: "error", message: t.onboarding.invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert({ user_id: user.id, native_lang: nativeLang });
  if (error) return { status: "error", message: t.onboarding.saveFailed };
  return { status: "saved", message: t.settings.nativeSaved };
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
