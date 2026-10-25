"use server";

import { revalidatePath } from "next/cache";
import { deleteKey, saveKey, validateOpenAIKey } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/auth";

export type KeyState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveApiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const user = await getCurrentUser();
  const key = String(formData.get("api_key") ?? "").trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(key)) {
    return { status: "error", message: "Tohle nevypadá jako OpenAI klíč (začíná „sk-“)." };
  }

  const check = await validateOpenAIKey(key);
  if (check === "invalid") return { status: "error", message: "OpenAI klíč odmítlo – zkontrolujte, že je platný." };
  if (check === "unreachable") return { status: "error", message: "Nepodařilo se ověřit klíč u OpenAI, zkuste to znovu." };

  await saveKey({ kind: "user", id: user.id }, key);
  revalidatePath("/settings");
  return { status: "saved", message: "Klíč je ověřený a uložený šifrovaně." };
}

export async function removeApiKey() {
  const user = await getCurrentUser();
  await deleteKey({ kind: "user", id: user.id });
  revalidatePath("/settings");
}
