import { CEFR_CODES, type CefrLevel } from "./languages";

// Pure progress helpers for the dashboard.

const TIME_ZONE = "Europe/Prague";

/** Calendar day (YYYY-MM-DD) in the learners' time zone. */
export function localDay(date: Date, timeZone = TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days with practice, ending today – or yesterday, so the streak doesn't
 * look lost before today's practice.
 */
export function computeStreak(activity: Date[], now = new Date(), timeZone = TIME_ZONE): number {
  const days = new Set(activity.map((d) => localDay(d, timeZone)));
  let day = localDay(now, timeZone);
  if (!days.has(day)) day = previousDay(day);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = previousDay(day);
  }
  return streak;
}

/**
 * Suggests a new level when the last three analysed lessons agree on an estimate that
 * differs from the profile level. Estimates are newest first; nulls are skipped.
 */
export function suggestLevel(estimates: (string | null)[], current: CefrLevel): CefrLevel | null {
  const recent = estimates.filter((e): e is CefrLevel => CEFR_CODES.includes(e as CefrLevel)).slice(0, 3);
  if (recent.length < 3) return null;
  if (!recent.every((e) => e === recent[0])) return null;
  return recent[0] === current ? null : recent[0];
}
