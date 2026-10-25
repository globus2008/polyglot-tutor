import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps relative paths", () => {
    expect(safeNext("/settings?tab=key")).toBe("/settings?tab=key");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example", "settings"])(
    "falls back for %s",
    (value) => {
      expect(safeNext(value)).toBe("/");
    },
  );
});
