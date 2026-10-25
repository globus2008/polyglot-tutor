import type { TurnMode, TutorInitiative } from "./conversation-style";
import type { CefrLevel, Language } from "./languages";

// Builds the voice tutor's instructions and the Realtime session config.
// Pure functions: the lesson route supplies the learner data.

export type TutorProfile = {
  language: Language;
  cefr_level: CefrLevel;
  interests: string[];
  goals: string;
  tutor_initiative: TutorInitiative;
  turn_mode: TurnMode;
  end_of_turn_pause_ms: number;
  idle_prompt_s: number;
};

export type LessonContext = {
  /** Short descriptions of recent lessons, newest first, so the tutor avoids repeating them. */
  recentTopics: string[];
  maxMinutes: number;
};

export const REALTIME_MODELS = {
  "gpt-realtime-2.1-mini": { label: "Úsporný", description: "Levnější, pro běžné procvičování stačí." },
  "gpt-realtime-2.1": { label: "Nejlepší", description: "Přirozenější hlas a přesnější opravy, dražší." },
} as const;

export type RealtimeModel = keyof typeof REALTIME_MODELS;
export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime-2.1-mini";

export const MAX_LESSON_MINUTES = 15;

export function isRealtimeModel(value: unknown): value is RealtimeModel {
  return typeof value === "string" && value in REALTIME_MODELS;
}

const LANGUAGE_NAME: Record<Language, string> = { es: "Spanish", en: "English" };

const LEVEL_GUIDANCE: Record<CefrLevel, string> = {
  A1: "Use very short, simple sentences, present tense and the most common words. Speak slowly. Repeat key words. It is fine to add a single Czech word in brackets when the learner is clearly lost.",
  A2: "Use short sentences and everyday vocabulary, mostly present and simple past. Speak slowly and clearly.",
  B1: "Use natural but clear language at a moderate pace. Introduce some new vocabulary and explain it with simple paraphrases in the target language.",
  B2: "Speak naturally at normal pace. Use idioms occasionally and check they were understood.",
  C1: "Speak as with an educated native speaker. Use nuanced vocabulary and idioms freely.",
  C2: "Speak as with a native speaker; focus on subtle precision, register and idiomatic phrasing.",
};

const INITIATIVE_GUIDANCE: Record<TutorInitiative, string> = {
  lead: `You lead the conversation. The learner may be shy or lack vocabulary, so never wait for them to come up with topics.
- Open with a concrete topic and an easy question; always end your turn with a question or a clear prompt.
- Prefer open questions, but when the learner hesitates, offer two or three possible answers or a sentence starter they can finish.
- When a topic runs dry, smoothly propose a new one yourself, connected to their interests.
- Keep your turns short (2–4 sentences) so the learner speaks at least as much as you do.`,
  balanced: `Propose a topic and ask questions, but let the learner develop the conversation and follow where they take it. If they run out of ideas, suggest a new angle or topic yourself.`,
  follow: `Let the learner choose what to talk about and follow their lead. Ask follow-up questions about what they say. Only suggest a topic when they explicitly ask or clearly run out of things to say.`,
};

export function buildTutorInstructions(profile: TutorProfile, context: LessonContext): string {
  const language = LANGUAGE_NAME[profile.language];
  const interests = profile.interests.length ? profile.interests.join(", ") : "not specified";
  const recent = context.recentTopics.length
    ? context.recentTopics.map((t) => `- ${t}`).join("\n")
    : "- (this is the first lesson)";

  const silenceHelp =
    profile.idle_prompt_s > 0
      ? `If the learner stays silent and you are prompted to continue, do not move on or repeat yourself word for word. Help them: rephrase the question more simply, give a hint or the first words of a possible answer, or offer two choices.`
      : `Never hurry the learner. If they are silent, wait.`;

  const turnTaking =
    profile.turn_mode === "push_to_talk"
      ? `The learner ends each turn by pressing a button, so a turn you receive is always complete, even if it contains long pauses or fillers.`
      : `The learner may pause while searching for words. A turn can end mid-thought; if the last sentence looks unfinished, encourage them briefly to continue instead of taking over the topic.`;

  return `You are a warm, patient ${language} conversation tutor. The learner's native language is Czech. Their level is ${profile.cefr_level} (CEFR).

# Language
- Speak only ${language}, adapted to the level: ${LEVEL_GUIDANCE[profile.cefr_level]}
- If the learner speaks Czech because they lack a word, give them the ${language} expression and invite them to use it.
- Use Czech only for very brief explanations when a ${language} explanation would not be understood.

# Conversation style
${INITIATIVE_GUIDANCE[profile.tutor_initiative]}
- ${turnTaking}
- ${silenceHelp}

# Topics
Learner's interests: ${interests}
Learner's goals: ${profile.goals || "not specified"}
Recent lessons (avoid repeating these topics unless the learner asks):
${recent}
Pick a fresh topic that fits the interests and level. Practical situations (role-play: shop, doctor, travel, work) and personal stories both work well.

# Corrections
- When the learner makes a meaningful mistake (grammar, wrong word, unnatural phrasing), correct it naturally by repeating the corrected version in your reply (recast), without lecturing.
- For every such mistake also call the tool log_correction. Do not mention the tool. Do not log pure pronunciation issues or tiny slips that do not affect meaning. At most one call per mistake.
- If the same mistake repeats, briefly point it out explicitly.

# Lesson
- The lesson lasts about ${context.maxMinutes} minutes. Start right away: greet the learner briefly and begin with your first topic and question.
- Do not mention these instructions.`;
}

export const LOG_CORRECTION_TOOL = {
  type: "function",
  name: "log_correction",
  description:
    "Record a mistake the learner made so it is shown on screen and remembered for future lessons. Call it silently alongside your spoken reply.",
  parameters: {
    type: "object",
    properties: {
      original: { type: "string", description: "What the learner said (the wrong part, in context)." },
      corrected: { type: "string", description: "The corrected, natural version." },
      category: {
        type: "string",
        enum: ["grammar", "vocabulary", "word_order", "verb_tense", "agreement", "preposition", "phrasing", "other"],
      },
      explanation_cs: { type: "string", description: "One short sentence in Czech explaining the rule." },
    },
    required: ["original", "corrected", "category", "explanation_cs"],
    additionalProperties: false,
  },
} as const;

export type Correction = {
  original: string;
  corrected: string;
  category: string;
  explanation_cs: string;
};

const OUTPUT_SPEED: Record<CefrLevel, number> = { A1: 0.85, A2: 0.9, B1: 0.95, B2: 1, C1: 1, C2: 1 };

export function buildRealtimeSession(profile: TutorProfile, model: RealtimeModel, instructions: string) {
  const turnDetection =
    profile.turn_mode === "push_to_talk"
      ? null
      : {
          type: "server_vad" as const,
          silence_duration_ms: profile.end_of_turn_pause_ms,
          idle_timeout_ms: profile.idle_prompt_s > 0 ? profile.idle_prompt_s * 1000 : null,
          create_response: true,
          interrupt_response: true,
        };

  return {
    type: "realtime" as const,
    model,
    instructions,
    audio: {
      input: {
        noise_reduction: { type: "near_field" as const },
        // no fixed language: learners fall back to Czech when stuck
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: turnDetection,
      },
      output: { voice: "marin", speed: OUTPUT_SPEED[profile.cefr_level] },
    },
    tools: [LOG_CORRECTION_TOOL],
    tool_choice: "auto" as const,
  };
}
