const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX = Number(process.env.RATE_LIMIT_PER_10MIN) || 20;

// Returns true if this caller is over the limit for this route
export function isRateLimited(req: Request, route: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const key = `${route}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX;
}
