import Anthropic from "@anthropic-ai/sdk";
import { after } from "next/server";
import { logQA } from "@/lib/log";
import { getSystemPrompt } from "@/lib/persona";
import { isRateLimited } from "@/lib/rateLimit";

const MAX_INPUT = 300;
const HISTORY_MESSAGES = 10;
const client = new Anthropic({ timeout: 12_000, maxRetries: 1 });

// Remove markdown and emoji so the text sounds natural when spoken. "#1" becomes "number 1", digits are kept.
function cleanForSpeech(text: string) {
  return text
    // Safety net: drop any sentence where the model talks about its own notes
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !/\bthe profile\b/i.test(s))
    .join(" ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/#(\d)/g, "number $1")
    .replace(/^\s*[-•>]\s+/gm, "")
    .replace(/[*#_`]/g, "")
    .trim();
}

export async function POST(req: Request) {
  if (isRateLimited(req, "chat")) {
    return Response.json({ error: "I'm a bit busy right now. Please try again in a few minutes." }, { status: 429 });
  }

  const { messages, sessionId, source } = await req.json().catch(() => ({}));
  const history = (Array.isArray(messages) ? messages : []).slice(-HISTORY_MESSAGES).map((m: any) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: String(m.content).slice(0, 1000),
  }));
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    return Response.json({ error: "Please ask a question." }, { status: 400 });
  }
  last.content = last.content.slice(0, MAX_INPUT);

  try {
    const model = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
    const res = await client.beta.messages.create({
      model,
      // Room for a brief think plus a short answer; the prompt keeps answers to about 90 words
      max_tokens: 1500,
      // A short think at low effort keeps answers grounded without slowing them much
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      // If a safety filter wrongly declines, the API retries on a fallback model in the same call
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: getSystemPrompt(),
      messages: history,
    });
    const raw = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const text = cleanForSpeech(raw);
    if (!text) throw new Error(`empty answer (stop_reason: ${res.stop_reason})`);
    after(logQA(req, { session: sessionId, source, question: last.content, answer: text }));
    return Response.json({ text });
  } catch (err) {
    console.error("chat failed", err);
    return Response.json({ error: "Sorry, I couldn't come up with an answer. Please try again." }, { status: 502 });
  }
}
