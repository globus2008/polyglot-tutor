// Options for how the voice tutor behaves. Stored per learner profile (language) because
// the same person usually needs more time in a weaker language. Labels are in the i18n
// dictionaries.

export const TUTOR_INITIATIVE_CODES = ["lead", "balanced", "follow"] as const;
export type TutorInitiative = (typeof TUTOR_INITIATIVE_CODES)[number];

export const TURN_MODE_CODES = ["auto", "push_to_talk"] as const;
export type TurnMode = (typeof TURN_MODE_CODES)[number];

/** Silence (ms) before the tutor takes the turn in auto mode. */
export const END_OF_TURN_PAUSE = { min: 500, max: 4000, step: 250, default: 1500 } as const;

/** Silence (s) after which the tutor helps out; 0 disables it. */
export const IDLE_PROMPT_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60] as const;
export const IDLE_PROMPT_DEFAULT = 10;

export const DEFAULT_CONVERSATION_STYLE = {
  tutor_initiative: "lead" as TutorInitiative,
  turn_mode: "auto" as TurnMode,
  end_of_turn_pause_ms: END_OF_TURN_PAUSE.default,
  idle_prompt_s: IDLE_PROMPT_DEFAULT,
};
