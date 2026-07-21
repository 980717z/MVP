// ─────────────────────────────────────────────────────────────────────────
//  Menu language resolution — which languages a shop's customer menu offers,
//  and which one is active. Pure so the rules are testable without a DOM.
//
//  A shop stores tenants.menu_langs (ordered; first = default). The customer
//  menu uses it to decide: show the language toggle at all? show the
//  other-language dish subtitle? A non-Chinese vendor (e.g. Pita Express) is
//  ['en'] → no toggle, no Chinese under the dishes. Dish data is zh/en only,
//  so anything else is ignored. Absent/empty → bilingual zh/en (back-compat:
//  the menu never breaks before the migration runs).
// ─────────────────────────────────────────────────────────────────────────

export type MenuLang = "zh" | "en";

/** The languages the menu actually offers. Falls back to bilingual zh/en when
 *  menu_langs is missing/empty (pre-migration) or contains nothing we can
 *  render. First entry is the default/primary language. */
export function resolveOfferedLangs(menuLangs: unknown): MenuLang[] {
  const valid = Array.isArray(menuLangs)
    ? menuLangs.filter((l): l is MenuLang => l === "zh" || l === "en")
    : [];
  // De-dupe while preserving order (['en','en'] → ['en']).
  const seen = new Set<MenuLang>();
  const out = valid.filter((l) => (seen.has(l) ? false : (seen.add(l), true)));
  return out.length ? out : ["zh", "en"];
}

/** Force an active language into what the shop offers. A stored/URL "zh" on an
 *  English-only vendor must resolve to the vendor's default, or the diner is
 *  stranded reading a language with no toggle back. */
export function clampLang(active: MenuLang, offered: MenuLang[]): MenuLang {
  return offered.includes(active) ? active : offered[0];
}

/** More than one language → render the toggle + the other-language subtitle. */
export function isBilingual(offered: MenuLang[]): boolean {
  return offered.length > 1;
}
