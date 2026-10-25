"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteKey, saveKey, validateOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { INVITE_DAYS, newInviteToken } from "@/lib/households";
import { createClient } from "@/lib/supabase/server";

export type FormState = { status: "idle" | "ok" | "error"; message?: string; url?: string };

async function membership() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, supabase, member: data };
}

async function requireOwner() {
  const ctx = await membership();
  if (ctx.member?.role !== "owner") throw new Error("Only the household owner can do this");
  return { ...ctx, householdId: ctx.member.household_id };
}

export async function createHousehold(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  if (!name.success) return { status: "error", message: "Zadejte název rodiny." };
  const { supabase } = await membership();
  const { error } = await supabase.rpc("create_household", { p_name: name.data });
  if (error) {
    return { status: "error", message: error.message.includes("already") ? "Už jste členem jiné rodiny." : "Rodinu se nepodařilo založit." };
  }
  revalidatePath("/household");
  return { status: "ok" };
}

export async function createInvite(): Promise<FormState> {
  const { user, supabase, householdId } = await requireOwner();
  const { token, hash } = newInviteToken();
  const { error } = await supabase.from("household_invites").insert({
    household_id: householdId,
    token_hash: hash,
    created_by: user.id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  if (error) return { status: "error", message: "Pozvánku se nepodařilo vytvořit." };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  revalidatePath("/household");
  return { status: "ok", url: `${origin}/join/${token}` };
}

export async function revokeInvite(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = z.uuid().parse(formData.get("id"));
  await supabase.from("household_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/household");
}

const limitSchema = z.coerce.number().int().min(0).max(600);

export async function setHouseholdLimit(formData: FormData) {
  const { supabase, householdId } = await requireOwner();
  const limit = limitSchema.parse(formData.get("limit"));
  await supabase.from("households").update({ daily_minutes_limit: limit }).eq("id", householdId);
  revalidatePath("/household");
}

export async function setMemberLimit(formData: FormData) {
  const { supabase, householdId } = await requireOwner();
  const userId = z.uuid().parse(formData.get("user_id"));
  const raw = String(formData.get("limit") ?? "");
  const limit = raw === "" ? null : limitSchema.parse(raw);
  await supabase
    .from("household_members")
    .update({ daily_minutes_limit: limit })
    .eq("household_id", householdId)
    .eq("user_id", userId);
  revalidatePath("/household");
}

export async function removeMember(formData: FormData) {
  const { user, supabase, householdId } = await requireOwner();
  const userId = z.uuid().parse(formData.get("user_id"));
  if (userId === user.id) return;
  await supabase.from("household_members").delete().eq("household_id", householdId).eq("user_id", userId);
  revalidatePath("/household");
}

export async function leaveHousehold() {
  const { user, supabase, member } = await membership();
  // the owner would leave the family without anyone to manage it; they delete it instead
  if (!member || member.role === "owner") return;
  await supabase.from("household_members").delete().eq("household_id", member.household_id).eq("user_id", user.id);
  redirect("/household");
}

export async function deleteHousehold() {
  const { supabase, householdId } = await requireOwner();
  await supabase.from("households").delete().eq("id", householdId);
  redirect("/household");
}

export async function saveHouseholdKey(_prev: FormState, formData: FormData): Promise<FormState> {
  const { householdId } = await requireOwner();
  const key = String(formData.get("api_key") ?? "").trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return { status: "error", message: "Tohle nevypadá jako OpenAI klíč (začíná „sk-“)." };
  }
  const check = await validateOpenAIKey(key);
  if (check === "invalid") return { status: "error", message: "OpenAI klíč odmítlo – zkontrolujte, že je platný." };
  if (check === "unreachable") return { status: "error", message: "Nepodařilo se ověřit klíč u OpenAI, zkuste to znovu." };
  await saveKey({ kind: "household", id: householdId }, key);
  revalidatePath("/household");
  return { status: "ok", message: "Rodinný klíč je ověřený a uložený šifrovaně." };
}

export async function removeHouseholdKey() {
  const { householdId } = await requireOwner();
  await deleteKey({ kind: "household", id: householdId });
  revalidatePath("/household");
}

export async function joinHousehold(token: string): Promise<FormState> {
  const { supabase } = await membership();
  const { error } = await supabase.rpc("join_household", { p_token: token });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("already")
        ? "Už jste členem jiné rodiny. Nejdřív ji opusťte na stránce Rodina."
        : "Pozvánka je neplatná nebo vypršela. Požádejte o novou.",
    };
  }
  redirect("/household");
}
