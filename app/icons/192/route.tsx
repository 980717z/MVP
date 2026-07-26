import { renderAppIcon } from "@/lib/pwaIcon";

// Manifest icon (192×192). Referenced by app/manifest.ts.
export function GET() {
  return renderAppIcon(192);
}
