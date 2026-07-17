// ─────────────────────────────────────────────────────────────────────────
//  alertError() — email me when prod breaks, so I hear it before fulai calls.
//  Reuses the existing Resend setup (RESEND_API_KEY). Deduped: at most one
//  email per error-signature per 15 min (a crash loop can't flood the inbox).
//  No-op when RESEND_API_KEY is unset (local dev). Never throws into the
//  request path — alerting failure must not become a second incident.
//
//  Server errors are wired via instrumentation.ts (onRequestError); client
//  crashes via app/global-error.tsx → /api/alert.
// ─────────────────────────────────────────────────────────────────────────

import { rateLimit } from "./rateLimit";

const ALERT_WINDOW_MS = 15 * 60_000; // one email per signature per 15 min

/** Cheap stable hash so repeated identical errors share a dedup key. */
function sig(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function alertError(kind: string, err: unknown, meta?: Record<string, string>): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return; // not configured (dev) — silently skip

    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? "" : "";
    const firstFrame = stack.split("\n")[1]?.trim() ?? "";
    // Dedup by kind + message + top frame (per serverless instance — a few
    // duplicate emails across instances beats missing an alert).
    if (!rateLimit(`alert:${sig(`${kind}|${message}|${firstFrame}`)}`, 1, ALERT_WINDOW_MS)) return;

    const from = process.env.LEADS_FROM || "BentoOS Alerts <onboarding@resend.dev>";
    const to = (process.env.ALERT_TO || "allen.zhang@bentoos.io").split(",").map((s) => s.trim()).filter(Boolean);
    const metaLines = meta ? Object.entries(meta).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") : "";
    const text = [`Kind: ${kind}`, `Message: ${message}`, metaLines, "", stack || "(no stack)"].filter(Boolean).join("\n");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: `🚨 BentoOS prod error — ${message.slice(0, 80)}`, text }),
    }).catch(() => {});
  } catch {
    /* alerting must never throw */
  }
}
