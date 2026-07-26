// ─────────────────────────────────────────────────────────────────────────
//  Contact-field helpers for checkout — name + email. ZERO imports so the
//  server pickup route validates identically to the customer menu (client).
//  These are shared rules; the server re-validates rather than trusting the
//  client, same posture as lib/dish for pricing.
// ─────────────────────────────────────────────────────────────────────────

/** Deliberately permissive email check: exactly one @, non-empty local +
 *  domain, a dot in the domain, no spaces, sane length. Not RFC-perfect
 *  (no validator is) — enough to catch the typos a hurried student makes,
 *  without a domain gate (that was dropped in favour of just collecting
 *  a real contact). */
export function isValidEmail(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  return s.length >= 3 && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Store emails normalized (trimmed + lowercased) so "A@B.CA" and "a@b.ca"
 *  don't read as two students. */
export function cleanEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().slice(0, 254);
}

/** A usable customer name: trimmed, internal whitespace collapsed, bounded so
 *  a crafted request can't store a paragraph. */
export function cleanName(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

/** Non-empty after cleaning. */
export function hasName(raw: string | null | undefined): boolean {
  return cleanName(raw).length > 0;
}
