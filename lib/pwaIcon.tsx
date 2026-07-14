import { ImageResponse } from "next/og";

// Shared PWA/app-icon renderer. Full-bleed emerald tile (brand #0E9F6E) with a
// BentoOS bento-box mark drawn as pure geometry — one big compartment + two
// stacked, separated by emerald gaps. Deliberately EMOJI-FREE: Satori/next-og
// emoji rendering can silently fail on some runtimes (→ blank icon → the browser
// shows its globe fallback). Plain divs render identically everywhere and stay
// legible when a 48px favicon is downscaled to 16px. Full-bleed so it doubles as
// a "maskable" Android icon and a rounded iOS/desktop icon.
export function renderAppIcon(size: number): ImageResponse {
  const pad = Math.round(size * 0.19); // tile inset around the box
  const gap = Math.max(2, Math.round(size * 0.055)); // emerald gap between compartments
  const r = Math.max(2, Math.round(size * 0.09)); // compartment corner radius
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #10b981 0%, #0E9F6E 100%)",
        }}
      >
        <div style={{ display: "flex", width: size - 2 * pad, height: size - 2 * pad, gap }}>
          {/* big left compartment (rice) */}
          <div style={{ flex: 1.5, background: "#fff", borderRadius: r }} />
          {/* two stacked right compartments (sides) */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap }}>
            <div style={{ flex: 1, background: "#fff", borderRadius: r }} />
            <div style={{ flex: 1, background: "#fff", borderRadius: r }} />
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
