"use client";

import { useEffect, useRef, useState } from "react";
import Face, { FaceState } from "@/components/Face";
import LevelMeter from "@/components/LevelMeter";
import { ArrowIcon, MicIcon, PlayIcon, StopIcon } from "@/components/Icons";
import { startRecording } from "@/lib/recorder";
import { speak, stopSpeaking, unlockAudio } from "@/lib/speak";
import examples from "@/lib/examples.json";

type Message = { role: "user" | "assistant"; content: string };
type Example = { question: string; keyword: string; answer?: string; audio?: string };
type Source = "voice" | "typed" | "example" | "follow-up";
type Timing = { stt?: number; llm?: number; tts?: number; preRecorded?: boolean };

const EXAMPLES: Example[] = examples;
const FOLLOW_UPS = ["Can you give an example?", "What did you learn from that?", "Why 100x?"];
const MIN_VOICE_MS = 500;
const MIN_AUDIO_BYTES = 2000;

const LINKS = [
  { label: "LinkedIn", url: "https://www.linkedin.com/in/utkarsh-sawant/" },
  { label: "GitHub", url: "https://github.com/utkarshsawant65" },
];

const BUTTON: Record<FaceState, string> = {
  idle: "Tap to ask",
  listening: "Tap to send",
  thinking: "Thinking…",
  speaking: "Tap to interrupt",
  error: "Tap to try again",
};

const HINT: Record<FaceState, string> = {
  idle: "Ask out loud, pick a question, or type one.",
  listening: "I'm listening. I'll send it when you pause.",
  thinking: "Working on an answer…",
  speaking: "Ask something else any time.",
  error: "",
};

// If Claude is unreachable, questions matching an example still get its pre-recorded answer
const offlineAnswer = (question: string) => EXAMPLES.find((e) => e.answer && question.toLowerCase().includes(e.keyword));

const seconds = (ms?: number) => (ms === undefined ? "" : `${(ms / 1000).toFixed(1)} s`);
const label = "text-xs font-medium uppercase tracking-[0.14em] text-muted";

// Live captions: words light up as they are spoken
function Caption({ text, progress, live }: { text: string; progress: number; live: boolean }) {
  const words = text.split(" ");
  const spoken = live ? Math.ceil(progress * words.length) : words.length;
  return (
    <p className="text-xl font-medium leading-relaxed tracking-tight sm:text-2xl sm:leading-relaxed">
      {words.map((w, i) => (
        <span key={i} className={`transition-colors duration-300 ${i < spoken ? "text-ink" : "text-ink/25"}`}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

export default function Home() {
  const [state, setState] = useState<FaceState>("idle");
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [micBlocked, setMicBlocked] = useState(false);
  const [micUsed, setMicUsed] = useState(false);
  const [lastTiming, setLastTiming] = useState<Timing | null>(null);
  const [muted, setMuted] = useState(false);
  const recording = useRef<Awaited<ReturnType<typeof startRecording>> | null>(null);
  const history = useRef<Message[]>([]);
  const timing = useRef<Timing>({});
  const sessionId = useRef(Math.random().toString(36).slice(2, 12));
  const nowPanel = useRef<HTMLElement>(null);
  // Each new action bumps this, so a finished older answer can't overwrite the current state
  const turn = useRef(0);

  const busy = state === "thinking";
  const canAsk = !busy && state !== "listening";

  // The current question and answer are shown large; everything before them goes to the transcript
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  const currentQ = messages[lastUser];
  const currentA = messages[lastUser + 1];
  const earlier = lastUser > 0 ? messages.slice(0, lastUser) : [];

  function fail(message: string) {
    setError(message);
    setState("error");
  }

  function play(text: string, audioUrl?: string, onStart?: () => void) {
    setProgress(0);
    return speak(text, { audioUrl, onLevel: setLevel, onProgress: setProgress, onStart });
  }

  async function ask(question: string, source: Source, ready?: Example) {
    const id = ++turn.current;
    const current = () => turn.current === id;
    unlockAudio();
    stopSpeaking();
    setError("");
    setState("thinking");
    if (source !== "voice") timing.current = {};
    history.current = [...history.current, { role: "user", content: question }];
    setMessages(history.current);
    nowPanel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    let answer = ready?.answer;
    let audioUrl = ready?.audio;
    const askedAt = Date.now();
    if (answer) {
      timing.current.preRecorded = true;
      const body = JSON.stringify({ index: EXAMPLES.indexOf(ready!), sessionId: sessionId.current });
      fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => {});
    } else {
      let errorMessage = "I couldn't reach the server. Please check your connection and try again.";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.current, sessionId: sessionId.current, source }),
        });
        const data = await res.json();
        if (res.ok && data.text) answer = data.text as string;
        else errorMessage = data.error || "Sorry, something went wrong. Please try again.";
      } catch {}
      if (!current()) return;
      timing.current.llm = Date.now() - askedAt;
      if (!answer) {
        const backup = offlineAnswer(question);
        if (!backup) return fail(errorMessage);
        answer = backup.answer;
        audioUrl = backup.audio;
        timing.current = { preRecorded: true };
      }
    }

    history.current = [...history.current, { role: "assistant", content: answer! }];
    setMessages(history.current);
    if (muted) {
      setLastTiming({ ...timing.current });
      return setState("idle");
    }
    setState("speaking");
    const answeredAt = Date.now();
    await play(answer!, audioUrl, () => {
      if (!timing.current.preRecorded) timing.current.tts = Date.now() - answeredAt;
      setLastTiming({ ...timing.current });
    });
    if (current()) setState("idle");
  }

  // Plays the life story, then the superpower, unless the visitor does something else in between
  async function playIntro() {
    const id = turn.current + 1;
    await ask(EXAMPLES[0].question, "example", EXAMPLES[0]);
    if (turn.current === id) ask(EXAMPLES[1].question, "example", EXAMPLES[1]);
  }

  function downloadTranscript() {
    const text = messages.map((m) => `${m.role === "user" ? "Q" : "A"}: ${m.content}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([`Talk to Utkarsh\n\n${text}\n`], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "talk-to-utkarsh.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  function replay(text: string) {
    const id = ++turn.current;
    unlockAudio();
    setError("");
    setState("speaking");
    play(text, EXAMPLES.find((e) => e.answer === text)?.audio).then(() => {
      if (turn.current === id) setState("idle");
    });
  }

  function stop() {
    turn.current++;
    stopSpeaking();
    setState("idle");
  }

  function startOver() {
    stop();
    history.current = [];
    setMessages([]);
    setError("");
    setLastTiming(null);
  }

  async function startListening() {
    turn.current++;
    stopSpeaking();
    setError("");
    setMicUsed(true);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicBlocked(true);
      return fail("Voice input isn't supported in this browser. Open this page in Chrome or Safari, or type your question below.");
    }
    try {
      recording.current = await startRecording(stopListening, setLevel);
      setState("listening");
    } catch (err) {
      setMicBlocked(true);
      const name = err instanceof DOMException ? err.name : "";
      fail(
        name === "NotFoundError"
          ? "I couldn't find a microphone. Please type your question below."
          : "Microphone access is blocked. Click the mic icon in the address bar to allow it, or type your question below.",
      );
    }
  }

  async function stopListening() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    const id = ++turn.current;
    setState("thinking");

    try {
      const { blob, voicedMs } = await current.stop();
      if (voicedMs < MIN_VOICE_MS || blob.size < MIN_AUDIO_BYTES) return fail("I didn't catch that. Please try again.");

      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", blob, `audio.${ext}`);
      const sentAt = Date.now();
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (turn.current !== id) return;
      if (!res.ok) return fail(data.error || "I couldn't hear that. Please try again.");
      if (!data.text || data.text.length < 2) return fail("I didn't catch that. Please try again.");
      timing.current = { stt: Date.now() - sentAt };
      await ask(data.text, "voice");
    } catch {
      if (turn.current === id) fail("I couldn't hear that. Please try again or type your question.");
    }
  }

  // The mic only ever starts or stops listening. While speaking, it interrupts and listens.
  function onMicClick() {
    unlockAudio();
    if (state === "listening") stopListening();
    else if (!busy) startListening();
  }

  // Keyboard: Space to talk or send, Esc to stop (ignored while typing or on a focused control)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (state === "listening") stopListening();
        else if (state === "speaking") stop();
      } else if (e.code === "Space" && !e.repeat && !(e.target as HTMLElement).closest("input, textarea, button, a, summary")) {
        e.preventDefault();
        onMicClick();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onTypedSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = typed.trim();
    if (!question || !canAsk) return;
    setTyped("");
    ask(question, "typed");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8 lg:h-dvh lg:py-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">Live voice interview · AI</p>
          <h1 className="mt-1.5 text-4xl font-semibold tracking-tight sm:text-[2.75rem]">
            Talk to <span className="text-accent">Utkarsh</span>
          </h1>
        </div>
        <nav className="flex gap-6">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted transition hover:text-accent"
            >
              {l.label} ↗
            </a>
          ))}
        </nav>
      </header>

      {/* On desktop the page fits the window; any overflow scrolls inside a column, not the page */}
      <div className="mt-6 grid min-h-0 flex-1 gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* The studio: portrait, meter and controls */}
        <section className="no-scrollbar flex flex-col items-center gap-4 self-start rounded-[2rem] border border-line bg-card/70 p-6 backdrop-blur lg:max-h-full lg:overflow-y-auto">
          <Face state={state} level={level} />
          <div className="portrait max-w-full shrink-0">
            <LevelMeter level={level} live={state === "speaking" || state === "listening"} color={state === "listening" ? "#f87171" : "var(--accent)"} />
          </div>

          <div className="flex w-full max-w-72 gap-2">
            <button
              onClick={onMicClick}
              disabled={busy}
              aria-label={BUTTON[state]}
              className={`flex flex-1 items-center justify-center gap-3 rounded-2xl py-4 font-medium transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-60 ${
                state === "listening" ? "bg-red-500 text-white" : "bg-accent text-[#0b1020] hover:brightness-110"
              }`}
            >
              {state === "listening" ? <StopIcon /> : <MicIcon />}
              {BUTTON[state]}
            </button>
            {state === "speaking" && (
              <button
                onClick={stop}
                aria-label="Stop speaking"
                className="flex items-center gap-2 rounded-2xl border border-line px-4 text-sm transition hover:border-accent hover:text-accent"
              >
                <StopIcon className="h-4 w-4" /> Stop
              </button>
            )}
          </div>

          <p className="tall-only min-h-5 text-center text-sm text-muted" aria-live="polite">
            {HINT[state]}
            {!micUsed && state === "idle" && " Your browser will ask to use the microphone."}
          </p>

          {error && (
            <div role="alert" className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              {error}
              {micBlocked && (
                <button className="mt-2 block underline" onClick={() => navigator.clipboard?.writeText(location.href)}>
                  Copy link
                </button>
              )}
            </div>
          )}

          <form onSubmit={onTypedSubmit} className="flex w-full items-center gap-2 border-b border-line transition focus-within:border-accent">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={300}
              placeholder="Or type a question"
              aria-label="Type a question"
              className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-muted"
            />
            <button type="submit" disabled={!canAsk || !typed.trim()} aria-label="Ask" className="p-2 text-accent disabled:opacity-30">
              <ArrowIcon className="h-5 w-5" />
            </button>
          </form>
        </section>

        {/* The interview: current answer as captions, the question index, and the transcript */}
        <div className="no-scrollbar flex min-h-0 min-w-0 flex-col gap-8 lg:overflow-y-auto lg:pb-12 lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-3rem),transparent)]">
          <section ref={nowPanel} aria-live="polite" className="scroll-mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={label}>{currentQ ? "Now answering" : "Welcome"}</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setMuted(!muted)}
                  aria-pressed={!muted}
                  className={`${label} transition hover:text-accent`}
                >
                  Voice {muted ? "off" : "on"}
                </button>
                {messages.length > 0 && (
                  <>
                    <button onClick={downloadTranscript} className={`${label} transition hover:text-accent`}>
                      Download
                    </button>
                    <button onClick={startOver} className={`${label} transition hover:text-accent`}>
                      Start over
                    </button>
                  </>
                )}
              </div>
            </div>

            {currentQ ? (
              <div className="mt-4">
                <p className="text-lg text-muted">“{currentQ.content}”</p>
                <div className="mt-4">
                  {currentA ? (
                    <Caption text={currentA.content} progress={progress} live={state === "speaking"} />
                  ) : (
                    <p className="text-2xl font-medium text-ink/40 motion-safe:animate-pulse">Thinking…</p>
                  )}
                </div>
                {currentA && canAsk && (
                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <button onClick={() => replay(currentA.content)} className="flex items-center gap-2 text-sm text-accent hover:underline">
                      <PlayIcon /> Play again
                    </button>
                    {FOLLOW_UPS.map((q) => (
                      <button key={q} onClick={() => ask(q, "follow-up")} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                  Hi, I&apos;m Utkarsh. Ask me about my work, my projects, or why I&apos;d fit at 100x.
                </p>
                <p className="mt-3 text-muted">I&apos;ll answer out loud, in my own words.</p>
                <button
                  onClick={playIntro}
                  disabled={!canAsk}
                  className="mt-5 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  <PlayIcon /> Hear my 60-second intro
                </button>
              </div>
            )}
          </section>

          <section>
            <p className={label}>Questions to start with</p>
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {EXAMPLES.map((ex, i) => (
                <li key={ex.question}>
                  <button
                    disabled={!canAsk}
                    onClick={() => ask(ex.question, "example", ex)}
                    className="group flex w-full items-baseline gap-5 py-3.5 text-left disabled:opacity-40"
                  >
                    <span className="text-xs font-medium tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 transition group-hover:translate-x-1 group-hover:text-accent">{ex.question}</span>
                    <ArrowIcon className="h-4 w-4 shrink-0 text-accent opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {earlier.length > 0 && (
            <section>
              <p className={label}>Earlier in this conversation</p>
              <div className="no-scrollbar mt-3 max-h-80 space-y-5 overflow-y-auto lg:max-h-none">
                {earlier.map((m, i) =>
                  m.role === "user" ? (
                    <p key={i} className="flex gap-4">
                      <span className="text-xs font-semibold leading-6 text-accent">Q</span>
                      <span className="text-muted">{m.content}</span>
                    </p>
                  ) : (
                    <div key={i} className="flex gap-4">
                      <span className="text-xs font-semibold leading-6 text-muted">A</span>
                      <div>
                        <p className="leading-relaxed">{m.content}</p>
                        <button
                          onClick={() => replay(m.content)}
                          disabled={!canAsk}
                          className="mt-1 flex items-center gap-2 text-xs text-muted hover:text-accent disabled:opacity-40"
                        >
                          <PlayIcon className="h-3 w-3" /> Play again
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}

          <details className="group rounded-2xl border border-line p-5 text-sm">
            <summary className={`${label} cursor-pointer list-none transition hover:text-accent`}>
              How this works <span className="inline-block transition group-open:rotate-90">→</span>
            </summary>
            <ol className="mt-4 space-y-2 text-muted">
              <li>
                <span className="font-semibold text-accent">01</span> Your voice is recorded in the browser and transcribed by Groq Whisper, with noise and silence filtered out.
              </li>
              <li>
                <span className="font-semibold text-accent">02</span> Claude Sonnet answers as Utkarsh, using only facts from his own notes, and remembers the last few messages.
              </li>
              <li>
                <span className="font-semibold text-accent">03</span> ElevenLabs speaks the answer. If it is unavailable, your browser&apos;s own voice takes over.
              </li>
            </ol>
            <p className="mt-4 text-muted">
              Guardrails: answers stay grounded in real facts, off-topic and prompt-injection requests are declined, each visitor is
              rate-limited, and spending is capped. The listed questions play pre-recorded answers instantly, and still work if the
              AI service is down.
            </p>
            <p className="mt-3 text-muted">Keyboard: Space to talk or send, Esc to stop.</p>
            {lastTiming && (
              <p className="mt-4 text-xs font-medium text-ink">
                Last answer ·{" "}
                {lastTiming.preRecorded
                  ? "pre-recorded, played instantly"
                  : [
                      lastTiming.stt !== undefined && `speech to text ${seconds(lastTiming.stt)}`,
                      `Claude ${seconds(lastTiming.llm)}`,
                      `voice ${seconds(lastTiming.tts)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </p>
            )}
          </details>
        </div>
      </div>

      <footer className="mt-6 border-t border-line pt-4 text-xs text-muted">
        Claude by Anthropic · Voice by ElevenLabs · Speech recognition by Groq
      </footer>
    </main>
  );
}
