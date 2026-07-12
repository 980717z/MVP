import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeTax } from "@/lib/tax";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/table/checkout   Authorization: Bearer <supabase JWT>
//  Body: { slug, tableNo, paymentMethod: 'cash'|'card'|'other', amountTendered? }
//
//  Settles a dine-in table: claims every UNPAID dine-in order at the table in
//  ONE atomic UPDATE (…WHERE payment_status='unpaid' RETURNING *) — two waiters
//  race, exactly one wins the rows, the loser gets none. That single claim IS
//  the exactly-once guarantee, so the sales/dish/member posting (two of which
//  are not idempotent) runs once. Writes a checkout record (table_sessions) and
//  posts the ledger. Dine-in pays at the counter — this RECORDS the payment
//  (method + tendered + change); it is not an online charge.
// ─────────────────────────────────────────────────────────────────────────

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Shop-tz (Toronto) business date, so the day's books are stable for remote owners.
function shopBusinessDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

type Item = { name_zh: string; name_en?: string; qty: number; price: number | null; market?: boolean; cancelled?: boolean };
const activeItems = (o: { items: Item[] }) => (o.items ?? []).filter((it) => !it.cancelled);
const orderTotal = (o: { items: Item[] }) =>
  money(activeItems(o).reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0));

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // 1) authenticate
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  const uid = auth?.user?.id;
  if (authErr || !uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: { slug?: string; tableNo?: string; paymentMethod?: string; amountTendered?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  const tableNo = (body.tableNo ?? "").trim();
  const method = (body.paymentMethod ?? "").trim();
  const tendered = body.amountTendered == null ? null : money(body.amountTendered);
  if (!slug || !tableNo) return NextResponse.json({ ok: false, error: "缺少桌号" }, { status: 400 });
  if (!["cash", "card", "other"].includes(method)) return NextResponse.json({ ok: false, error: "付款方式无效" }, { status: 400 });

  // 2) caller must own or be a member of the tenant
  const { data: tenant } = await db.from("tenants").select("owner_id").eq("slug", slug).maybeSingle();
  if (!tenant) return NextResponse.json({ ok: false, error: "商家不存在" }, { status: 404 });
  let allowed = tenant.owner_id === uid;
  if (!allowed) {
    const { data: m } = await db.from("members").select("member_id").eq("tenant_slug", slug).eq("member_id", uid).maybeSingle();
    allowed = !!m;
  }
  if (!allowed) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  // 3) preview: the table's unpaid dine-in orders (for the 时价 gate + cash check)
  const { data: preview } = await db
    .from("orders")
    .select("id,items,total")
    .eq("tenant_slug", slug)
    .eq("table_no", tableNo)
    .eq("order_type", "dine_in")
    .eq("payment_status", "unpaid");
  const previewOrders = (preview ?? []) as { id: string; items: Item[]; total: number }[];
  if (previewOrders.length === 0) return NextResponse.json({ ok: true, empty: true });

  // market-price (时价) gate — client must price these before checkout
  const unpriced = previewOrders.some((o) => activeItems(o).some((it) => it.market && !(Number(it.price) > 0)));
  if (unpriced) return NextResponse.json({ ok: false, error: "有时价菜品未录入价格，请先录入", needsPricing: true }, { status: 409 });

  const previewSubtotal = money(previewOrders.reduce((s, o) => s + orderTotal(o), 0));
  const previewTax = computeTax(previewSubtotal, false);
  if (method === "cash" && tendered != null && tendered < previewTax.total)
    return NextResponse.json({ ok: false, error: "收款金额不足", total: previewTax.total }, { status: 400 });

  // 4) ATOMIC CLAIM — the exactly-once anchor. Only one caller's UPDATE returns rows.
  const { data: claimedRows, error: claimErr } = await db
    .from("orders")
    .update({ payment_status: "paid", status: "done", paid_at: new Date().toISOString(), payment_method: "server", sales_posted_at: new Date().toISOString() })
    .eq("tenant_slug", slug)
    .eq("table_no", tableNo)
    .eq("order_type", "dine_in")
    .eq("payment_status", "unpaid")
    .select("*");
  if (claimErr) return NextResponse.json({ ok: false, error: claimErr.message }, { status: 500 });
  const claimed = (claimedRows ?? []) as { id: string; items: Item[]; phone: string }[];
  if (claimed.length === 0) return NextResponse.json({ ok: true, alreadyDone: true });

  // 5) authoritative totals from the CLAIMED rows
  const subtotal = money(claimed.reduce((s, o) => s + orderTotal(o), 0));
  const tax = computeTax(subtotal, false);
  const change = method === "cash" && tendered != null ? money(tendered - tax.total) : null;

  // 6) checkout record
  const { data: session } = await db
    .from("table_sessions")
    .insert({
      tenant_slug: slug,
      table_no: tableNo,
      closed_by: uid,
      payment_method: method,
      amount_tendered: method === "cash" ? tendered : null,
      change_given: change,
      subtotal: tax.subtotal,
      gst: tax.gst,
      pst: tax.pst,
      total: tax.total,
      business_date: shopBusinessDate(),
    })
    .select("id")
    .single();
  const sessionId = session?.id ?? null;
  if (sessionId) await db.from("orders").update({ table_session_id: sessionId }).in("id", claimed.map((o) => o.id));

  // 7) post sales ONCE (over the claimed set only) — mirrors lib/store posting, server-side.
  await postClaimedSales(db, slug, claimed);

  return NextResponse.json({ ok: true, sessionId, subtotal: tax.subtotal, hst: money(tax.gst + tax.pst), total: tax.total, change });
}

// Sales ledger + dish counts + member spend for a settled table, using the admin
// client. recordOrderSale-equivalent is idempotent per orderId; dish/member post
// once over the claimed set (which the atomic claim guarantees is unique to us).
async function postClaimedSales(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  slug: string,
  claimed: { id: string; items: Item[]; phone: string }[],
) {
  try {
    // sales ledger — one row per order, idempotent by orderId
    const { data: existingSales } = await db.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "sales");
    const seen = new Set((existingSales ?? []).map((r) => r.data?.orderId).filter(Boolean));
    const now = new Date();
    const date = shopBusinessDate();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const saleRows = claimed
      .filter((o) => !seen.has(o.id))
      .map((o) => {
        const items = activeItems(o);
        const t = computeTax(money(items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0)), false);
        return {
          tenant_slug: slug,
          module_id: "sales",
          data: {
            date, ts, source: "qr", desc: items.map((it) => `${it.name_zh}×${it.qty}`).join(", "),
            subtotal: String(t.subtotal), gst: String(t.gst), pst: String(t.pst), total: String(t.total), orderId: o.id,
          },
        };
      });
    if (saleRows.length) await db.from("records").insert(saleRows);

    // dish counts (soldMonth) — merged across the table, once
    const want = new Map<string, { qty: number; price?: string }>();
    for (const o of claimed) for (const it of activeItems(o)) {
      const name = (it.name_zh || "").trim();
      const qty = Number(it.qty) || 0;
      if (!name || !qty) continue;
      const e = want.get(name) ?? { qty: 0 };
      e.qty += qty;
      if (e.price == null && it.price != null) e.price = String(it.price);
      want.set(name, e);
    }
    if (want.size) {
      const { data: dishes } = await db.from("records").select("id,data").eq("tenant_slug", slug).eq("module_id", "dish-margin");
      const byDish = new Map((dishes ?? []).map((r) => [r.data?.dish, r]));
      for (const [dish, { qty, price }] of want) {
        const match = byDish.get(dish);
        if (match) {
          const prev = match.data ?? {};
          const sold = (parseFloat(prev.soldMonth) || 0) + qty;
          await db.from("records").update({ data: { ...prev, soldMonth: String(sold), price: prev.price && prev.price !== "" ? prev.price : price ?? "" } }).eq("id", match.id);
        } else {
          await db.from("records").insert({ tenant_slug: slug, module_id: "dish-margin", data: { dish, price: price ?? "", cost: "", soldMonth: String(qty) } });
        }
      }
    }

    // member spend — one visit, merged spend, credited to the single real phone if present
    const phones = [...new Set(claimed.map((o) => (o.phone || "").trim()).filter((p) => p && p !== "N/A"))];
    if (phones.length === 1) {
      const spend = money(claimed.reduce((s, o) => s + orderTotal(o), 0));
      const { data: members } = await db.from("records").select("id,data").eq("tenant_slug", slug).eq("module_id", "members");
      const match = (members ?? []).find((r) => r.data?.phone === phones[0]);
      if (match) {
        const prev = match.data ?? {};
        const visits = (parseInt(prev.visits) || 0) + 1;
        const newSpend = money((parseFloat(prev.spend) || 0) + spend);
        await db.from("records").update({ data: { ...prev, visits: String(visits), spend: String(newSpend) } }).eq("id", match.id);
      } else {
        await db.from("records").insert({ tenant_slug: slug, module_id: "members", data: { phone: phones[0], name: "", visits: "1", spend: String(spend), tier: "", note: "" } });
      }
    }
  } catch (e) {
    console.error("[checkout] postClaimedSales", e);
  }
}
