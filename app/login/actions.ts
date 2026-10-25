"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!email.success) return { status: "error", message: "Zadejte platný e-mail." };

  const next = safeNext(formData.get("next"));
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return {
      status: "error",
      email: email.data,
      message: error.status === 429 ? "Příliš mnoho pokusů, zkuste to za chvíli." : "E-mail se nepodařilo odeslat.",
    };
  }
  return { status: "sent", email: email.data };
}

// The code from the email works on any device, unlike the link's PKCE flow that needs the same browser.
export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { ...prev, status: "sent", message: "Kód má jen číslice z e-mailu." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ...prev, status: "sent", message: "Kód nesouhlasí nebo vypršel." };

  redirect(safeNext(formData.get("next")));
}
