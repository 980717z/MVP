// ─────────────────────────────────────────────────────────────────────────
//  菜号 (dish number) — the code printed beside a dish on a paper menu:
//  "1", "16", "48A", "F12", "N1", "J118". ZERO imports — pure, unit-tested.
//
//  OPTIONAL by design: plenty of dishes have no number, and a blank one must
//  never match a search or the search box would return the whole menu.
//
//  DELIBERATELY NOT RENDERED on the customer menu (app/menu/[tenant]). It is a
//  search key only: a diner holding the paper menu can type "115", and staff
//  taking a phone order can punch the number instead of the name. The printed
//  card and the QR menu stay visually independent.
// ─────────────────────────────────────────────────────────────────────────

/** Storage form: trimmed, inner whitespace collapsed, upper-cased ("f 12" →
 *  "F12"). Keeps whatever alphanumeric shape the merchant's paper menu uses —
 *  we don't invent a numbering scheme, we record theirs. */
export function cleanDishNo(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

/** Matching form: alphanumerics only, upper-cased. Strips the punctuation that
 *  creeps in from paper menus ("48." / "#48" / "48-A") on BOTH sides, so what
 *  staff type matches what was stored regardless of decoration. */
function norm(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Does `dishNo` answer the search `query`?
 *
 * PREFIX match, not substring: typing "48" finds 48 and 48A, but must NOT drag
 * in 148 or 480 — on a 400-dish menu a substring rule makes a number search
 * useless. Blank dish number or blank query is always false, so dishes without
 * a number are simply never matched this way.
 */
export function dishNoMatches(dishNo: string | null | undefined, query: string): boolean {
  const d = norm(dishNo);
  const q = norm(query);
  if (!d || !q) return false;
  return d.startsWith(q);
}
