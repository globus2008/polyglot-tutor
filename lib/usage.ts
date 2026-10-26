/** Below this many minutes left today a new lesson isn't worth starting. */
export const MIN_LESSON_MINUTES = 2;

/**
 * Minutes the next lesson may last on a shared household key: what is left of the
 * daily limit, capped at the normal lesson length. 0 means the limit is used up.
 */
export function allowedLessonMinutes(dailyLimitMinutes: number, usedSeconds: number, maxLessonMinutes: number): number {
  const left = Math.floor((dailyLimitMinutes * 60 - usedSeconds) / 60);
  if (left < MIN_LESSON_MINUTES) return 0;
  return Math.min(left, maxLessonMinutes);
}

/**
 * Rough OpenAI cost of one lesson minute in USD per voice model: audio in and out, the growing
 * conversation context (mostly cached) and transcription. Only for orientation – the exact
 * amount is on the OpenAI usage page.
 */
export const USD_PER_MINUTE: Record<string, number> = {
  "gpt-realtime-2.1-mini": 0.025,
  "gpt-realtime-2.1": 0.07,
};
const CHEAPEST = Math.min(...Object.values(USD_PER_MINUTE));
const PRICIEST = Math.max(...Object.values(USD_PER_MINUTE));

/** Estimated cost of lessons from their length and model. */
export function estimateCost(lessons: { duration_s: number | null; model: string | null }[]): number {
  return lessons.reduce((sum, l) => sum + ((l.duration_s ?? 0) / 60) * (USD_PER_MINUTE[l.model ?? ""] ?? PRICIEST), 0);
}

/** Cost range for minutes whose model is unknown (household usage is booked without it). */
export function estimateCostRange(minutes: number): [number, number] {
  return [minutes * CHEAPEST, minutes * PRICIEST];
}

export function formatUsd(amount: number, intl: string): string {
  return new Intl.NumberFormat(intl, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
}
