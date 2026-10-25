"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { END_OF_TURN_PAUSE, IDLE_PROMPT_OPTIONS, TURN_MODE_CODES, TUTOR_INITIATIVE_CODES } from "@/lib/conversation-style";
import { localePath } from "@/lib/i18n";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import { CEFR_CODES, LANGUAGE_CODES, NATIVE_LANGUAGE_CODES } from "@/lib/languages";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { status: "idle" | "error"; message?: string };

const profileSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  cefr_level: z.enum(CEFR_CODES),
  native_lang: z.enum(NATIVE_LANGUAGE_CODES),
  interests: z.array(z.string().trim().min(1).max(40)).max(20),
  goals: z.string().trim().max(1000),
  tutor_initiative: z.enum(TUTOR_INITIATIVE_CODES),
  turn_mode: z.enum(TURN_MODE_CODES),
  end_of_turn_pause_ms: z.coerce.number().int().min(END_OF_TURN_PAUSE.min).max(END_OF_TURN_PAUSE.max),
  idle_prompt_s: z.coerce
    .number()
    .int()
    .refine((v) => (IDLE_PROMPT_OPTIONS as readonly number[]).includes(v)),
});

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const [user, t, locale] = await Promise.all([getCurrentUser(), getRequestDictionary(), getRequestLocale()]);

  // preset interests arrive as keys, custom ones as free text
  const custom = String(formData.get("custom_interests") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const parsed = profileSchema.safeParse({
    language: formData.get("language"),
    cefr_level: formData.get("cefr_level"),
    native_lang: formData.get("native_lang"),
    interests: [...new Set([...formData.getAll("interests").map(String), ...custom])],
    goals: String(formData.get("goals") ?? ""),
    tutor_initiative: formData.get("tutor_initiative"),
    turn_mode: formData.get("turn_mode"),
    end_of_turn_pause_ms: formData.get("end_of_turn_pause_ms"),
    idle_prompt_s: formData.get("idle_prompt_s"),
  });
  if (!parsed.success) return { status: "error", message: t.onboarding.invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("learner_profiles").upsert({ user_id: user.id, ...parsed.data });
  if (error) return { status: "error", message: t.onboarding.saveFailed };

  redirect(localePath(locale, "/"));
}
