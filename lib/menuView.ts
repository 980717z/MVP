// ─────────────────────────────────────────────────────────────────────────
//  Menu view resolution — phone vs desktop/iPad layout for the QR menu.
//
//  Precedence (pure, testable): a stored manual override always wins; with no
//  override we fall back to viewport width (≥768px → desktop). The auto path is
//  also expressed as CSS `md:` breakpoints in the layout so the FIRST paint is
//  correct with zero JS (no hydration flash); this function drives the manual
//  override attribute + the toggle's active state.
// ─────────────────────────────────────────────────────────────────────────

export type MenuView = "phone" | "desktop";

/** Resolve the effective view. `stored` is the saved manual choice (or null =
 *  auto); `wide` is whether the viewport is ≥768px. Manual choice beats width. */
export function resolveMenuView(stored: string | null | undefined, wide: boolean): MenuView {
  if (stored === "phone" || stored === "desktop") return stored;
  return wide ? "desktop" : "phone";
}

export const MENU_VIEW_KEY = "bento_menu_view";
