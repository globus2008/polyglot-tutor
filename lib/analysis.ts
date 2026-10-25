import "server-only";
import { createHash } from "node:crypto";
import { resolveOpenAIKey } from "./api-keys";
import { CEFR_CODES, type Language } from "./languages";
import type { LessonPlan } from "./planner";
import { newCard, Rating, review } from "./srs";
import { createAdminClient } from "./supabase/server";
import type { Correction } from "./tutor-prompt";

// Post-lesson analysis: a text model turns the transcript into structured memory
// (mistake patterns, vocabulary, summary), which the planner uses for the next lesson.

export const ANALYSIS_MODEL = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-5.4-mini";

/** Lessons in a row where a targeted mistake did not recur before it counts as mastered. */
const MASTERY_CLEAN_LESSONS = 2;

const CATEGORIES = ["grammar", "vocabulary", "word_order", "verb_tense", "agreement", "preposition", "phrasing", "other"];

const LANGUAGE_NAME_EN: Record<Language, string> = {
  es: "Spanish",
  en: "English",
  de: "German",
  it: "Italian",
  fr: "French",
  ru: "Russian",
};

export type LessonAnalysis = {
  summary: string;
  summary_cs: string;
  strengths_cs: string;
  next_focus_cs: string;
  cefr_estimate: string | null;
  mistakes: { pattern_key: string; original: string; corrected: string; category: string; explanation_cs: string }[];
  new_vocabulary: { term: string; translation_cs: string; example: string }[];
  reviewed_vocabulary: { term: string; result: "used_correctly" | "struggled" | "not_used" }[];
};

/** What the lesson page shows; stored in lessons.analysis. */
export type StoredAnalysis = Omit<LessonAnalysis, "summary" | "reviewed_vocabulary" | "mistakes"> & {
  mistakes: (LessonAnalysis["mistakes"][number] & { recurring: boolean })[];
  mastered: string[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "summary_cs",
    "strengths_cs",
    "next_focus_cs",
    "cefr_estimate",
    "mistakes",
    "new_vocabulary",
    "reviewed_vocabulary",
  ],
  properties: {
    summary: {
      type: "string",
      description: "One English sentence: what the conversation was about and what was practised. Used as memory for later lessons.",
    },
    summary_cs: { type: "string", description: "2–3 friendly sentences in Czech for the learner summarising the lesson." },
    strengths_cs: { type: "string", description: "One sentence in Czech: what the learner did well." },
    next_focus_cs: { type: "string", description: "One sentence in Czech: what to focus on next time." },
    cefr_estimate: { type: ["string", "null"], enum: [...CEFR_CODES, null] },
    mistakes: {
      type: "array",
      description: "Distinct meaningful mistakes of the learner (max 8), one per pattern.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pattern_key", "original", "corrected", "category", "explanation_cs"],
        properties: {
          pattern_key: {
            type: "string",
            description:
              "Stable lowercase snake_case id of the general rule, not of the specific word – so the same kind of mistake gets the same key across lessons. E.g. past_simple_irregular_verbs (not past_simple_go), ser_vs_estar_states, article_before_singular_noun. Reuse an existing key whenever it is the same rule.",
          },
          original: { type: "string" },
          corrected: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          explanation_cs: { type: "string", description: "One short sentence in Czech explaining the rule." },
        },
      },
    },
    new_vocabulary: {
      type: "array",
      description:
        "Up to 10 words or phrases worth learning: ones the learner did not know (asked for, said in Czech, avoided) or got wrong, and new expressions the tutor introduced that are above the learner's level. Skip words the learner already used correctly and basic words of their level. Dictionary form.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "translation_cs", "example"],
        properties: {
          term: { type: "string" },
          translation_cs: { type: "string" },
          example: { type: "string", description: "Short example sentence in the target language." },
        },
      },
    },
    reviewed_vocabulary: {
      type: "array",
      description: "For each planned review word: did the learner use it correctly, struggle, or not use it?",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "result"],
        properties: {
          term: { type: "string" },
          result: { type: "string", enum: ["used_correctly", "struggled", "not_used"] },
        },
      },
    },
  },
} as const;

type TranscriptLine = { role: "user" | "assistant"; text: string };

function buildPrompt(input: {
  language: Language;
  level: string;
  plan: LessonPlan | undefined;
  openPatternKeys: string[];
  corrections: Correction[];
  transcript: TranscriptLine[];
}) {
  const { plan } = input;
  const lines = input.transcript.map((l) => `${l.role === "user" ? "Learner" : "Tutor"}: ${l.text}`).join("\n");
  return `Analyse this ${LANGUAGE_NAME_EN[input.language]} conversation lesson. The learner is Czech, level ${input.level}.

Planned topic: ${plan?.topic?.title ?? "free conversation"}
Planned grammar: ${plan?.grammar ?? "none"}
Planned review words: ${plan?.vocab.map((v) => v.term).join(", ") || "none"}
Learner's existing mistake pattern keys (reuse them for the same pattern): ${input.openPatternKeys.join(", ") || "none"}
Corrections the tutor flagged during the lesson (hints, may contain duplicates): ${
    input.corrections.map((c) => `"${c.original}" → "${c.corrected}"`).join("; ") || "none"
  }

Only judge what the learner said; speech-to-text may contain small transcription errors – ignore those and anything that is only pronunciation. Czech words used by the learner are not mistakes but may indicate vocabulary to learn.

Transcript:
${lines}`;
}

async function callModel(apiKey: string, userId: string, prompt: string): Promise<LessonAnalysis> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": createHash("sha256").update(userId).digest("hex"),
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      input: [
        { role: "system", content: "You are an experienced language teacher who writes precise, encouraging feedback." },
        { role: "user", content: prompt },
      ],
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "lesson_analysis", strict: true, schema } },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message ?? res.statusText}`);
  const text = (body?.output ?? [])
    .flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === "output_text")?.text;
  if (!text) throw new Error("Empty analysis response");
  return JSON.parse(text) as LessonAnalysis;
}

/**
 * Analyses a finished lesson once (claims it by switching finished → analyzing) and stores
 * the results. Safe to call repeatedly; returns false when another call already owns it.
 */
export async function analyzeLesson(lessonId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: lesson } = await db
    .from("lessons")
    .update({ status: "analyzing" })
    .eq("id", lessonId)
    .eq("status", "finished")
    .select("id, user_id, language, transcript, corrections, plan")
    .maybeSingle();
  if (!lesson) return false;

  const language = lesson.language as Language;
  const transcript = (lesson.transcript as TranscriptLine[]) ?? [];
  const plan = (lesson.plan as { lesson?: LessonPlan }).lesson;

  try {
    if (transcript.filter((l) => l.role === "user" && l.text.trim()).length < 2) {
      await db
        .from("lessons")
        .update({
          status: "analyzed",
          analysis: { short: true, summary_cs: "Lekce byla příliš krátká na vyhodnocení." },
        })
        .eq("id", lessonId);
      return true;
    }

    const [key, { data: profile }, { data: openMistakes }] = await Promise.all([
      resolveOpenAIKey(lesson.user_id),
      db.from("learner_profiles").select("cefr_level").eq("user_id", lesson.user_id).eq("language", language).maybeSingle(),
      db
        .from("mistakes")
        .select("id, pattern_key, occurrences, clean_lessons")
        .eq("user_id", lesson.user_id)
        .eq("language", language),
    ]);
    if (!key) throw new Error("Chybí API klíč");

    const analysis = await callModel(
      key.key,
      lesson.user_id,
      buildPrompt({
        language,
        level: profile?.cefr_level ?? "unknown",
        plan,
        openPatternKeys: (openMistakes ?? []).map((m) => m.pattern_key).filter((k): k is string => Boolean(k)),
        corrections: (lesson.corrections as Correction[]) ?? [],
        transcript,
      }),
    );

    const stored = await applyAnalysis(lesson.user_id, language, lessonId, plan, analysis, openMistakes ?? []);
    await db
      .from("lessons")
      .update({ status: "analyzed", summary: analysis.summary, analysis: stored })
      .eq("id", lessonId);
    return true;
  } catch (error) {
    console.error("Lesson analysis failed", lessonId, error);
    await db
      .from("lessons")
      .update({ status: "finished", analysis: { error: "Vyhodnocení lekce se nepovedlo." } })
      .eq("id", lessonId);
    return false;
  }
}

async function applyAnalysis(
  userId: string,
  language: Language,
  lessonId: string,
  plan: LessonPlan | undefined,
  analysis: LessonAnalysis,
  existing: { id: string; pattern_key: string | null; occurrences: number; clean_lessons: number }[],
): Promise<StoredAnalysis> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const byKey = new Map(existing.filter((m) => m.pattern_key).map((m) => [m.pattern_key!, m]));
  const seenKeys = new Set<string>();

  // mistakes: one row per pattern, counting recurrences
  const mistakes: StoredAnalysis["mistakes"] = [];
  for (const m of analysis.mistakes.slice(0, 8)) {
    const key = m.pattern_key.trim().toLowerCase().replace(/[^a-z0-9_:]+/g, "_").slice(0, 80);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    const row = byKey.get(key);
    const fields = {
      original: m.original,
      corrected: m.corrected,
      category: m.category,
      explanation_cs: m.explanation_cs,
      lesson_id: lessonId,
      last_seen_at: now,
      clean_lessons: 0,
      mastered_at: null,
    };
    if (row) {
      await db.from("mistakes").update({ ...fields, occurrences: row.occurrences + 1 }).eq("id", row.id);
    } else {
      await db.from("mistakes").insert({ ...fields, user_id: userId, language, pattern_key: key });
    }
    mistakes.push({ ...m, pattern_key: key, recurring: Boolean(row) });
  }

  // targeted mistakes that did not recur move towards mastery
  const mastered: string[] = [];
  for (const target of plan?.mistakes ?? []) {
    if (!target.pattern_key || seenKeys.has(target.pattern_key)) continue;
    const row = byKey.get(target.pattern_key);
    if (!row) continue;
    const clean = row.clean_lessons + 1;
    const done = clean >= MASTERY_CLEAN_LESSONS;
    await db
      .from("mistakes")
      .update({ clean_lessons: clean, mastered_at: done ? now : null })
      .eq("id", row.id);
    if (done) mastered.push(target.corrected);
  }

  // vocabulary: new words become cards; planned words are reviewed by how the learner did
  const { data: knownRows } = await db
    .from("vocab_items")
    .select("id, term, due, fsrs")
    .eq("user_id", userId)
    .eq("language", language);
  const known = new Map((knownRows ?? []).map((v) => [v.term.toLowerCase(), v]));

  const fresh = analysis.new_vocabulary
    .slice(0, 10)
    .filter((v, i, all) => v.term.trim() && !known.has(v.term.toLowerCase()) && all.findIndex((x) => x.term.toLowerCase() === v.term.toLowerCase()) === i)
    .map((v) => ({
      user_id: userId,
      language,
      lesson_id: lessonId,
      term: v.term.trim(),
      translation: v.translation_cs,
      example: v.example,
      ...newCard(),
    }));
  if (fresh.length) await db.from("vocab_items").insert(fresh);

  for (const r of analysis.reviewed_vocabulary) {
    if (r.result === "not_used") continue;
    const row = known.get(r.term.toLowerCase());
    if (!row) continue;
    const next = review(row, r.result === "used_correctly" ? Rating.Good : Rating.Again);
    await db.from("vocab_items").update(next).eq("id", row.id);
  }

  return {
    summary_cs: analysis.summary_cs,
    strengths_cs: analysis.strengths_cs,
    next_focus_cs: analysis.next_focus_cs,
    cefr_estimate: analysis.cefr_estimate,
    mistakes,
    new_vocabulary: fresh.map((v) => ({ term: v.term, translation_cs: v.translation, example: v.example })),
    mastered,
  };
}
