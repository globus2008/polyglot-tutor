import { describe, expect, it } from "vitest";
import type { LessonPlan } from "./planner";
import { buildRealtimeSession, buildTutorInstructions, type TutorProfile } from "./tutor-prompt";

const profile: TutorProfile = {
  language: "es",
  cefr_level: "A2",
  native_lang: "cs",
  interests: ["music", "travel"],
  goals: "Dovolená v Andalusii",
  tutor_initiative: "lead",
  turn_mode: "auto",
  end_of_turn_pause_ms: 2000,
  idle_prompt_s: 15,
};

const emptyPlan: LessonPlan = { topic: null, grammar: null, mistakes: [], vocab: [], recentSummaries: [] };

describe("buildTutorInstructions", () => {
  it("includes level, interests, goals and the lesson plan", () => {
    const plan: LessonPlan = {
      topic: { id: "es-a2-doctor", title: "At the doctor's", title_cs: "U lékaře", scenario: "Role-play symptoms." },
      grammar: "pretérito indefinido",
      mistakes: [
        {
          id: "m1",
          pattern_key: "ser_estar",
          original: "soy cansado",
          corrected: "estoy cansado",
          explanation: "stav = estar",
          occurrences: 3,
        },
      ],
      vocab: [{ id: "v1", term: "la receta", translation: "recept" }],
      recentSummaries: ["Ordered tapas in Seville"],
    };
    const text = buildTutorInstructions(profile, { plan, maxMinutes: 15 });
    expect(text).toContain("Spanish");
    expect(text).toContain("A2");
    expect(text).toContain("music, travel");
    expect(text).toContain("Dovolená v Andalusii");
    expect(text).toContain("Topic: At the doctor's – Role-play symptoms.");
    expect(text).toContain("Grammar to practise: pretérito indefinido");
    expect(text).toContain("la receta (recept)");
    expect(text).toContain('"soy cansado" → "estoy cansado"');
    expect(text).toContain("- Ordered tapas in Seville");
    expect(text).toContain("15 minutes");
  });

  it("makes a leading tutor propose topics and offer answer options", () => {
    const text = buildTutorInstructions(profile, { plan: emptyPlan, maxMinutes: 15 });
    expect(text).toContain("never wait for them to come up with topics");
    expect(text).toContain("offer two or three possible answers");
    expect(text).toContain("first lesson in this language");
  });

  it("only suggests the planned topic when the learner leads", () => {
    const plan = { ...emptyPlan, topic: { id: "x", title: "T", title_cs: "T", scenario: "S" } };
    const text = buildTutorInstructions({ ...profile, tutor_initiative: "follow" }, { plan, maxMinutes: 15 });
    expect(text).toContain("Offer it as a suggestion");
  });

  it("tells the tutor to wait when idle help is off", () => {
    const text = buildTutorInstructions({ ...profile, idle_prompt_s: 0 }, { plan: emptyPlan, maxMinutes: 15 });
    expect(text).toContain("If they are silent, wait.");
  });

  it("explains in the learner's native language", () => {
    const text = buildTutorInstructions({ ...profile, native_lang: "de" }, { plan: emptyPlan, maxMinutes: 15 });
    expect(text).toContain("native language is German");
    expect(text).not.toContain("Czech");
  });

  it("names the target language", () => {
    const text = buildTutorInstructions({ ...profile, language: "ru" }, { plan: emptyPlan, maxMinutes: 15 });
    expect(text).toContain("Russian conversation tutor");
  });
});

describe("buildRealtimeSession", () => {
  it("maps the pause and idle help onto server VAD", () => {
    const session = buildRealtimeSession(profile, "gpt-realtime-2.1-mini", "x");
    expect(session.audio.input.turn_detection).toMatchObject({
      type: "server_vad",
      silence_duration_ms: 2000,
      idle_timeout_ms: 15000,
    });
    expect(session.audio.output.speed).toBeLessThan(1);
    expect(session.tools[0].name).toBe("log_correction");
  });

  it("disables idle timeout when set to never", () => {
    const session = buildRealtimeSession({ ...profile, idle_prompt_s: 0 }, "gpt-realtime-2.1", "x");
    expect(session.audio.input.turn_detection).toMatchObject({ idle_timeout_ms: null });
  });

  it("turns VAD off for push-to-talk", () => {
    const session = buildRealtimeSession({ ...profile, turn_mode: "push_to_talk" }, "gpt-realtime-2.1", "x");
    expect(session.audio.input.turn_detection).toBeNull();
  });
});
