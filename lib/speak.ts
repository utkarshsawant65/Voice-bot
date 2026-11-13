let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audio: HTMLAudioElement | null = null;
let stopCurrent: (() => void) | null = null;

// Generated audio is kept per answer, so "Play again" costs no credits
const cache = new Map<string, string>();
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// Call from a tap. iOS only allows later playback if something plays inside that tap.
export function unlockAudio() {
  if (!audio) {
    audio = new Audio();
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    ctx.createMediaElementSource(audio).connect(analyser);
    analyser.connect(ctx.destination);
    audio.src = SILENT_WAV;
    audio.play().catch(() => {});
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""));
  }
  ctx?.resume();
}

export function stopSpeaking() {
  stopCurrent?.();
}

type SpeakOptions = {
  audioUrl?: string; // a pre-generated file
  onLevel?: (level: number) => void; // voice volume, 0 to 1
  onProgress?: (progress: number) => void; // how much has been spoken, 0 to 1
  onStart?: () => void;
};

export async function speak(text: string, { audioUrl, onLevel = () => {}, onProgress = () => {}, onStart }: SpeakOptions = {}) {
  stopSpeaking();
  try {
    let url = audioUrl ?? cache.get(text);
    if (!url) {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts unavailable");
      url = URL.createObjectURL(await res.blob());
      cache.set(text, url);
    }
    await playUrl(url, onLevel, onProgress, onStart);
  } catch {
    await speakWithBrowser(text, onLevel, onProgress, onStart);
  }
}

function playUrl(url: string, onLevel: (level: number) => void, onProgress: (p: number) => void, onStart?: () => void) {
  return new Promise<void>((resolve, reject) => {
    if (!audio || !analyser) return reject(new Error("audio not unlocked"));
    const el = audio;
    const node = analyser;
    const samples = new Uint8Array(node.fftSize);
    let frame = 0;

    const finish = () => {
      cancelAnimationFrame(frame);
      el.onended = el.onerror = null;
      el.pause();
      onLevel(0);
      stopCurrent = null;
      resolve();
    };
    const tick = () => {
      node.getByteTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / samples.length);
      onLevel(Math.min(1, rms * 4));
      if (el.duration) onProgress(el.currentTime / el.duration);
      frame = requestAnimationFrame(tick);
    };

    el.onended = finish;
    el.onerror = () => {
      finish();
      reject(new Error("playback failed"));
    };
    stopCurrent = finish;
    el.src = url;
    el.play().then(
      () => {
        onStart?.();
        tick();
      },
      (e) => {
        finish();
        reject(e);
      },
    );
  });
}

// Fallback voice. Speaks sentence by sentence because Chrome cuts off long text.
async function speakWithBrowser(
  text: string,
  onLevel: (level: number) => void,
  onProgress: (p: number) => void,
  onStart?: () => void,
) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  // Android Chrome drops speech that starts right after cancel()
  await new Promise((r) => setTimeout(r, 100));
  const voice = await pickVoice();
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  let stopped = false;
  const flap = setInterval(() => onLevel(Math.random() > 0.4 ? 0.8 : 0.1), 130);

  stopCurrent = () => {
    stopped = true;
    synth.cancel();
  };
  onStart?.();
  for (const [i, sentence] of sentences.entries()) {
    if (stopped) break;
    onProgress((i + 1) / sentences.length);
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence.trim());
      if (voice) u.voice = voice;
      u.onend = u.onerror = () => resolve();
      // Some browsers never fire onend, so don't wait forever
      setTimeout(resolve, 2000 + sentence.length * 120);
      synth.speak(u);
    });
  }
  clearInterval(flap);
  onLevel(0);
  stopCurrent = null;
}

// Prefer natural-sounding voices, then Indian and US English. Voices load late in some browsers.
function pickVoice() {
  const rank = (v: SpeechSynthesisVoice) =>
    (/natural|online/i.test(v.name) ? 0 : 3) + (v.lang === "en-IN" ? 0 : v.lang === "en-US" ? 1 : 2);
  const find = () =>
    speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith("en"))
      .sort((a, b) => rank(a) - rank(b))[0];
  return new Promise<SpeechSynthesisVoice | undefined>((resolve) => {
    if (speechSynthesis.getVoices().length) return resolve(find());
    speechSynthesis.onvoiceschanged = () => resolve(find());
    setTimeout(() => resolve(undefined), 1000);
  });
}
