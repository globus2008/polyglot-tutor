import "server-only";
import { callTextModel } from "./analysis";
import { resolveOpenAIKey } from "./api-keys";
import { LANGUAGES, NATIVE_LANGUAGES, type Language, type NativeLanguage } from "./languages";
import { createAdminClient } from "./supabase/server";

// Translations and explanations are written in the native language set at the time of the
// lesson. When the learner changes it later, review re-translates the stale ones once.

type Word = { id: string; term: string; translation: string; example: string; translation_lang: string | null };
type Mistake = { id: string; original: string; corrected: string; explanation: string; explanation_lang: string | null };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["words", "mistakes"],
  properties: {
    words: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "translation"],
        properties: { id: { type: "string" }, translation: { type: "string" } },
      },
    },
    mistakes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "explanation"],
        properties: { id: { type: "string" }, explanation: { type: "string" } },
      },
    },
  },
};

/** Returns the items with translations and explanations in `native`, translating and saving stale ones. */
export async function localizeReviewItems<W extends Word, M extends Mistake>(
  userId: string,
  language: Language,
  native: NativeLanguage,
  words: W[],
  mistakes: M[],
): Promise<{ words: W[]; mistakes: M[] }> {
  const staleWords = words.filter((w) => w.translation_lang !== native);
  const staleMistakes = mistakes.filter((m) => m.explanation_lang !== native);
  if (!staleWords.length && !staleMistakes.length) return { words, mistakes };

  const key = await resolveOpenAIKey(userId);
  if (!key) return { words, mistakes };

  const target = NATIVE_LANGUAGES[native];
  const prompt = `The learner studies ${LANGUAGES[language].english}; their native language is ${target}.
1. For each word, give a short dictionary-style ${target} translation of the ${LANGUAGES[language].english} term (the old translation and example are only context; they may be in another language).
2. For each mistake, rewrite the explanation in ${target}, keeping its meaning and brevity.
Return every id unchanged.

Words:
${staleWords.map((w) => JSON.stringify({ id: w.id, term: w.term, old_translation: w.translation, example: w.example })).join("\n") || "none"}

Mistakes:
${staleMistakes.map((m) => JSON.stringify({ id: m.id, original: m.original, corrected: m.corrected, explanation: m.explanation })).join("\n") || "none"}`;

  let result: { words: { id: string; translation: string }[]; mistakes: { id: string; explanation: string }[] };
  try {
    result = await callTextModel(key.key, userId, prompt, {
      name: "review_translation",
      schema,
      system: "You are a precise translator for a language-learning app.",
    });
  } catch (error) {
    console.error("Review translation failed", error);
    return { words, mistakes };
  }

  const translations = new Map(
    result.words.filter((w) => staleWords.some((s) => s.id === w.id) && w.translation.trim()).map((w) => [w.id, w.translation.trim()]),
  );
  const explanations = new Map(
    result.mistakes
      .filter((m) => staleMistakes.some((s) => s.id === m.id) && m.explanation.trim())
      .map((m) => [m.id, m.explanation.trim()]),
  );

  const db = createAdminClient();
  await Promise.all([
    ...[...translations].map(([id, translation]) =>
      db.from("vocab_items").update({ translation, translation_lang: native }).eq("id", id).eq("user_id", userId),
    ),
    ...[...explanations].map(([id, explanation]) =>
      db.from("mistakes").update({ explanation, explanation_lang: native }).eq("id", id).eq("user_id", userId),
    ),
  ]);

  return {
    words: words.map((w) => (translations.has(w.id) ? { ...w, translation: translations.get(w.id)!, translation_lang: native } : w)),
    mistakes: mistakes.map((m) =>
      explanations.has(m.id) ? { ...m, explanation: explanations.get(m.id)!, explanation_lang: native } : m,
    ),
  };
}
