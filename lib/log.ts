// Q&A log stored in Upstash Redis. Does nothing if Upstash isn't configured.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = "qa-log";
const MAX_ENTRIES = 5000;

export type LogEntry = {
  time: string;
  session: string;
  source: string;
  country: string;
  device: string;
  question: string;
  answer: string;
};

async function redis(...command: (string | number)[]) {
  if (!url || !token) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return (await res.json()).result;
}

// Only non-identifying visitor details: country and device type, no IP
export async function logQA(req: Request, entry: { session: unknown; source: unknown; question: string; answer: string }) {
  const ua = req.headers.get("user-agent") ?? "";
  const row: LogEntry = {
    time: new Date().toISOString(),
    session: String(entry.session ?? "").slice(0, 40),
    source: String(entry.source ?? "").slice(0, 20),
    country: req.headers.get("x-vercel-ip-country") ?? "unknown",
    device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "phone" : "desktop",
    question: entry.question,
    answer: entry.answer,
  };
  try {
    await redis("LPUSH", KEY, JSON.stringify(row));
    await redis("LTRIM", KEY, 0, MAX_ENTRIES - 1);
  } catch (err) {
    console.error("log failed", err);
  }
}

export async function readLog(limit = 500): Promise<LogEntry[]> {
  const rows: string[] = (await redis("LRANGE", KEY, 0, limit - 1)) ?? [];
  return rows.map((r) => JSON.parse(r));
}
