import { NextResponse } from "next/server";
import { alertError } from "@/lib/alert";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/alert — client-side crash beacon (from app/global-error.tsx).
//  Rate-limited per IP and deduped inside alertError so a render loop can't
//  flood the inbox. Always 204 — a beacon must never make the page wait.
// ─────────────────────────────────────────────────────────────────────────

const ok = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  if (!rateLimit(`alert:${clientIp(req)}`, 5, 60_000)) return ok();
  let b: { message?: string; stack?: string; digest?: string; path?: string };
  try {
    b = await req.json();
  } catch {
    return ok();
  }
  const err = new Error(String(b.message ?? "client error").slice(0, 300));
  err.stack = String(b.stack ?? "").slice(0, 4000);
  await alertError("client", err, { path: String(b.path ?? "").slice(0, 120), digest: String(b.digest ?? "") });
  return ok();
}
