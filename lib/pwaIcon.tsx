import { ImageResponse } from "next/og";

// Shared PWA/app-icon renderer. Full-bleed emerald square (brand #0E9F6E) with the
// BentoOS 🍱 centered — full-bleed + generous padding so the same image works as a
// "maskable" icon (Android adaptive) and as an iOS/desktop icon (the OS rounds it).
export function renderAppIcon(size: number): ImageResponse {
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
          fontSize: Math.round(size * 0.58),
          lineHeight: 1,
        }}
      >
        🍱
      </div>
    ),
    { width: size, height: size },
  );
}
