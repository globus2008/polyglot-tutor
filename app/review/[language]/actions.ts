"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { Rating, review } from "@/lib/srs";
import { createClient } from "@/lib/supabase/server";

const rateSchema = z.object({
  id: z.uuid(),
  rating: z.union([z.literal(Rating.Again), z.literal(Rating.Hard), z.literal(Rating.Good), z.literal(Rating.Easy)]),
});

/** Schedules the next review of a word; returns its new due date. */
export async function rateWord(id: string, rating: number): Promise<{ due: string } | { error: string }> {
  const parsed = rateSchema.safeParse({ id, rating });
  if (!parsed.success) return { error: "Neplatné hodnocení." };
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: word } = await supabase
    .from("vocab_items")
    .select("due, fsrs")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!word) return { error: "Slovíčko nenalezeno." };

  const next = review(word, parsed.data.rating);
  const { error } = await supabase.from("vocab_items").update(next).eq("id", parsed.data.id);
  if (error) return { error: "Uložení se nepovedlo." };
  return { due: next.due };
}

export async function deleteWord(id: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(id).success) return { ok: false };
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("vocab_items").delete().eq("id", id).eq("user_id", user.id);
  return { ok: !error };
}
