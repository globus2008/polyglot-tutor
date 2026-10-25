import { describe, expect, it } from "vitest";
import { allowedLessonMinutes } from "./usage";

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
