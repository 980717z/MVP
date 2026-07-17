"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { trackFunnel } from "@/lib/analytics";

// Scoped to /menu/[tenant] only — tracks the diner's QR-menu funnel, not
// merchant back-office usage (that's a separate concern, untouched here).
export default function MenuLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  useEffect(() => {
    const slug = params.tenant as string;
    if (slug) trackFunnel(slug, "menu_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tenant]);
  return <>{children}</>;
}
