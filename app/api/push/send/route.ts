import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  Web Push sender. Called by a Supabase Database Webhook on INSERT into
//  public.orders. For the order's tenant, looks up every stored push
//  subscription and sends an OS notification (works even when the merchant's
//  app is closed / device locked). Stale subscriptions (404/410) are pruned.
//
//  Secured by a shared secret header so only our Supabase webhook can call it.
//  Env: VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
//       PUSH_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY.
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

type OrderRow = {
  tenant_slug?: string;
  total?: number;
  table_no?: string;
  items?: Array<{ qty?: number; name_zh?: string; name_en?: string }>;
  status?: string;
};

function buildBody(order: OrderRow): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const count = items.reduce((n, it) => n + (Number(it?.qty) || 1), 0);
  const table = order.table_no ? `桌 ${order.table_no} · ` : "";
  const total = typeof order.total === "number" ? `$${order.total.toFixed(2)}` : "";
  return `${table}${count} 件 · ${total}`.trim();
}

export async function POST(req: Request) {
  // 1) authenticate the webhook caller
  const secret = req.headers.get("x-webhook-secret") ?? "";
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!ensureVapid()) {
    return NextResponse.json({ ok: false, error: "VAPID not configured" }, { status: 500 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // 2) parse the Supabase webhook payload: { type, table, record, old_record }
  let payload: { type?: string; record?: OrderRow } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const order = payload.record ?? {};
  const slug = order.tenant_slug;
  if (!slug) return NextResponse.json({ ok: false, error: "no tenant_slug" }, { status: 400 });

  // 3) fetch this tenant's subscriptions (service role → bypasses RLS)
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("tenant_slug", slug);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const notification = JSON.stringify({
    title: "🔔 新订单 New order",
    body: buildBody(order),
    url: `/${slug}`,
    tag: "bento-order",
  });

  // 4) send to each; prune subscriptions the push service reports as gone
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
        const code = e?.statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
      }
    }),
  );
  if (stale.length) {
    await db.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ ok: true, sent, pruned: stale.length });
}
