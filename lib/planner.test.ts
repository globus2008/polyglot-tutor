import { describe, expect, it } from "vitest";
import { GRAMMAR } from "./curriculum";
import { pickGrammar, pickTopic, planLesson, type PlannerInput, type PlannerTopic } from "./planner";

const topic = (id: string, cefr_level: string, tags: string[] = []): PlannerTopic => ({
  id,
  cefr_level,
  title: id,
  title_cs: id,
  scenario: `scenario ${id}`,
  tags,
});

const base: PlannerInput = {
  language: "es",
  level: "A2",
  interests: [],
  topics: [topic("a1-x", "A1"), topic("a2-x", "A2"), topic("b1-x", "B1"), topic("a2-music", "A2", ["hudba"])],
  recentLessons: [],
  openMistakes: [],
  dueVocab: [],
  random: () => 0.5,
};

describe("pickTopic", () => {
  it("stays within the learner's level and the one below", () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickTopic({ ...base, random: () => i / 20 });
      expect(["a1-x", "a2-x", "a2-music"]).toContain(picked?.id);
    }
  });

  it("avoids topics from recent lessons", () => {
    const recentLessons = ["a2-x", "a2-music"].map((id) => ({ topic_id: id, summary: null, grammar: null }));
    for (let i = 0; i < 10; i++) {
      expect(pickTopic({ ...base, recentLessons, random: () => i / 10 })?.id).toBe("a1-x");
    }
  });

  it("falls back to older topics when everything was covered recently", () => {
    const recentLessons = ["a1-x", "a2-x", "a2-music"].map((id) => ({ topic_id: id, summary: null, grammar: null }));
    expect(pickTopic({ ...base, recentLessons })).not.toBeNull();
  });

  it("prefers topics matching interests", () => {
    let music = 0;
    for (let i = 0; i < 100; i++) {
      if (pickTopic({ ...base, interests: ["hudba"], random: () => i / 100 })?.id === "a2-music") music++;
    }
    // weights: a1-x 1, a2-x 1.5, a2-music 4.5 → 64 %
    expect(music).toBeGreaterThan(55);
  });
});

describe("pickGrammar", () => {
  const points = GRAMMAR.es.A2;

  it("starts with a point never practised", () => {
    expect(pickGrammar(base)).toBe(points[0]);
    const recentLessons = [{ topic_id: null, summary: null, grammar: points[0] }];
    expect(pickGrammar({ ...base, recentLessons })).toBe(points[1]);
  });

  it("then repeats the one practised longest ago", () => {
    const recentLessons = points.map((grammar) => ({ topic_id: null, summary: null, grammar }));
    expect(pickGrammar({ ...base, recentLessons })).toBe(points[points.length - 1]);
  });
});

describe("planLesson", () => {
  it("caps mistakes and vocabulary and keeps the latest summaries", () => {
    const plan = planLesson({
      ...base,
      openMistakes: Array.from({ length: 5 }, (_, i) => ({
        id: `m${i}`,
        pattern_key: `k${i}`,
        original: "o",
        corrected: "c",
        explanation_cs: "e",
        occurrences: 5 - i,
      })),
      dueVocab: Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, term: `t${i}`, translation: "x" })),
      recentLessons: ["s1", null, "s2", "s3", "s4"].map((summary) => ({ topic_id: null, summary, grammar: null })),
    });
    expect(plan.mistakes.map((m) => m.id)).toEqual(["m0", "m1", "m2"]);
    expect(plan.vocab).toHaveLength(8);
    expect(plan.recentSummaries).toEqual(["s1", "s2", "s3"]);
  });
});
