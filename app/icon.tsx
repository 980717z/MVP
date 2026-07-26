import { renderAppIcon } from "@/lib/pwaIcon";

// Favicon / browser-tab icon (Next.js auto-injects <link rel="icon">).
export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return renderAppIcon(48);
}
