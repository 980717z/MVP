import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  let body: { slug?: string; items?: InItem[]; phone?: string; note?: string };
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

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

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
  });
  if (error) {
    console.error("[pickup/create]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, tracking_token, pickup_code });
}
