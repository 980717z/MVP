// ─────────────────────────────────────────────────────────────────────────
//  Tiny fixed-window rate limiter. In-memory, so it is PER SERVERLESS INSTANCE
//  — not a global guarantee. It exists to blunt order-id probing / accidental
//  hammering of /api/pay/charge, not to be a hard security boundary. If we ever
//  need a real global limit, back this with Upstash/KV; the call site stays the
//  same.
// ─────────────────────────────────────────────────────────────────────────

const hits = new Map<string, { count: number; resetAt: number }>();

/** Returns true if `key` is allowed, false if it has exceeded `limit` in `windowMs`. */
export function rateLimit(key: string, limit = 10, windowMs = 10_000): boolean {
  const nowMs = Date.now();
  const cur = hits.get(key);
  if (!cur || nowMs >= cur.resetAt) {
    hits.set(key, { count: 1, resetAt: nowMs + windowMs });
    // Opportunistic sweep so the map can't grow unbounded across many IPs.
    if (hits.size > 5_000) for (const [k, v] of hits) if (nowMs >= v.resetAt) hits.delete(k);
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count++;
  return true;
}

/** Best-effort client IP from the platform headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
