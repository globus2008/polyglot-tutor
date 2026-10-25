"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkNewKey, deleteKey, saveKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";
import { INVITE_DAYS, newInviteToken } from "@/lib/households";
import { localePath } from "@/lib/i18n";
import { getRequestDictionary, getRequestLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type FormState = { status: "idle" | "ok" | "error"; message?: string; url?: string };

const PAGE = "/[lang]/household";

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

async function householdPath() {
  return localePath(await getRequestLocale(), "/household");
}

export async function createHousehold(_prev: FormState, formData: FormData): Promise<FormState> {
  const t = await getRequestDictionary();
  const name = z.string().trim().min(1).max(80).safeParse(formData.get("name"));
  if (!name.success) return { status: "error", message: t.household.nameRequired };
  const { supabase } = await membership();
  const { error } = await supabase.rpc("create_household", { p_name: name.data });
  if (error) {
    return {
      status: "error",
      message: error.message.includes("already") ? t.household.alreadyMember : t.household.createFailed,
    };
  }
  revalidatePath(PAGE, "page");
  return { status: "ok" };
}

export async function createInvite(): Promise<FormState> {
  const [{ user, supabase, householdId }, t] = await Promise.all([requireOwner(), getRequestDictionary()]);
  const { token, hash } = newInviteToken();
  const { error } = await supabase.from("household_invites").insert({
    household_id: householdId,
    token_hash: hash,
    created_by: user.id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  if (error) return { status: "error", message: t.household.inviteFailed };
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  revalidatePath(PAGE, "page");
  // no locale in the link: the proxy picks the invitee's own language
  return { status: "ok", url: `${origin}/join/${token}` };
}

export async function revokeInvite(formData: FormData) {
  const { supabase } = await requireOwner();
  const id = z.uuid().parse(formData.get("id"));
  await supabase.from("household_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  revalidatePath(PAGE, "page");
}

const limitSchema = z.coerce.number().int().min(0).max(600);

export async function setHouseholdLimit(formData: FormData) {
  const { supabase, householdId } = await requireOwner();
  const limit = limitSchema.parse(formData.get("limit"));
  await supabase.from("households").update({ daily_minutes_limit: limit }).eq("id", householdId);
  revalidatePath(PAGE, "page");
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
  revalidatePath(PAGE, "page");
}

export async function removeMember(formData: FormData) {
  const { user, supabase, householdId } = await requireOwner();
  const userId = z.uuid().parse(formData.get("user_id"));
  if (userId === user.id) return;
  await supabase.from("household_members").delete().eq("household_id", householdId).eq("user_id", userId);
  revalidatePath(PAGE, "page");
}

export async function leaveHousehold() {
  const { user, supabase, member } = await membership();
  // the owner would leave the family without anyone to manage it; they delete it instead
  if (!member || member.role === "owner") return;
  await supabase.from("household_members").delete().eq("household_id", member.household_id).eq("user_id", user.id);
  redirect(await householdPath());
}

export async function deleteHousehold() {
  const { supabase, householdId } = await requireOwner();
  await supabase.from("households").delete().eq("id", householdId);
  redirect(await householdPath());
}

export async function saveHouseholdKey(_prev: FormState, formData: FormData): Promise<FormState> {
  const [{ householdId }, t] = await Promise.all([requireOwner(), getRequestDictionary()]);
  const key = String(formData.get("api_key") ?? "").trim();
  const check = await checkNewKey(key);
  if (check !== "ok") return { status: "error", message: t.apiKey[check] };
  await saveKey({ kind: "household", id: householdId }, key);
  revalidatePath(PAGE, "page");
  return { status: "ok", message: t.apiKey.householdSaved };
}

export async function removeHouseholdKey() {
  const { householdId } = await requireOwner();
  await deleteKey({ kind: "household", id: householdId });
  revalidatePath(PAGE, "page");
}

export async function joinHousehold(token: string): Promise<FormState> {
  const [{ supabase }, t] = await Promise.all([membership(), getRequestDictionary()]);
  const { error } = await supabase.rpc("join_household", { p_token: token });
  if (error) {
    return { status: "error", message: error.message.includes("already") ? t.join.alreadyMember : t.join.invalid };
  }
  redirect(await householdPath());
}
