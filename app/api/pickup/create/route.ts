import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pickupGate, type Hours } from "@/lib/hours";
import { lineName, isNoCookDish, unitPrice, type DishLike } from "@/lib/dish";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  Create an order-ahead PICKUP order. Runs server-side (service role) so the
//  tracking_token + pickup_code are SERVER-generated (not the client UUID —
//  codex: bearer UUID is not a capability). Returns them to the client, which
//  navigates to /order/[id]?t=<token> to track. Order-only mode: no online
//  charge, staff settle at pickup; the ticket still prints (Epson eligibility).
//
//  SERVER-AUTHORITATIVE (eng review T1). This route is the ONLY way a pickup
//  order can be created — supabase/pickup-server-only.sql forbids anon inserts
//  of order_type='pickup', so the hours gate below is genuinely load-bearing
//  rather than a client courtesy. Everything that reaches the kitchen ticket is
//  rebuilt here from `menu_items`:
//
//    client sends            server decides
//    ─────────────────       ───────────────────────────────────────────────
//    id, vi, qty, note   →   trusted as a SELECTION (validated against the menu)
//    price, total        →   IGNORED — recomputed from menu_items
//    name_zh/name_en     →   IGNORED — rebuilt via lineName(dish, variant)
//    noKitchen, market   →   IGNORED — derived from the dish
//    adjust              →   IGNORED — staff-only concept, not a customer input
// ─────────────────────────────────────────────────────────────────────────

/** What the client may send per line: a selection, not a price. */
type InItem = { id?: string; vi?: number | null; qty?: number; note?: string };

/** Sanity bounds so one crafted request can't spool a novel to the kitchen
 *  printer. Far above any real order — the rate-limit trigger caps how OFTEN
 *  orders arrive, these cap how BIG one is. */
const MAX_LINES = 50;
const MAX_QTY_PER_LINE = 99;
const MAX_NOTE_LEN = 200;

// Pickup code shown at the truck: 1 letter + 2 digits, e.g. "A47". No I/O/S/Z
// (look-alikes). ~22×90 = ~2000 combos — staff also see the name, so collisions
// within a busy hour are tolerable; dedupe is a Phase-1.5 follow-up.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRTUVWXY";
function genCode(): string {
  return CODE_LETTERS[crypto.randomInt(CODE_LETTERS.length)] + String(crypto.randomInt(10, 100));
}

type MenuRow = DishLike & { id: string; sold_out?: boolean | null };

const RETRY_LATER = "暂时无法下单，请稍后再试 / Can't take orders right now — please try again in a moment";
const MENU_CHANGED = "菜单已更新，请刷新后重试 / The menu changed — please refresh and try again";

export async function POST(req: Request) {
  let body: { slug?: string; items?: InItem[]; phone?: string; note?: string; pickup_at?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const slug = (body.slug || "").trim();
  const rawItems = Array.isArray(body.items) ? body.items.filter((it) => it && typeof it.id === "string" && it.id) : [];
  if (!slug || rawItems.length === 0) {
    return NextResponse.json({ ok: false, error: "missing slug or items" }, { status: 400 });
  }
  if (rawItems.length > MAX_LINES) {
    return NextResponse.json({ ok: false, error: "订单过大 / Order is too large" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // ── Truck hours gate (design review 4A; eng review T2) ───────────────────
  //  Fail CLOSED when the read errors: a DB blip must not silently disable
  //  closing time. Fail OPEN only when the row is genuinely absent — that means
  //  a non-campus tenant (e.g. fulai), which has no hours and is never gated.
  const { data: cv, error: cvErr } = await db
    .from("campus_vendors")
    .select("hours")
    .eq("tenant_slug", slug)
    .maybeSingle();
  if (cvErr) {
    console.error("[pickup/create] hours read", cvErr.message);
    return NextResponse.json({ ok: false, error: RETRY_LATER }, { status: 503 });
  }

  const gate = pickupGate((cv?.hours ?? null) as Hours | null, body.pickup_at, new Date());
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: 400 });
  const requested_pickup_at = gate.requestedPickupAt;

  // ── Rebuild every line from the menu (client prices/names are ignored) ────
  const ids = [...new Set(rawItems.map((it) => String(it.id)))];
  const { data: menuRows, error: menuErr } = await db
    .from("menu_items")
    .select("id,name_zh,name_en,price,variants,category,is_market,sold_out")
    .eq("tenant_slug", slug)
    .in("id", ids);
  if (menuErr) {
    console.error("[pickup/create] menu read", menuErr.message);
    return NextResponse.json({ ok: false, error: RETRY_LATER }, { status: 503 });
  }
  const byId = new Map<string, MenuRow>(((menuRows ?? []) as MenuRow[]).map((d) => [d.id, d]));

  const items: Record<string, unknown>[] = [];
  for (const it of rawItems) {
    // Unknown id = not this tenant's menu (or deleted mid-order). Reject rather
    // than silently dropping the line — the student should see why.
    const dish = byId.get(String(it.id));
    if (!dish) return NextResponse.json({ ok: false, error: MENU_CHANGED }, { status: 400 });
    if (dish.sold_out) {
      return NextResponse.json(
        { ok: false, error: `已售完：${dish.name_zh} / Sold out: ${dish.name_en || dish.name_zh}` },
        { status: 400 },
      );
    }

    const qty = Math.floor(Number(it.qty) || 1);
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return NextResponse.json({ ok: false, error: "数量无效 / Invalid quantity" }, { status: 400 });
    }

    const viRaw = it.vi == null ? null : Number(it.vi);
    const vi = viRaw != null && Number.isInteger(viRaw) && viRaw >= 0 ? viRaw : null;
    const variant = vi != null ? dish.variants?.[vi] ?? null : null;
    // A multi-size dish must carry a chosen size, or we'd charge the base price
    // the student never saw.
    if ((dish.variants?.length ?? 0) > 0 && !variant) {
      return NextResponse.json({ ok: false, error: "请选择规格 / Please choose a size" }, { status: 400 });
    }

    const price = unitPrice(dish, vi);
    // 时价 (market price): no fixed price — staff price it at the truck.
    const isMarket = !!dish.is_market && !(price > 0);
    if (!isMarket && !(price > 0)) {
      return NextResponse.json({ ok: false, error: MENU_CHANGED }, { status: 400 });
    }

    items.push({
      id: dish.id,
      name_zh: lineName(dish, variant),
      name_en: lineName(dish, variant, true),
      price: isMarket ? null : price,
      qty,
      ...(vi != null && variant ? { vi } : {}),
      ...(isMarket ? { market: true } : {}),
      ...(typeof it.note === "string" && it.note.trim() ? { note: it.note.trim().slice(0, MAX_NOTE_LEN) } : {}),
      ...(isNoCookDish(dish) ? { noKitchen: true } : {}),
    });
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
    note: (body.note ?? "").slice(0, MAX_NOTE_LEN),
    order_type: "pickup",
    pickup_code,
    tracking_token,
    // Spread-when-set: ASAP orders never reference the column, so the pickup
    // flow keeps working even if pickup-time.sql hasn't been run yet.
    ...(requested_pickup_at ? { requested_pickup_at } : {}),
  });
  if (error) {
    console.error("[pickup/create]", error.message);
    // 53400 = the orders_rate_limit trigger tripped: the caller should slow
    // down, it is not a server fault. Surface it as 429 with the trigger's own
    // bilingual message instead of a generic 500.
    const isRateLimit = (error as { code?: string }).code === "53400";
    return NextResponse.json({ ok: false, error: error.message }, { status: isRateLimit ? 429 : 500 });
  }

  return NextResponse.json({ ok: true, id, tracking_token, pickup_code });
}
