import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hoursStatus, type Hours } from "@/lib/hours";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  Create an order-ahead PICKUP order. Runs server-side (service role) so the
//  tracking_token + pickup_code are SERVER-generated (not the client UUID —
//  codex: bearer UUID is not a capability). Returns them to the client, which
//  navigates to /order/[id]?t=<token> to track. Order-only mode: no online
//  charge, staff settle at pickup; the ticket still prints (Epson eligibility).
// ─────────────────────────────────────────────────────────────────────────

type InItem = { id?: string; name_zh?: string; name_en?: string; price?: number | null; qty?: number; note?: string; adjust?: number; market?: boolean; noKitchen?: boolean };

// Pickup code shown at the truck: 1 letter + 2 digits, e.g. "A47". No I/O/S/Z
// (look-alikes). ~22×90 = ~2000 combos — staff also see the name, so collisions
// within a busy hour are tolerable; dedupe is a Phase-1.5 follow-up.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRTUVWXY";
function genCode(): string {
  return CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)] + String(crypto.randomInt(10, 100));
}

export async function POST(req: Request) {
  let body: { slug?: string; items?: InItem[]; phone?: string; note?: string; pickup_at?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const slug = (body.slug || "").trim();
  const items = (body.items || []).filter((it) => it && (it.name_zh || it.name_en));
  if (!slug || items.length === 0) {
    return NextResponse.json({ ok: false, error: "missing slug or items" }, { status: 400 });
  }

  // Scheduled pickup (optional; null/absent = ASAP). Server-validated window so
  // a stale tab or crafted request can't schedule food for yesterday or next
  // week: [now − 5 min, now + 12 h]. 400 (not silent-ASAP) — cooking at the
  // wrong time is worse than asking the student to re-pick.
  let requested_pickup_at: string | null = null;
  if (body.pickup_at) {
    const t = Date.parse(body.pickup_at);
    if (Number.isNaN(t) || t < Date.now() - 5 * 60_000 || t > Date.now() + 12 * 3_600_000) {
      return NextResponse.json({ ok: false, error: "取餐时间无效，请重新选择 / Pickup time is invalid — please pick again" }, { status: 400 });
    }
    requested_pickup_at = new Date(t).toISOString();
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // Truck hours gate (design review 4A). Unconfigured hours never block; when
  // configured: ASAP requires open-now, a scheduled time must land inside an
  // open window. Server-side because the client gate is just a courtesy.
  const { data: cv } = await db.from("campus_vendors").select("hours").eq("tenant_slug", slug).maybeSingle();
  const nowStatus = hoursStatus((cv?.hours ?? null) as Hours | null, new Date());
  if (!nowStatus.unconfigured) {
    if (requested_pickup_at) {
      const atStatus = hoursStatus((cv?.hours ?? null) as Hours | null, new Date(requested_pickup_at));
      if (!atStatus.open) {
        return NextResponse.json(
          { ok: false, error: nowStatus.open && nowStatus.closesAt ? `当天营业到 ${nowStatus.closesAt}，请选早一点的时间 / The truck closes at ${nowStatus.closesAt} — pick an earlier time` : "该时间不在营业时间内 / That time is outside today's hours" },
          { status: 400 },
        );
      }
    } else if (!nowStatus.open) {
      return NextResponse.json(
        { ok: false, error: nowStatus.opensAt ? `现在打烊了，${nowStatus.opensAt} 开门 / Closed right now — opens at ${nowStatus.opensAt}` : "今天已打烊 / Closed for today" },
        { status: 400 },
      );
    }
  }

  const total = Math.round(items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0) * 100) / 100;
  const id = crypto.randomUUID();
  const tracking_token = crypto.randomBytes(24).toString("base64url"); // server capability
  const pickup_code = genCode();

  const { error } = await db.from("orders").insert({
    id,
    tenant_slug: slug,
    items,
    total,
    table_no: "",
    // phone is NOT NULL + must match orders_phone_chk; blank → "N/A" sentinel.
    phone: (body.phone ?? "").trim() || "N/A",
    note: body.note ?? "",
    order_type: "pickup",
    pickup_code,
    tracking_token,
    // Spread-when-set: ASAP orders never reference the column, so the pickup
    // flow keeps working even if pickup-time.sql hasn't been run yet.
    ...(requested_pickup_at ? { requested_pickup_at } : {}),
  });
  if (error) {
    console.error("[pickup/create]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, tracking_token, pickup_code });
}
