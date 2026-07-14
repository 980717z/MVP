import { renderAppIcon } from "@/lib/pwaIcon";

// Manifest icon (512×512, also used as the maskable icon). Referenced by app/manifest.ts.
export function GET() {
  return renderAppIcon(512);
}
