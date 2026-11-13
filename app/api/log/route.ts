import { after } from "next/server";
import examples from "@/lib/examples.json";
import { logQA } from "@/lib/log";
import { isRateLimited } from "@/lib/rateLimit";

// Logs clicks on pre-generated example chips (they skip /api/chat). Only known examples can be logged.
export async function POST(req: Request) {
  if (isRateLimited(req, "log")) return new Response(null, { status: 429 });
  const { index, sessionId } = await req.json().catch(() => ({}));
  const ex: { question: string; answer?: string } | undefined = examples[index];
  if (!ex?.answer) return new Response(null, { status: 400 });

  after(logQA(req, { session: sessionId, source: "example", question: ex.question, answer: ex.answer }));
  return new Response(null, { status: 204 });
}
