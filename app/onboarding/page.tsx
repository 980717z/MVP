"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Store creation now happens in the forced naming step at /app.
export default function OnboardingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app");
  }, [router]);
  return <main className="grid min-h-screen place-items-center text-ink-faint">载入中…</main>;
}
