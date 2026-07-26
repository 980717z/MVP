// ─────────────────────────────────────────────────────────────────────────
//  track() — fire-and-forget traction beacon → /api/track → events table.
//  PII-free by construction: no user ids, no phone/email, and the session id
//  is a random token minted into sessionStorage (dies with the tab session).
//  Never throws, never blocks rendering, no-ops during SSR. If the beacon is
//  lost (ad-blocker, offline) nothing breaks — orders remain the source of
//  transactional truth; this only feeds the /admin funnel.
// ─────────────────────────────────────────────────────────────────────────

export type TrackName =
  | "campus_page_view" // /campus or /utoronto landing viewed
  | "directory_view"   // /eat directory viewed
  | "vendor_card_tap"  // a directory vendor card tapped (tenant = vendor)
  | "menu_view"        // /menu/[tenant] viewed (src says how they arrived)
  | "order_placed";    // customer order submitted from the menu

/** Random per-browser-session token so the funnel can be de-duplicated
 *  without identifying anyone. sessionStorage-scoped: closes with the tab. */
function sessionId(): string {
  try {
    const k = "bento_sid";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(k, v);
    }
    return v;
  } catch {
    return ""; // storage blocked — still count the event, just un-sessioned
  }
}

export function track(
  name: TrackName,
  opts?: { tenant?: string; src?: string; meta?: Record<string, string | number | boolean> },
): void {
  try {
    if (typeof window === "undefined") return; // SSR no-op
    const body = JSON.stringify({
      name,
      tenant: opts?.tenant ?? "",
      path: window.location.pathname,
      src: opts?.src ?? "",
      sid: sessionId(),
      meta: opts?.meta ?? {},
    });
    // sendBeacon survives page unloads (order → redirect); fall back to
    // keepalive fetch where beacon is unavailable.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* analytics must never break the product */
  }
}
