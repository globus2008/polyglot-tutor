// Options for how the voice tutor behaves. Stored per learner profile (language) because
// the same person usually needs more time in a weaker language.

export const TUTOR_INITIATIVE = {
  lead: {
    label: "Lektor vede rozhovor",
    description: "Sám nabízí témata a otázky, při zaváhání napoví slovíčka nebo dá na výběr z několika odpovědí.",
  },
  balanced: {
    label: "Vyváženě",
    description: "Lektor navrhne téma a ptá se, ale nechává vás rozhovor rozvíjet.",
  },
  follow: {
    label: "Vedu já",
    description: "Lektor reaguje na to, o čem chcete mluvit, a sám přichází s náměty jen když je potřeba.",
  },
} as const;

export type TutorInitiative = keyof typeof TUTOR_INITIATIVE;
export const TUTOR_INITIATIVE_CODES = Object.keys(TUTOR_INITIATIVE) as TutorInitiative[];

export const TURN_MODES = {
  auto: {
    label: "Automaticky",
    description: "Lektor pozná, že jste domluvili, podle pauzy v řeči.",
  },
  push_to_talk: {
    label: "Tlačítkem",
    description: "Lektor nikdy neskočí do řeči – svůj tah ukončíte tlačítkem, i když přemýšlíte dlouho.",
  },
} as const;

export type TurnMode = keyof typeof TURN_MODES;
export const TURN_MODE_CODES = Object.keys(TURN_MODES) as TurnMode[];

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
