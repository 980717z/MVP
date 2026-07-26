import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/pickup/notify  { order_id }   Authorization: Bearer <supabase JWT>
//  The merchant, having just CAS-flipped a pickup order to READY, asks us to
//  push "your order is ready" to whoever opted in on that order's tracking
//  screen. Authenticated as the tenant owner/member (same gate as refund) so
//  this can't be used to spam arbitrary orders. Stale subs (404/410) are pruned.
//  Env: VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//       SUPABASE_SERVICE_ROLE_KEY.
// ─────────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@bentoos.io";

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
  return true;
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // 1) authenticate the caller (merchant)
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  const uid = auth?.user?.id;
  if (authErr || !uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { order_id?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const orderId = (body.order_id ?? "").trim();
  if (!orderId) return NextResponse.json({ ok: false, error: "missing order_id" }, { status: 400 });
  // "ready" (default, pre-existing) or "cancelled" (design review 5A — the
  // student must hear about a killed order, not discover it at the truck).
  const kind = body.kind === "cancelled" ? "cancelled" : "ready";

  // 2) load the order (need tenant + pickup_code for the notification body)
  const { data: order } = await db
    .from("orders")
    .select("id, tenant_slug, order_type, pickup_code")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.order_type !== "pickup") {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // 3) caller must own or be a member of the order's tenant
  const { data: tenant } = await db.from("tenants").select("owner_id").eq("slug", order.tenant_slug).maybeSingle();
  let allowed = tenant?.owner_id === uid;
  if (!allowed) {
    const { data: m } = await db
      .from("members")
      .select("member_id")
      .eq("tenant_slug", order.tenant_slug)
      .eq("member_id", uid)
      .maybeSingle();
    allowed = !!m;
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (!ensureVapid()) return NextResponse.json({ ok: false, error: "VAPID not configured" }, { status: 500 });

  // 4) fetch this order's diner subscriptions
  const { data: subs, error } = await db
    .from("order_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("order_id", orderId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const code = order.pickup_code ? ` · ${order.pickup_code}` : "";
  const notification = JSON.stringify(
    kind === "cancelled"
      ? {
          title: "❌ 订单已取消 · Order cancelled",
          body: `这单被商家取消了，无需付款${code} · The truck cancelled this order — you haven't paid${code}`,
          url: `/order/${orderId}`,
          tag: `bento-pickup-${orderId}`,
        }
      : {
          title: "✅ 可以取餐啦 · Ready for pickup",
          body: `到餐车取餐${code} · Come pick up at the truck${code}`,
          url: `/order/${orderId}`,
          tag: `bento-pickup-${orderId}`,
        },
  );

  // 5) send to each; prune subscriptions the push service reports as gone
  const stale: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification,
        );
        sent++;
      } catch (e: any) {
        const scode = e?.statusCode;
        if (scode === 404 || scode === 410) stale.push(s.endpoint);
      }
    }),
  );
  if (stale.length) {
    await db.from("order_push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ ok: true, sent, pruned: stale.length });
}
