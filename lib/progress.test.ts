import { describe, expect, it } from "vitest";
import { computeStreak, localDay, suggestLevel } from "./progress";

const now = new Date("2026-10-25T10:00:00Z");
const daysAgo = (n: number, hour = 10) => new Date(Date.UTC(2026, 9, 25 - n, hour));

describe("localDay", () => {
  it("uses Prague time", () => {
    // 23:30 UTC on 24 Oct is already 25 Oct in Prague (CEST / CET)
    expect(localDay(new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25");
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak([daysAgo(0), daysAgo(1), daysAgo(1, 15), daysAgo(2)], now)).toBe(3);
  });

  it("keeps yesterday's streak alive before practising today", () => {
    expect(computeStreak([daysAgo(1), daysAgo(2)], now)).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(computeStreak([daysAgo(0), daysAgo(2), daysAgo(3)], now)).toBe(1);
    expect(computeStreak([daysAgo(2)], now)).toBe(0);
    expect(computeStreak([], now)).toBe(0);
  });
});

describe("suggestLevel", () => {
  it("suggests a level the last three lessons agree on", () => {
    expect(suggestLevel(["B1", "B1", null, "B1", "A2"], "A2")).toBe("B1");
  });

  it("stays quiet without agreement, with too few lessons, or when it matches", () => {
    expect(suggestLevel(["B1", "A2", "B1"], "A2")).toBeNull();
    expect(suggestLevel(["B1", "B1"], "A2")).toBeNull();
    expect(suggestLevel(["A2", "A2", "A2"], "A2")).toBeNull();
  });
});
