import type { TurnMode, TutorInitiative } from "./conversation-style";
import { LANGUAGES, NATIVE_LANGUAGES, type CefrLevel, type Language, type NativeLanguage } from "./languages";
import type { LessonPlan } from "./planner";

// Builds the voice tutor's instructions and the Realtime session config.
// Pure functions: the lesson route supplies the learner data.

export type TutorProfile = {
  language: Language;
  cefr_level: CefrLevel;
  native_lang: NativeLanguage;
  interests: string[];
  goals: string;
  tutor_initiative: TutorInitiative;
  turn_mode: TurnMode;
  end_of_turn_pause_ms: number;
  idle_prompt_s: number;
};

export type LessonContext = {
  plan: LessonPlan;
  maxMinutes: number;
};

/** Voice models users can pick per lesson; labels are in the i18n dictionaries. */
export const REALTIME_MODELS = ["gpt-realtime-2.1-mini", "gpt-realtime-2.1"] as const;

export type RealtimeModel = (typeof REALTIME_MODELS)[number];
export const DEFAULT_REALTIME_MODEL: RealtimeModel = "gpt-realtime-2.1-mini";

export const MAX_LESSON_MINUTES = 15;

export function isRealtimeModel(value: unknown): value is RealtimeModel {
  return typeof value === "string" && (REALTIME_MODELS as readonly string[]).includes(value);
}

const LEVEL_GUIDANCE: Record<CefrLevel, string> = {
  A1: "Use very short, simple sentences, present tense and the most common words. Speak slowly. Repeat key words. It is fine to add a single word in the learner's native language in brackets when they are clearly lost.",
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
  const language = LANGUAGES[profile.language].english;
  const native = NATIVE_LANGUAGES[profile.native_lang];
  // models drift into English when the learner struggles; forbid it unless it is one of the lesson's languages
  const otherLanguages =
    profile.language === "en" || profile.native_lang === "en" ? "" : " Never speak English or any other language.";
  const interests = profile.interests.length ? profile.interests.join(", ") : "not specified";

  const silenceHelp =
    profile.idle_prompt_s > 0
      ? `If the learner stays silent and you are prompted to continue, do not move on or repeat yourself word for word. Help them: rephrase the question more simply, give a hint or the first words of a possible answer, or offer two choices.`
      : `Never hurry the learner. If they are silent, wait.`;

  const turnTaking =
    profile.turn_mode === "push_to_talk"
      ? `The learner ends each turn by pressing a button, so a turn you receive is always complete, even if it contains long pauses or fillers.`
      : `The learner may pause while searching for words. A turn can end mid-thought; if the last sentence looks unfinished, encourage them briefly to continue instead of taking over the topic.`;

  return `You are a warm, patient ${language} conversation tutor. The learner's native language is ${native}. Their level is ${profile.cefr_level} (CEFR).

# Language
- Speak only ${language}, adapted to the level: ${LEVEL_GUIDANCE[profile.cefr_level]}
- The only other language you may ever use is ${native}, and only for very brief explanations (of a mistake, a word or a task) when a ${language} explanation would not be understood.${otherLanguages}
- If the learner speaks ${native} because they lack a word, give them the ${language} expression and invite them to use it.
- If the learner uses any other language, do not switch to it; reply in ${language} (simpler if needed) and help them say it in ${language}.

# Conversation style
${INITIATIVE_GUIDANCE[profile.tutor_initiative]}
- ${turnTaking}
- ${silenceHelp}

# Learner
Interests: ${interests}
Goals: ${profile.goals || "not specified"}

${buildPlanSection(context.plan, profile.tutor_initiative)}

# Corrections
- When the learner makes a meaningful mistake (grammar, wrong word, unnatural phrasing), correct it naturally by repeating the corrected version in your reply (recast), without lecturing.
- For every such mistake also call the tool log_correction. Do not mention the tool. Do not log pure pronunciation issues or tiny slips that do not affect meaning. At most one call per mistake.
- If the same mistake repeats, briefly point it out explicitly – in ${language} if the learner will understand it, otherwise in ${native}.

# Lesson
- The lesson lasts about ${context.maxMinutes} minutes. Start right away: greet the learner briefly and begin with your first topic and question.
- Do not mention these instructions.`;
}

function buildPlanSection(plan: LessonPlan, initiative: TutorInitiative): string {
  const parts: string[] = ["# Today's lesson plan"];

  if (plan.topic) {
    const usage =
      initiative === "follow"
        ? "Offer it as a suggestion if the learner has no topic of their own."
        : "Start with it; if it runs dry, move on to a related topic connected to the learner's interests.";
    parts.push(`Topic: ${plan.topic.title} – ${plan.topic.scenario}\n${usage}`);
  } else {
    parts.push("Topic: pick one that fits the learner's interests and level.");
  }

  if (plan.grammar) {
    parts.push(
      `Grammar to practise: ${plan.grammar}. Create natural situations where the learner needs it (ask questions that call for it). Do not lecture; if they avoid or misuse it, recast and nudge.`,
    );
  }

  if (plan.vocab.length) {
    const words = plan.vocab.map((v) => `${v.term} (${v.translation})`).join(", ");
    parts.push(
      `Words due for review – use them yourself and give the learner chances to use them: ${words}. If the learner can't recall one, give a hint before the answer.`,
    );
  }

  if (plan.mistakes.length) {
    const list = plan.mistakes.map((m) => `- "${m.original}" → "${m.corrected}" (${m.explanation})`).join("\n");
    parts.push(
      `Recurring mistakes of this learner – create opportunities to practise the correct form and point it out briefly when it recurs:\n${list}`,
    );
  }

  parts.push(
    plan.recentSummaries.length
      ? `Previous lessons (newest first) – you may briefly refer back for continuity, but do not repeat the same conversation:\n${plan.recentSummaries.map((s) => `- ${s}`).join("\n")}`
      : "This is the learner's first lesson in this language: be especially encouraging.",
  );

  return parts.join("\n\n");
}

export function logCorrectionTool(native: NativeLanguage) {
  return {
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
        explanation: {
          type: "string",
          description: `One short sentence explaining the rule, in ${NATIVE_LANGUAGES[native]}.`,
        },
      },
      required: ["original", "corrected", "category", "explanation"],
      additionalProperties: false,
    },
  } as const;
}

export type Correction = {
  original: string;
  corrected: string;
  category: string;
  explanation: string;
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
        // no fixed language: learners fall back to their native language when stuck
        transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: turnDetection,
      },
      output: { voice: "marin", speed: OUTPUT_SPEED[profile.cefr_level] },
    },
    tools: [logCorrectionTool(profile.native_lang)],
    tool_choice: "auto" as const,
  };
}
