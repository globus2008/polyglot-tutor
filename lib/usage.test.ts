import { describe, expect, it } from "vitest";
import { allowedLessonMinutes, estimateCost } from "./usage";

describe("allowedLessonMinutes", () => {
  it("caps at the normal lesson length", () => {
    expect(allowedLessonMinutes(30, 0, 15)).toBe(15);
  });

  it("shortens the lesson to what is left today", () => {
    expect(allowedLessonMinutes(30, 22 * 60 + 30, 15)).toBe(7);
  });

  it("blocks when less than two minutes are left or the limit is zero", () => {
    expect(allowedLessonMinutes(30, 28 * 60 + 30, 15)).toBe(0);
    expect(allowedLessonMinutes(30, 40 * 60, 15)).toBe(0);
    expect(allowedLessonMinutes(0, 0, 15)).toBe(0);
  });
});

describe("estimateCost", () => {
  it("prices minutes by model and assumes the pricier one when unknown", () => {
    const cost = estimateCost([
      { duration_s: 600, model: "gpt-realtime-2.1-mini" },
      { duration_s: 60, model: null },
      { duration_s: null, model: "gpt-realtime-2.1" },
    ]);
    expect(cost).toBeCloseTo(10 * 0.025 + 0.07);
  });
});
