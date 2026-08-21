// ─────────────────────────────────────────────────────────────────────────
//  Wait-time formatting for the floor plan. ZERO imports — pure, unit-tested.
//
//  Renders how long a table has been waiting since its FIRST unpaid round, so
//  a table that's been sitting 40 minutes can't hide behind a fresh drink round
//  (design review 2026-07-27: "oldest order = total wait").
//
//  Minute granularity ONLY. The floor plan re-renders every ~15s; a ticking
//  seconds display would jitter and read as urgent on a screen whose whole job
//  is being calm and glanceable.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Elapsed wall time as a short label.
 *
 *   < 60s   → "<1m"     (never "0m" — something IS waiting)
 *   < 60m   → "8m"
 *   ≥ 60m   → "1h05m"   (padded minutes so the width stays stable)
 *   invalid → ""        (see below)
 *
 * Returns "" for negative / NaN / non-finite input rather than rendering
 * "-3m". A staff tablet whose clock runs behind the server produces a negative
 * age, and a nonsense timer on the floor plan is worse than no timer: it makes
 * staff distrust every other number on the screen.
 */
export function formatWait(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, "0")}m`;
}

/** Convenience: wait since an epoch-ms timestamp. `at` of 0/absent → "". */
export function waitSince(at: number | null | undefined, now: number): string {
  if (!at) return "";
  return formatWait(now - at);
}
