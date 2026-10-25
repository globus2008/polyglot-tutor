import "server-only";
import { createHash } from "node:crypto";

export type ClientSecret = { value: string; expiresAt: number };

export class OpenAIError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Mints a short-lived token the browser uses to open the WebRTC call; the real key stays here. */
export async function createRealtimeClientSecret(apiKey: string, userId: string, session: object): Promise<ClientSecret> {
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // stable, non-reversible user id for OpenAI's abuse monitoring
      "OpenAI-Safety-Identifier": createHash("sha256").update(userId).digest("hex"),
    },
    body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 120 }, session }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new OpenAIError(res.status, body?.error?.message ?? res.statusText);
  }
  const data = await res.json();
  return { value: data.value, expiresAt: data.expires_at };
}

export function describeOpenAIError(error: OpenAIError): string {
  if (error.status === 401) return "OpenAI odmítlo API klíč. Zkontrolujte ho v Nastavení.";
  if (error.status === 429) return "OpenAI hlásí vyčerpaný limit nebo kredit. Zkontrolujte účet na platform.openai.com.";
  if (error.status === 403 || error.status === 404) return "Tento API klíč nemá přístup k hlasovému modelu.";
  return "Spojení s OpenAI se nepodařilo, zkuste to prosím znovu.";
}
