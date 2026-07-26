import { ImageResponse } from "next/og";

// Dynamic OG card, brand emerald (DESIGN-PLATFORM.md). No shop name (fulai
// authorization pending). Next auto-attaches this to og:image / twitter:image
// site-wide; per-route pages inherit it unless they define their own.
export const runtime = "edge";
export const alt = "BentoOS — QR ordering & back-office for restaurants & cafés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0E9F6E 0%, #0B8A5E 55%, #0A6A49 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 800 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            B
          </div>
          BentoOS
        </div>
        <div style={{ marginTop: 40, fontSize: 62, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
          One dashboard for your whole shop.
        </div>
        <div style={{ marginTop: 28, fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,0.9)", maxWidth: 920 }}>
          QR ordering · kitchen tickets · sales & tax — commission-free, no hardware lock-in. Built in Toronto.
        </div>
      </div>
    ),
    { ...size },
  );
}
