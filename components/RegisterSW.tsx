"use client";

import { useEffect } from "react";

// Registers the minimal service worker (public/sw.js) so the app qualifies as an
// installable PWA on Android/desktop Chrome/Edge. iOS installs via "Add to Home
// Screen" without needing this. Failures are non-fatal (e.g. unsupported browser).
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
