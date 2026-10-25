import "server-only";
import { decryptSecret, encryptSecret } from "./crypto";
import { createAdminClient } from "./supabase/server";

// All access to api_keys goes through here, using the admin client after the caller
// has verified the user. Plaintext keys never leave the server.

const PROVIDER = "openai";

type Owner = { kind: "user"; id: string } | { kind: "household"; id: string };

const aadFor = (owner: Owner) => `${PROVIDER}:${owner.kind}:${owner.id}`;
const ownerColumn = (owner: Owner) => (owner.kind === "user" ? "user_id" : "household_id");
const ownerFields = (owner: Owner) =>
  owner.kind === "user" ? { user_id: owner.id, household_id: null } : { user_id: null, household_id: owner.id };

export type KeyInfo = { last4: string; updatedAt: string };

export async function getKeyInfo(owner: Owner): Promise<KeyInfo | null> {
  const { data, error } = await createAdminClient()
    .from("api_keys")
    .select("last4, updated_at")
    .eq("provider", PROVIDER)
    .eq(ownerColumn(owner), owner.id)
    .maybeSingle();
  if (error) throw error;
  return data && { last4: data.last4, updatedAt: data.updated_at };
}

export async function saveKey(owner: Owner, plaintext: string) {
  const { error } = await createAdminClient()
    .from("api_keys")
    .upsert(
      {
        provider: PROVIDER,
        ...ownerFields(owner),
        ciphertext: encryptSecret(plaintext, aadFor(owner)),
        last4: plaintext.slice(-4),
      },
      { onConflict: `provider,${ownerColumn(owner)}` },
    );
  if (error) throw error;
}

export async function deleteKey(owner: Owner) {
  const { error } = await createAdminClient()
    .from("api_keys")
    .delete()
    .eq("provider", PROVIDER)
    .eq(ownerColumn(owner), owner.id);
  if (error) throw error;
}

async function readKey(owner: Owner): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from("api_keys")
    .select("ciphertext")
    .eq("provider", PROVIDER)
    .eq(ownerColumn(owner), owner.id)
    .maybeSingle();
  if (error) throw error;
  return data && decryptSecret(data.ciphertext, aadFor(owner));
}

export type ResolvedKey = { key: string; source: "user" } | { key: string; source: "household"; householdId: string };

/** The user's own key wins; otherwise the key of the household they belong to. */
export async function resolveOpenAIKey(userId: string): Promise<ResolvedKey | null> {
  const own = await readKey({ kind: "user", id: userId });
  if (own) return { key: own, source: "user" };

  const { data: membership, error } = await createAdminClient()
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership) return null;

  const shared = await readKey({ kind: "household", id: membership.household_id });
  return shared ? { key: shared, source: "household", householdId: membership.household_id } : null;
}

export async function validateOpenAIKey(key: string): Promise<"ok" | "invalid" | "unreachable"> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return "ok";
    return res.status === 401 || res.status === 403 ? "invalid" : "unreachable";
  } catch {
    return "unreachable";
  }
}
