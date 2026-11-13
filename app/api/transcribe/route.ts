import { isRateLimited } from "@/lib/rateLimit";

const MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"];
const MAX_BYTES = 4 * 1024 * 1024;
// Whisper often "hears" these in silence or noise
const HALLUCINATION = /^(thank you|thanks|thanks for watching|bye|you|okay|so)?[\s.!?]*$/i;

type Segment = { text: string; no_speech_prob: number; avg_logprob: number };

async function transcribe(audio: File, model: string) {
  const form = new FormData();
  form.append("file", audio, audio.name);
  form.append("model", model);
  form.append("language", "en");
  form.append("temperature", "0");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();

  // Keep only segments Whisper is confident contain real speech
  const segments: Segment[] = data.segments ?? [];
  if (!segments.length) return String(data.text ?? "").trim();
  return segments
    .filter((s) => s.no_speech_prob < 0.6 && s.avg_logprob > -1.0)
    .map((s) => s.text)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  if (isRateLimited(req, "transcribe")) {
    return Response.json({ error: "I'm a bit busy right now. Please try again in a few minutes." }, { status: 429 });
  }
  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "Voice input isn't available right now. Please type your question." }, { status: 503 });
  }

  const incoming = await req.formData().catch(() => null);
  const audio = incoming?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "I didn't catch that. Please try again." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "That was a bit long. Please keep your question under a minute." }, { status: 413 });
  }

  for (const model of MODELS) {
    try {
      const text = await transcribe(audio, model);
      return Response.json({ text: HALLUCINATION.test(text) ? "" : text });
    } catch (err) {
      console.error(`transcribe failed (${model})`, err);
    }
  }
  return Response.json({ error: "I couldn't hear that clearly. Please try again or type your question." }, { status: 502 });
}
