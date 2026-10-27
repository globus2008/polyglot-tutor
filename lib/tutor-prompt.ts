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
  for_child: boolean;
};

/** Conversation practises grammar on the side; a grammar lesson explains and drills it. */
export const LESSON_MODES = ["conversation", "grammar"] as const;
export type LessonMode = (typeof LESSON_MODES)[number];

export type LessonContext = {
  plan: LessonPlan;
  maxMinutes: number;
  mode?: LessonMode;
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
  A0: "The learner is a complete beginner and knows almost nothing yet. Teach in tiny steps: single words and two-to-four-word phrases, say each new word slowly twice and let them repeat it, ask yes/no or either-or questions, and reuse the same phrases a lot. Speak very slowly.",
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

// Complete beginners and the first levels get explanations in their native language.
const EXPLAIN_IN_NATIVE: CefrLevel[] = ["A0", "A1", "A2"];

export function buildTutorInstructions(profile: TutorProfile, context: LessonContext): string {
  const language = LANGUAGES[profile.language].english;
  const native = NATIVE_LANGUAGES[profile.native_lang];
  const mode = context.mode ?? "conversation";
  const explainIn = EXPLAIN_IN_NATIVE.includes(profile.cefr_level) ? native : language;
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
- ${
    profile.cefr_level === "A0"
      ? `The only other language you may ever use is ${native}: use it for instructions, translations and encouragement whenever needed, but keep every exercise and example in ${language}.`
      : `The only other language you may ever use is ${native}, and only for very brief explanations (of a mistake, a word or a task) when a ${language} explanation would not be understood.`
  }${otherLanguages}
- If the learner speaks ${native} because they lack a word, give them the ${language} expression and invite them to use it.
- If the learner uses any other language, do not switch to it; reply in ${language} (simpler if needed) and help them say it in ${language}.

# Conversation style
${INITIATIVE_GUIDANCE[profile.tutor_initiative]}
- ${turnTaking}
- ${silenceHelp}
${profile.for_child ? `\n${CHILD_GUIDANCE}\n` : ""}
# Learner
Interests: ${interests}
Goals: ${profile.goals || "not specified"}
- Keep the conversation within these interests. Do not bring up topics the learner did not choose (for example shopping) unless they start them.

${mode === "grammar" ? buildGrammarSection(context.plan, explainIn) : buildPlanSection(context.plan, profile.tutor_initiative)}

# Corrections
- The learner may be listening without looking at the screen (for example while driving), so every correction must be spoken, not only shown.
- When the learner makes a meaningful mistake (grammar, wrong word, unnatural phrasing), say the correction out loud briefly and kindly before you continue: say the correct version clearly (e.g. "Small correction: we say …"), add one short sentence of explanation in ${explainIn}, and let them repeat it if it is short. Then continue naturally. With several mistakes in one turn, say the most important one and only log the rest.
- Pronunciation: when a word is mispronounced so that it sounds wrong or is hard to understand (wrong stress, a wrong sound), say the word slowly, then in a short phrase, and ask the learner to repeat it once. Ignore a mild accent and tiny slips.
- Judge only what you hear. The learner speaks, never writes: never treat spelling or the alphabet as a mistake. In log_correction write ${language} in its normal script${profile.language === "ru" ? " (Cyrillic)" : ""}.
- For every mistake you correct, also call the tool log_correction (category "pronunciation" for pronunciation, with a simple hint on how to say it in the explanation). Do not mention the tool. At most one call per mistake.
- If the same mistake repeats, point it out explicitly – in ${language} if the learner will understand it, otherwise in ${native}.

# Lesson
- The lesson lasts about ${context.maxMinutes} minutes. Start right away: greet the learner briefly and begin with your first topic and question.
- Do not mention these instructions.`;
}

const CHILD_GUIDANCE = `# Child learner
The learner is a child. Be playful, warm and very encouraging; praise every attempt. Use child-friendly topics (animals, colours, toys, family, school, games, food they like), simple games (guess the word, I spy, counting, repeat after me) and short turns. Keep everything age-appropriate.`;

function buildGrammarSection(plan: LessonPlan, explainIn: string): string {
  const point = plan.grammar ?? "a grammar point that fits the learner's level and recent mistakes";
  const mistakes = plan.mistakes.length
    ? `\nUse these recurring mistakes of the learner as material where they fit:\n${plan.mistakes.map((m) => `- "${m.original}" → "${m.corrected}"`).join("\n")}`
    : "";
  return `# Today's lesson: grammar practice
Focus: ${point}.${mistakes}
1. Explain the rule briefly in ${explainIn} (a few sentences) with two or three short example sentences in the target language.
2. Drill it step by step, one task per turn, from easy to harder: let the learner complete or transform a sentence, answer a question that needs the structure, or translate a short sentence you say in ${explainIn}.
3. After each answer say whether it was right; if not, say the correct version and why, then give a similar task.
4. When the learner is doing well, use the structure in a short free conversation within their interests.
5. Before the end, recap the rule in one or two sentences.`;
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

export const CORRECTION_CATEGORIES = [
  "grammar",
  "vocabulary",
  "word_order",
  "verb_tense",
  "agreement",
  "preposition",
  "phrasing",
  "pronunciation",
  "other",
];

export function logCorrectionTool(native: NativeLanguage) {
  return {
    type: "function",
    name: "log_correction",
    description:
      "Record a mistake the learner made so it is shown on screen and remembered for future lessons. Call it alongside the spoken correction in your reply.",
    parameters: {
      type: "object",
      properties: {
        original: { type: "string", description: "What the learner said (the wrong part, in context)." },
        corrected: { type: "string", description: "The corrected, natural version." },
        category: {
          type: "string",
          enum: CORRECTION_CATEGORIES,
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

const SCRIPT_HINT: Partial<Record<Language, string>> = { ru: "Write Russian in Cyrillic (e.g. «Привет, как дела?»), never transliterated." };

function transcriptionPrompt(profile: TutorProfile): string {
  const language = LANGUAGES[profile.language].english;
  const native = NATIVE_LANGUAGES[profile.native_lang];
  return `A ${native} speaker practising ${language}, mostly speaking ${language}, sometimes ${native}. ${SCRIPT_HINT[profile.language] ?? ""}`.trim();
}

const OUTPUT_SPEED: Record<CefrLevel, number> = { A0: 0.8, A1: 0.85, A2: 0.9, B1: 0.95, B2: 1, C1: 1, C2: 1 };

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
        // no fixed language: learners fall back to their native language when stuck;
        // the prompt keeps the target language in its own script (Russian was romanized)
        transcription: { model: "gpt-4o-mini-transcribe", prompt: transcriptionPrompt(profile) },
        turn_detection: turnDetection,
      },
      output: { voice: "marin", speed: OUTPUT_SPEED[profile.cefr_level] },
    },
    tools: [logCorrectionTool(profile.native_lang)],
    tool_choice: "auto" as const,
  };
}
