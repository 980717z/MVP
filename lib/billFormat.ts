// ─────────────────────────────────────────────────────────────────────────
//  Pure bill-formatting helpers (no canvas / no DOM) — shared by the thermal
//  receipt renderer (lib/ticketImage.ts) and unit-tested directly. Keeping
//  these here means the money-facing string logic can be tested without
//  loading the native @napi-rs/canvas module.
// ─────────────────────────────────────────────────────────────────────────

/** "$16.99" — two-decimal dollars, half-up rounded. */
export const money = (n: number) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

/** Signed dollar delta for a priced bill: +$5.00 / −$5.00 (proper minus glyph). */
export const signedMoney = (n: number) => (n >= 0 ? "+" : "−") + money(Math.abs(Number(n) || 0));

/** The "→ reason +$amount" line under a dish on a PRICED bill (账单 / 分单总单).
 *  • note + adjust → "  → 加炒底 +$5.00"   (reason is the staff note; amount is the delta)
 *  • note only     → "  → 加一条鱼"          (free note, no price change)
 *  • adjust only   → "  → 加价 Adjust +$5.00" (bilingual generic label — no note text)
 *  Returns null when there's nothing to annotate. Kitchen tickets don't use this
 *  (they show the note without any price — the kitchen doesn't handle money).
 *
 *  NOTE: `adjust` is expected to already be clamped at order-build time so it can't
 *  exceed the dish price (a subtract larger than base floors the line to $0). The
 *  clamp lives at the source (app/menu/[tenant]/page.tsx) so the line price and this
 *  annotation stay consistent by construction. */
export function pricedNoteLine(it: { note?: string; adjust?: number }): string | null {
  const note = (it.note || "").trim();
  const adj = Number(it.adjust) || 0;
  if (note) return adj !== 0 ? `  → ${note} ${signedMoney(adj)}` : `  → ${note}`;
  if (adj !== 0) return `  → 加价 Adjust ${signedMoney(adj)}`;
  return null;
}
