import { describe, expect, it } from "vitest";
import { localePath, matchLocale } from "./locales";

describe("matchLocale", () => {
  it("picks Czech for Czech and Slovak browsers", () => {
    expect(matchLocale("cs-CZ,cs;q=0.9,en;q=0.8")).toBe("cs");
    expect(matchLocale("sk-SK,sk;q=0.9")).toBe("cs");
  });

  it("respects quality values", () => {
    expect(matchLocale("en;q=0.5,cs;q=0.9")).toBe("cs");
    expect(matchLocale("de-DE,en;q=0.7,cs;q=0.3")).toBe("en");
  });

  it("falls back to English", () => {
    expect(matchLocale("ja-JP")).toBe("en");
    expect(matchLocale(null)).toBe("en");
    expect(matchLocale("")).toBe("en");
  });
});

describe("localePath", () => {
  it("prefixes paths", () => {
    expect(localePath("cs", "/")).toBe("/cs");
    expect(localePath("en", "/review/es")).toBe("/en/review/es");
  });
});
