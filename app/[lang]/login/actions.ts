"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localePath } from "@/lib/i18n";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const [t, locale] = await Promise.all([getRequestDictionary(), getRequestLocale()]);
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: t.login.invalidEmail };

  const next = safeNext(formData.get("next"), localePath(locale, "/"));
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { status: "error", email: email.data, message: error.status === 429 ? t.login.tooMany : t.login.sendFailed };
  }
  return { status: "sent", email: email.data };
}

// The code from the email works on any device, unlike the link's PKCE flow that needs the same browser.
export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const [t, locale] = await Promise.all([getRequestDictionary(), getRequestLocale()]);
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { ...prev, status: "sent", message: t.login.codeDigits };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ...prev, status: "sent", message: t.login.codeWrong };

  redirect(safeNext(formData.get("next"), localePath(locale, "/")));
}
