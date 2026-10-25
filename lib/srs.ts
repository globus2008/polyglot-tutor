import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import type { Json } from "./supabase/database.types";

// Spaced repetition for vocabulary. vocab_items keeps `due` as a column (for queries)
// and the rest of the ts-fsrs Card in `fsrs` jsonb.

const scheduler = fsrs({ enable_fuzz: true });

export type StoredCard = { due: string; fsrs: { [key: string]: Json | undefined } };

export { Rating };

function serialize(card: Card): StoredCard {
  const { due, last_review, ...rest } = card;
  return {
    due: due.toISOString(),
    fsrs: { ...rest, last_review: last_review ? last_review.toISOString() : null },
  };
}

function deserialize(stored: { due: string; fsrs: Json }): Card {
  const data = (stored.fsrs ?? {}) as Record<string, unknown>;
  if (data.state === undefined) return createEmptyCard(new Date(stored.due));
  return {
    ...(data as unknown as Omit<Card, "due" | "last_review">),
    due: new Date(stored.due),
    last_review: data.last_review ? new Date(String(data.last_review)) : undefined,
  };
}

export function newCard(now = new Date()): StoredCard {
  return serialize(createEmptyCard(now));
}

export function review(stored: { due: string; fsrs: Json }, rating: Grade, now = new Date()): StoredCard {
  return serialize(scheduler.next(deserialize(stored), now, rating).card);
}
