import type { MetadataRoute } from "next";

// Web app manifest → makes BentoOS installable ("Add to Home Screen" / "Install
// app") on Android, iOS/iPadOS, and desktop Chrome/Edge/Safari. Next.js serves
// this at /manifest.webmanifest and auto-injects <link rel="manifest">.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BentoOS",
    short_name: "BentoOS",
    description: "餐厅后台 · 订单、桌码点单、账单打印 — Restaurant back-office & QR ordering.",
    // Open the merchant back-office when launched from the installed icon.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0E9F6E",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
