import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pickup/subscribe  { order_id, token, subscription }
//  The anonymous diner opts in to a "your order is ready" push. There is NO
//  raw anon insert (spam / DoS / existence-oracle): this route runs server-side
//  (service role) and only writes after verifying the order's tracking_token —
//  the same capability that gates the tracking read. Deduped on
//  (order_id, endpoint_hash); capped per order; refused once picked up.
// ─────────────────────────────────────────────────────────────────────────

const MAX_SUBS_PER_ORDER = 5; // one diner may open the link on a couple devices

type PushSub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  let body: { order_id?: string; token?: string; subscription?: PushSub };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const orderId = (body.order_id ?? "").trim();
  const token = (body.token ?? "").trim();
  const sub = body.subscription ?? {};
  const endpoint = (sub.endpoint ?? "").trim();
  const p256dh = (sub.keys?.p256dh ?? "").trim();
  const auth = (sub.keys?.auth ?? "").trim();
  if (!orderId || !token || !endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }
  // A well-formed Web Push endpoint is an https URL; reject anything else so we
  // never store attacker-supplied junk as a "subscription".
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1024) {
    return NextResponse.json({ ok: false, error: "bad endpoint" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // Verify the capability: the token must match THIS pickup order, and it must
  // still be in flight. Same gate as the tracking read.
  const { data: order } = await db
    .from("orders")
    .select("id, tracking_token, order_type, picked_up_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.tracking_token !== token || order.order_type !== "pickup") {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  if (order.picked_up_at) {
    return NextResponse.json({ ok: false, error: "order already picked up" }, { status: 409 });
  }

  const endpoint_hash = sha256(endpoint);

  // Cap: count existing rows for this order; allow re-subscribing the SAME
  // device (its hash already exists) but refuse growing past the cap.
  const { data: existing } = await db
    .from("order_push_subscriptions")
    .select("endpoint_hash")
    .eq("order_id", orderId);
  const known = new Set((existing ?? []).map((r) => r.endpoint_hash));
  if (!known.has(endpoint_hash) && known.size >= MAX_SUBS_PER_ORDER) {
    return NextResponse.json({ ok: false, error: "too many devices" }, { status: 429 });
  }

  const { error } = await db.from("order_push_subscriptions").upsert(
    { order_id: orderId, endpoint_hash, endpoint, p256dh, auth },
    { onConflict: "order_id,endpoint_hash" },
  );
  if (error) {
    console.error("[pickup/subscribe]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
