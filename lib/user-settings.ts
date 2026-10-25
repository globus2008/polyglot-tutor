import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isNativeLanguage, type NativeLanguage } from "./languages";
import type { Database } from "./supabase/database.types";

/** The learner's native language (explanations, translations, feedback); `fallback` until they save one. */
export async function getNativeLanguage(
  db: SupabaseClient<Database>,
  userId: string,
  fallback: NativeLanguage,
): Promise<NativeLanguage> {
  const { data } = await db.from("user_settings").select("native_lang").eq("user_id", userId).maybeSingle();
  return isNativeLanguage(data?.native_lang) ? data.native_lang : fallback;
}
