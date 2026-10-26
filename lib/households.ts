import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { localDay } from "./progress";
import { createAdminClient } from "./supabase/server";

export const INVITE_DAYS = 7;

export function newInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

/** Daily voice-minute limit of a member on the household key, and what they used today. */
export async function getHouseholdAllowance(userId: string, householdId: string) {
  const db = createAdminClient();
  const [{ data: member }, { data: household }, { data: usage }] = await Promise.all([
    db
      .from("household_members")
      .select("daily_minutes_limit")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle(),
    db.from("households").select("daily_minutes_limit").eq("id", householdId).maybeSingle(),
    db.from("usage_daily").select("audio_seconds").eq("user_id", userId).eq("day", localDay(new Date())).maybeSingle(),
  ]);
  return {
    limitMinutes: member?.daily_minutes_limit ?? household?.daily_minutes_limit ?? 0,
    usedSeconds: usage?.audio_seconds ?? 0,
  };
}

/** Emails of the given users, for the household member list (auth.users isn't exposed via RLS). */
export async function getEmails(userIds: string[]): Promise<Map<string, string>> {
  const db = createAdminClient();
  const entries = await Promise.all(
    userIds.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    }),
  );
  return new Map(entries);
}

/** Which of the given users have their own key – their lessons don't run on the household key. */
export async function getUsersWithOwnKey(userIds: string[]): Promise<Set<string>> {
  const { data } = await createAdminClient().from("api_keys").select("user_id").in("user_id", userIds);
  return new Set((data ?? []).map((k) => k.user_id).filter((id): id is string => Boolean(id)));
}
