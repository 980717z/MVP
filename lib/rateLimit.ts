// In-memory sliding-window rate limiter — one serverless instance's worth of
// memory, so it's a soft cap (cold starts / multi-instance reset it), not a
// hard guarantee. Good enough as a first line of defense against casual
// scripted abuse on public POST endpoints (invite spam, lead-form flooding).

const hits = new Map<string, number[]>();

/** Returns true if `key` is still under `limit` calls per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Bound memory: drop stale keys occasionally.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= cutoff)) hits.delete(k);
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
