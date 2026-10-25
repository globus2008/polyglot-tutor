import { describe, expect, it } from "vitest";
import { newCard, Rating, review } from "./srs";

const now = new Date("2026-10-25T10:00:00Z");

describe("srs", () => {
  it("creates a card due now", () => {
    expect(newCard(now).due).toBe(now.toISOString());
  });

  it("pushes the next review out after a good answer and keeps it close after a miss", () => {
    const good = review(newCard(now), Rating.Good, now);
    const again = review(newCard(now), Rating.Again, now);
    expect(new Date(good.due).getTime()).toBeGreaterThan(new Date(again.due).getTime());
    expect((good.fsrs as { reps: number }).reps).toBe(1);
  });

  it("round-trips through storage across several reviews", () => {
    let card = newCard(now);
    let at = now;
    for (let i = 0; i < 4; i++) {
      card = review(card, Rating.Good, at);
      at = new Date(card.due);
    }
    expect((card.fsrs as { reps: number }).reps).toBe(4);
    // intervals grow: last due is weeks away
    expect(new Date(card.due).getTime() - now.getTime()).toBeGreaterThan(14 * 24 * 3600 * 1000);
  });
});
