import { grammarPoints } from "./curriculum";
import { CEFR_CODES, type CefrLevel, type Language } from "./languages";

// Decides what the next lesson covers, from the learner's history. Pure: the lesson
// route loads the data and stores the returned plan with the lesson.

export type PlannerTopic = { id: string; cefr_level: string; title: string; title_cs: string; scenario: string; tags: string[] };
export type PlannerLesson = { topic_id: string | null; summary: string | null; grammar: string | null };
export type PlannerMistake = {
  id: string;
  pattern_key: string | null;
  original: string;
  corrected: string;
  explanation: string;
  occurrences: number;
};
export type PlannerVocab = { id: string; term: string; translation: string };

export type LessonPlan = {
  topic: { id: string; title: string; title_cs: string; scenario: string } | null;
  grammar: string | null;
  mistakes: PlannerMistake[];
  vocab: PlannerVocab[];
  recentSummaries: string[];
};

export type PlannerInput = {
  language: Language;
  level: CefrLevel;
  interests: string[];
  topics: PlannerTopic[];
  /** newest first */
  recentLessons: PlannerLesson[];
  /** open mistakes, most important first */
  openMistakes: PlannerMistake[];
  /** due vocabulary, most overdue first */
  dueVocab: PlannerVocab[];
  random?: () => number;
};

const AVOID_RECENT_TOPICS = 10;
const MAX_MISTAKES = 3;
const MAX_VOCAB = 8;
const SUMMARIES = 3;

/** The learner's level and the one below; complete beginners (A0) use A1 topics too. */
function allowedLevels(level: CefrLevel): CefrLevel[] {
  const index = CEFR_CODES.indexOf(level);
  return index === 0 ? [level, CEFR_CODES[1]] : [CEFR_CODES[index - 1], level];
}

function weightedPick<T>(items: { item: T; weight: number }[], random: () => number): T | null {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  if (total <= 0) return null;
  let roll = random() * total;
  for (const { item, weight } of items) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1].item;
}

export function pickTopic(input: PlannerInput): PlannerTopic | null {
  const random = input.random ?? Math.random;
  const levels = allowedLevels(input.level);
  const candidates = input.topics.filter((t) => levels.includes(t.cefr_level as CefrLevel));
  const usedEver = new Set(input.recentLessons.map((l) => l.topic_id).filter(Boolean));

  const pool = (avoid: number) => {
    const recent = new Set(input.recentLessons.slice(0, avoid).map((l) => l.topic_id));
    return candidates.filter((t) => !recent.has(t.id));
  };
  const pools = [pool(AVOID_RECENT_TOPICS), pool(3), candidates];

  // never a topic outside the chosen interests: without a match the tutor improvises one from them
  const interests = new Set(input.interests.map((i) => i.toLowerCase()));
  const matchCount = (t: PlannerTopic) => t.tags.filter((tag) => interests.has(tag.toLowerCase())).length;
  const available = interests.size
    ? (pools.map((p) => p.filter((t) => matchCount(t) > 0)).find((p) => p.length) ?? [])
    : (pools.find((p) => p.length) ?? []);

  return weightedPick(
    available.map((t) => {
      const matches = matchCount(t);
      const fresh = usedEver.has(t.id) ? 0.4 : 1;
      const atLevel = t.cefr_level === input.level ? 1.5 : 1;
      return { item: t, weight: fresh * atLevel * (1 + 2 * matches) };
    }),
    random,
  );
}

/** Least recently practised grammar point of the level. */
export function pickGrammar(input: PlannerInput): string | null {
  const points = grammarPoints(input.language, input.level);
  if (!points.length) return null;
  const lastUsed = new Map<string, number>();
  input.recentLessons.forEach((l, index) => {
    if (l.grammar && !lastUsed.has(l.grammar)) lastUsed.set(l.grammar, index);
  });
  const neverUsed = points.filter((p) => !lastUsed.has(p));
  if (neverUsed.length) return neverUsed[0];
  return [...points].sort((a, b) => lastUsed.get(b)! - lastUsed.get(a)!)[0];
}

export function planLesson(input: PlannerInput): LessonPlan {
  const topic = pickTopic(input);
  return {
    topic: topic && { id: topic.id, title: topic.title, title_cs: topic.title_cs, scenario: topic.scenario },
    grammar: pickGrammar(input),
    mistakes: input.openMistakes.slice(0, MAX_MISTAKES),
    vocab: input.dueVocab.slice(0, MAX_VOCAB),
    recentSummaries: input.recentLessons
      .map((l) => l.summary)
      .filter((s): s is string => Boolean(s))
      .slice(0, SUMMARIES),
  };
}
