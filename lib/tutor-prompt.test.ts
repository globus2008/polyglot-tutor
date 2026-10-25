import { describe, expect, it } from "vitest";
import { buildRealtimeSession, buildTutorInstructions, type TutorProfile } from "./tutor-prompt";

const profile: TutorProfile = {
  language: "es",
  cefr_level: "A2",
  interests: ["hudba", "cestování"],
  goals: "Dovolená v Andalusii",
  tutor_initiative: "lead",
  turn_mode: "auto",
  end_of_turn_pause_ms: 2000,
  idle_prompt_s: 15,
};

describe("buildTutorInstructions", () => {
  it("includes level, interests, goals and recent topics", () => {
    const text = buildTutorInstructions(profile, { recentTopics: ["Ordering tapas"], maxMinutes: 15 });
    expect(text).toContain("Spanish");
    expect(text).toContain("A2");
    expect(text).toContain("hudba, cestování");
    expect(text).toContain("Dovolená v Andalusii");
    expect(text).toContain("- Ordering tapas");
    expect(text).toContain("15 minutes");
  });

  it("makes a leading tutor propose topics and offer answer options", () => {
    const text = buildTutorInstructions(profile, { recentTopics: [], maxMinutes: 15 });
    expect(text).toContain("never wait for them to come up with topics");
    expect(text).toContain("offer two or three possible answers");
  });

  it("tells the tutor to wait when idle help is off", () => {
    const text = buildTutorInstructions({ ...profile, idle_prompt_s: 0 }, { recentTopics: [], maxMinutes: 15 });
    expect(text).toContain("If they are silent, wait.");
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
