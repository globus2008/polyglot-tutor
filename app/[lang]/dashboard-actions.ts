"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { CEFR_CODES, LANGUAGE_CODES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ language: z.enum(LANGUAGE_CODES), level: z.enum(CEFR_CODES) });

/** Accepts the tutor's level estimate from the dashboard. */
export async function acceptLevel(formData: FormData) {
  const parsed = schema.safeParse({ language: formData.get("language"), level: formData.get("level") });
  if (!parsed.success) return;
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase
    .from("learner_profiles")
    .update({ cefr_level: parsed.data.level })
    .eq("user_id", user.id)
    .eq("language", parsed.data.language);
  revalidatePath("/[lang]", "page");
}
