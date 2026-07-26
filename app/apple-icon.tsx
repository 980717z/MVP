import { renderAppIcon } from "@/lib/pwaIcon";

// iOS/iPadOS home-screen icon (Next.js auto-injects <link rel="apple-touch-icon">).
// Full-bleed square — iOS applies its own rounded-corner mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderAppIcon(180);
}
