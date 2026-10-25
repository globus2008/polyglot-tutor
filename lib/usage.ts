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
