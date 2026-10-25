"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicLevel } from "@/components/mic-level";
import { buttonClass, inputClass } from "@/components/ui";
import {
  connectRealtime,
  getMicrophone,
  listMicrophones,
  MicrophoneError,
  type RealtimeConnection,
  type ServerEvent,
} from "@/lib/realtime-client";
import { DEFAULT_REALTIME_MODEL, isRealtimeModel, REALTIME_MODELS, type Correction, type RealtimeModel } from "@/lib/tutor-prompt";
import { LessonResult } from "./lesson-result";

type Phase = "ready" | "connecting" | "live" | "saving" | "done" | "error";
type Message = { id: string; role: "user" | "assistant"; text: string };
type Lesson = {
  lessonId: string;
  turnMode: "auto" | "push_to_talk";
  idlePromptS: number;
  maxMinutes: number;
  topicCs: string | null;
};
type DiagEntry = { at: string; text: string };

const MODEL_STORAGE_KEY = "polyglot.realtimeModel";
const MIC_STORAGE_KEY = "polyglot.micDeviceId";

// Events worth showing in the diagnostics panel, with a Czech hint.
const DIAG_EVENTS: Record<string, string> = {
  "session.created": "spojení s OpenAI navázáno",
  "input_audio_buffer.speech_started": "server zaslechl řeč",
  "input_audio_buffer.speech_stopped": "server: konec řeči",
  "input_audio_buffer.committed": "váš tah odeslán",
  "input_audio_buffer.timeout_triggered": "dlouhé ticho – lektor pomůže",
  "conversation.item.input_audio_transcription.completed": "přepis vaší řeči hotov",
  "conversation.item.input_audio_transcription.failed": "přepis vaší řeči selhal",
  "response.done": "lektor dokončil odpověď",
  error: "chyba",
};

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

function readStoredModel(): RealtimeModel {
  const stored = readStored(MODEL_STORAGE_KEY);
  return isRealtimeModel(stored) ? stored : DEFAULT_REALTIME_MODEL;
}
const noSubscription = () => () => {};

const CATEGORY_LABELS: Record<string, string> = {
  grammar: "gramatika",
  vocabulary: "slovní zásoba",
  word_order: "slovosled",
  verb_tense: "časy",
  agreement: "shoda",
  preposition: "předložky",
  phrasing: "formulace",
  other: "jiné",
};

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoiceLesson({ language, languageName, flag }: { language: string; languageName: string; flag: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const storedModel = useSyncExternalStore(noSubscription, readStoredModel, () => DEFAULT_REALTIME_MODEL);
  const [chosenModel, setModel] = useState<RealtimeModel | null>(null);
  const model = chosenModel ?? storedModel;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [tutorSpeaking, setTutorSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [savedDuration, setSavedDuration] = useState<number | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [diag, setDiag] = useState<DiagEntry[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const connRef = useRef<RealtimeConnection | null>(null);
  const lessonRef = useRef<Lesson | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const correctionsRef = useRef<Correction[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapUpSentRef = useRef(false);
  const finishingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const addDiag = useCallback((text: string) => {
    const at = new Date().toLocaleTimeString("cs-CZ");
    setDiag((prev) => [...prev.slice(-39), { at, text }]);
  }, []);

  // Opens (or switches) the microphone before the lesson so the level meter can show it works.
  const openMic = useCallback(async (deviceId?: string) => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    const stream = await getMicrophone(deviceId || undefined);
    micStreamRef.current = stream;
    setMicStream(stream);
    const actualId = stream.getAudioTracks()[0]?.getSettings().deviceId ?? "";
    setMicId(actualId);
    if (actualId) store(MIC_STORAGE_KEY, actualId);
    setMics(await listMicrophones());
    return stream;
  }, []);

  useEffect(
    () => () => {
      if (!connRef.current) micStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  useEffect(() => {
    messagesRef.current = messages;
    correctionsRef.current = corrections;
  }, [messages, corrections]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const upsertMessage = useCallback((id: string, role: Message["role"], update: (text: string) => string) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === id);
      if (index === -1) return [...prev, { id, role, text: update("") }];
      const next = [...prev];
      next[index] = { ...next[index], text: update(next[index].text) };
      return next;
    });
  }, []);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };

  const sendSystemNudge = useCallback((text: string) => {
    const conn = connRef.current;
    if (!conn) return;
    conn.send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });
    conn.send({ type: "response.create" });
  }, []);

  // Push-to-talk has no server VAD, so the "help me when I'm silent" timer runs here.
  const armIdleTimer = useCallback(() => {
    const current = lessonRef.current;
    clearIdleTimer();
    if (!current || current.turnMode !== "push_to_talk" || current.idlePromptS <= 0) return;
    idleTimerRef.current = setTimeout(() => {
      sendSystemNudge(
        `The learner has been silent for ${current.idlePromptS} seconds after your last turn. Help them as instructed: simplify the question, give a hint or offer choices.`,
      );
    }, current.idlePromptS * 1000);
  }, [sendSystemNudge]);

  const handleEvent = useCallback(
    (event: ServerEvent) => {
      const hint = DIAG_EVENTS[event.type];
      if (hint) {
        const detail =
          event.type === "error"
            ? `: ${event.error?.message ?? ""}`
            : event.type === "conversation.item.input_audio_transcription.failed"
              ? `: ${event.error?.message ?? ""}`
              : event.type === "conversation.item.input_audio_transcription.completed"
                ? ` – „${String(event.transcript ?? "").slice(0, 60)}“`
                : "";
        addDiag(hint + detail);
      }
      switch (event.type) {
        case "conversation.item.added":
        case "conversation.item.created": {
          const item = event.item;
          if (item?.type === "message" && (item.role === "user" || item.role === "assistant")) {
            const typed = item.content?.find((c: { type: string }) => c.type === "input_text")?.text ?? "";
            upsertMessage(item.id, item.role, (t) => t || typed);
          }
          break;
        }
        case "conversation.item.input_audio_transcription.delta":
          upsertMessage(event.item_id, "user", (t) => t + (event.delta ?? ""));
          break;
        case "conversation.item.input_audio_transcription.completed":
          upsertMessage(event.item_id, "user", () => event.transcript ?? "");
          break;
        case "response.output_audio_transcript.delta":
          upsertMessage(event.item_id, "assistant", (t) => t + (event.delta ?? ""));
          break;
        case "response.output_audio_transcript.done":
          upsertMessage(event.item_id, "assistant", () => event.transcript ?? "");
          break;
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          clearIdleTimer();
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
        case "output_audio_buffer.started":
          setTutorSpeaking(true);
          clearIdleTimer();
          break;
        case "output_audio_buffer.stopped":
        case "output_audio_buffer.cleared":
          setTutorSpeaking(false);
          armIdleTimer();
          break;
        case "response.done": {
          const output: Array<{ type: string; name?: string; arguments?: string; call_id?: string }> =
            event.response?.output ?? [];
          const calls = output.filter((o) => o.type === "function_call" && o.name === "log_correction");
          for (const call of calls) {
            try {
              const args = JSON.parse(call.arguments ?? "{}") as Correction;
              if (args.original && args.corrected) setCorrections((prev) => [...prev, args]);
            } catch {
              // ignore malformed arguments
            }
            connRef.current?.send({
              type: "conversation.item.create",
              item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: true }) },
            });
          }
          // a response that only logged a correction must still be followed by speech
          if (calls.length > 0 && !output.some((o) => o.type === "message")) {
            connRef.current?.send({ type: "response.create" });
          }
          break;
        }
        case "error":
          console.warn("Realtime error", event.error);
          break;
      }
    },
    [addDiag, armIdleTimer, upsertMessage],
  );

  const finish = useCallback(async (status: "finished" | "failed" = "finished") => {
    const current = lessonRef.current;
    if (!current || finishingRef.current) return;
    finishingRef.current = true;
    clearIdleTimer();
    connRef.current?.close();
    connRef.current = null;
    setPhase("saving");
    setTutorSpeaking(false);
    try {
      const res = await fetch(`/api/lessons/${current.lessonId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          transcript: messagesRef.current.filter((m) => m.text.trim()).map(({ role, text }) => ({ role, text })),
          corrections: correctionsRef.current,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setSavedDuration(typeof data.durationS === "number" ? data.durationS : null);
    } finally {
      setPhase("done");
    }
  }, []);

  // Lesson clock: wrap-up hint one minute before the limit, hard stop at the limit.
  useEffect(() => {
    if (phase !== "live" || !lesson) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      const limit = lesson.maxMinutes * 60;
      if (seconds >= limit - 60 && !wrapUpSentRef.current) {
        wrapUpSentRef.current = true;
        sendSystemNudge(
          "About one minute of the lesson is left. After the learner's next answer, wrap up: briefly recap what you talked about and the main corrections, then say goodbye.",
        );
      }
      if (seconds >= limit) void finish();
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, lesson, finish, sendSystemNudge]);

  // Save what we have if the tab is closed mid-lesson.
  useEffect(() => {
    if (phase !== "live") return;
    const onUnload = () => {
      const current = lessonRef.current;
      if (!current || finishingRef.current) return;
      navigator.sendBeacon(
        `/api/lessons/${current.lessonId}/finish`,
        new Blob(
          [
            JSON.stringify({
              status: "finished",
              transcript: messagesRef.current.filter((m) => m.text.trim()).map(({ role, text }) => ({ role, text })),
              corrections: correctionsRef.current,
            }),
          ],
          // text/plain: sendBeacon refuses non-CORS-safelisted types; the route parses JSON anyway
          { type: "text/plain" },
        ),
      );
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [phase]);

  useEffect(() => () => connRef.current?.close(), []);

  async function start() {
    setPhase("connecting");
    setError(null);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      // ignore
    }
    // unlock audio playback inside the click (iOS Safari)
    void audioRef.current?.play().catch(() => {});

    try {
      const stream = micStreamRef.current?.active ? micStreamRef.current : await openMic(readStored(MIC_STORAGE_KEY) ?? undefined);
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lekci se nepodařilo spustit.");

      const current: Lesson = {
        lessonId: data.lessonId,
        turnMode: data.turnMode,
        idlePromptS: data.idlePromptS,
        maxMinutes: data.maxMinutes,
        topicCs: data.topicCs ?? null,
      };
      lessonRef.current = current;
      setLesson(current);

      const conn = await connectRealtime({
        clientSecret: data.clientSecret,
        stream,
        audioElement: audioRef.current!,
        onEvent: handleEvent,
        onClose: () => {
          if (!finishingRef.current) void finish();
        },
      });
      connRef.current = conn;
      if (current.turnMode === "push_to_talk") conn.mic.enabled = false;
      setPhase("live");
      // the tutor opens the conversation, the learner doesn't have to come up with anything
      conn.send({ type: "response.create" });
    } catch (e) {
      const message =
        e instanceof MicrophoneError
          ? "Bez přístupu k mikrofonu to nepůjde. Povolte ho v prohlížeči a zkuste to znovu."
          : e instanceof Error && !e.message.startsWith("SDP") && !e.message.includes("timeout")
            ? e.message
            : "Spojení s lektorem se nepodařilo navázat. Zkuste to prosím znovu.";
      setError(message);
      setPhase("error");
      if (lessonRef.current) {
        await fetch(`/api/lessons/${lessonRef.current.lessonId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "failed", transcript: [], corrections: [] }),
        }).catch(() => {});
        lessonRef.current = null;
        setLesson(null);
      }
    }
  }

  function startTalking() {
    const conn = connRef.current;
    if (!conn) return;
    clearIdleTimer();
    if (tutorSpeaking) {
      conn.send({ type: "response.cancel" });
      conn.send({ type: "output_audio_buffer.clear" });
    }
    conn.send({ type: "input_audio_buffer.clear" });
    conn.mic.enabled = true;
    setRecording(true);
  }

  function stopTalking() {
    const conn = connRef.current;
    if (!conn) return;
    setRecording(false);
    // let the last syllable reach the server before closing the turn
    setTimeout(() => {
      conn.mic.enabled = false;
      conn.send({ type: "input_audio_buffer.commit" });
      conn.send({ type: "response.create" });
    }, 300);
  }

  function toggleMute() {
    const conn = connRef.current;
    if (!conn) return;
    conn.mic.enabled = muted;
    setMuted(!muted);
  }

  function sendText(form: HTMLFormElement) {
    const input = form.elements.namedItem("text") as HTMLInputElement;
    const text = input.value.trim();
    if (!text || !connRef.current) return;
    clearIdleTimer();
    connRef.current.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    connRef.current.send({ type: "response.create" });
    input.value = "";
  }

  const pushToTalk = lesson?.turnMode === "push_to_talk";
  const status = tutorSpeaking
    ? "Lektor mluví"
    : recording || userSpeaking
      ? "Posloucháme vás…"
      : pushToTalk
        ? "Až budete připraveni, stiskněte Mluvit"
        : "Mluvte, až budete chtít – máte čas";

  return (
    <div className="space-y-4 pb-36">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">
          <span aria-hidden className="mr-2">
            {flag}
          </span>
          {languageName}
          {lesson?.topicCs && <span className="ml-2 font-normal text-muted-foreground">· {lesson.topicCs}</span>}
        </h1>
        {(phase === "live" || phase === "saving") && lesson && (
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {formatTime(elapsed)} / {lesson.maxMinutes}:00
          </span>
        )}
      </div>

      {(phase === "ready" || phase === "error" || phase === "connecting") && (
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-muted-foreground">
            Lektor začne sám – pozdraví vás a navrhne téma. Odpovídejte nahlas; když nebudete vědět, klidně řekněte
            slovo česky nebo počkejte, lektor napoví.
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Mikrofon</p>
            {micStream ? (
              <>
                {mics.length > 1 && (
                  <select
                    aria-label="Vstupní zařízení"
                    value={micId}
                    onChange={(e) => {
                      void openMic(e.target.value).catch(() => setError("Toto zařízení nelze otevřít."));
                    }}
                    className={inputClass}
                  >
                    {mics.map((d, i) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Mikrofon ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
                <MicLevel stream={micStream} />
                <p className="text-xs text-muted-foreground">
                  Promluvte – zelený pruh se musí pohybovat. Pokud ne, vyberte jiný mikrofon.
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void openMic(readStored(MIC_STORAGE_KEY) ?? undefined).catch(() =>
                    setError("Bez přístupu k mikrofonu to nepůjde. Povolte ho v prohlížeči (ikona vedle adresy)."),
                  );
                }}
                className={buttonClass("secondary")}
              >
                Vyzkoušet mikrofon
              </button>
            )}
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Kvalita hlasu</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(REALTIME_MODELS) as RealtimeModel[]).map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name="model"
                    checked={model === m}
                    onChange={() => setModel(m)}
                    className="mt-1 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block font-medium">{REALTIME_MODELS[m].label}</span>
                    <span className="text-sm text-muted-foreground">{REALTIME_MODELS[m].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={start} disabled={phase === "connecting"} className={`${buttonClass()} w-full`}>
            {phase === "connecting" ? "Připojuji lektora…" : "Začít lekci"}
          </button>
          <p className="text-xs text-muted-foreground">
            Prohlížeč se zeptá na mikrofon. Styl konverzace (pauzy, kdo vede rozhovor) změníte v{" "}
            <Link href={`/onboarding?lang=${language}`} className="underline">
              profilu jazyka
            </Link>
            .
          </p>
        </div>
      )}

      {(phase === "live" || phase === "saving" || phase === "done") && (
        <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
          <section aria-label="Přepis rozhovoru" className="space-y-3">
            {messages.length === 0 && phase === "live" && (
              <p className="text-muted-foreground">Lektor se připravuje…</p>
            )}
            {messages
              .filter((m) => m.text.trim())
              .map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.role === "assistant"
                      ? "bg-surface border border-line"
                      : "ml-auto bg-accent text-white"
                  }`}
                >
                  {m.text}
                </div>
              ))}
            <div ref={transcriptEndRef} />
          </section>

          <aside aria-label="Opravy" className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Opravy ({corrections.length})</h2>
            {corrections.length === 0 && (
              <p className="text-sm text-muted-foreground">Zatím žádné – opravy se tu objeví během hovoru.</p>
            )}
            {corrections.map((c, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <p className="text-danger line-through decoration-1">{c.original}</p>
                <p className="font-medium text-success">{c.corrected}</p>
                <p className="mt-1 text-muted-foreground">{c.explanation_cs}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[c.category] ?? c.category}
                </p>
              </div>
            ))}
          </aside>
        </div>
      )}

      {diag.length > 0 && (
        <details className="rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Diagnostika spojení</summary>
          <ol className="mt-2 space-y-0.5 font-mono text-xs">
            {diag.map((d, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{d.at}</span> {d.text}
              </li>
            ))}
          </ol>
        </details>
      )}

      {phase === "done" && lesson && <LessonResult lessonId={lesson.lessonId} durationS={savedDuration} />}

      {phase === "live" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-3">
            <div className="flex items-center gap-2 text-sm" aria-live="polite">
              <span
                className={`size-2.5 rounded-full ${
                  tutorSpeaking ? "animate-pulse bg-accent" : recording || userSpeaking ? "animate-pulse bg-success" : "bg-line"
                }`}
              />
              {status}
              <MicLevel stream={muted || (pushToTalk && !recording) ? null : micStream} className="ml-auto w-24" />
            </div>
            {showTextInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendText(e.currentTarget);
                }}
                className="flex gap-2"
              >
                <input name="text" autoComplete="off" placeholder="Napište odpověď…" className={inputClass} />
                <button type="submit" className={buttonClass("secondary")}>
                  Poslat
                </button>
              </form>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {pushToTalk ? (
                <button
                  type="button"
                  onClick={recording ? stopTalking : startTalking}
                  className={`${buttonClass(recording ? "secondary" : "primary")} min-w-40 flex-1 py-3 text-base`}
                >
                  {recording ? "Hotovo – předat slovo" : "Mluvit"}
                </button>
              ) : (
                <button type="button" onClick={toggleMute} className={`${buttonClass("secondary")} flex-1`}>
                  {muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}
                </button>
              )}
              <button type="button" onClick={() => setShowTextInput((v) => !v)} className={buttonClass("secondary")}>
                {showTextInput ? "Skrýt psaní" : "Psát"}
              </button>
              <button type="button" onClick={() => void finish()} className={buttonClass("danger")}>
                Ukončit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
