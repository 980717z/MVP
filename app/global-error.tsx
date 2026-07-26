"use client";

// Root error boundary — replaces the whole document when a render crashes, so
// a merchant sees a calm recovery screen instead of a blank white page, and we
// get a beacon about it. Renders WITHOUT the root layout (no global CSS
// guaranteed) → inline styles only, platform palette.

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname });
      navigator.sendBeacon?.("/api/alert", new Blob([body], { type: "application/json" }));
    } catch {
      /* best-effort */
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: "#FBFAF8", color: "#1A1D1B" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 380, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🍱</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Something broke on our side</h1>
            <p style={{ fontSize: 14, color: "#5B635E", margin: "0 0 20px", lineHeight: 1.5 }}>
              We’ve been notified. Your data is safe — try again in a moment.
            </p>
            <button
              onClick={() => reset()}
              style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: "none", background: "#0E9F6E", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
