import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeTax } from "@/lib/tax";
import { reconcileShares, partitionsMatch, type SplitPayload, type SplitShare } from "@/lib/billSplit";

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
const cents = (n: number) => Math.round((Number(n) || 0) * 100);

// Shop-tz (Toronto) business date, so the day's books are stable for remote owners.
function shopBusinessDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

type Item = { name_zh: string; name_en?: string; qty: number; price: number | null; market?: boolean; cancelled?: boolean; note?: string; adjust?: number };
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

  let body: { slug?: string; tableNo?: string; paymentMethod?: string; amountTendered?: number; split?: SplitPayload | null; tip?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const slug = (body.slug ?? "").trim();
  const tableNo = (body.tableNo ?? "").trim();
  const method = (body.paymentMethod ?? "").trim();
  const tendered = body.amountTendered == null ? null : money(body.amountTendered);
  const singleTip = Math.max(0, body.tip == null ? 0 : money(body.tip)); // whole-bill tip (single); split tips ride each share
  const split = body.split && Array.isArray(body.split.shares) && body.split.shares.length >= 2 ? body.split : null;
  if (!slug || !tableNo) return NextResponse.json({ ok: false, error: "缺少桌号" }, { status: 400 });
  if (!["cash", "card", "emt", "other"].includes(method)) return NextResponse.json({ ok: false, error: "付款方式无效" }, { status: 400 });

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

  // Split validation runs BEFORE the atomic claim so a bad split never settles a
  // table. Shares must sum to the table subtotal to the cent; each cash share must
  // cover its own total. (Server re-taxes authoritatively after the claim.)
  if (split) {
    const parts = split.shares.map((s) => money(s.subtotal));
    if (parts.some((p) => p < 0) || !partitionsMatch(previewSubtotal, parts))
      return NextResponse.json({ ok: false, error: "分单金额与合计不符" }, { status: 400 });
    if (split.shares.some((s) => !["cash", "card", "emt", "other"].includes((s.method ?? "").trim())))
      return NextResponse.json({ ok: false, error: "分单付款方式无效" }, { status: 400 });
    const taxed = reconcileShares(previewSubtotal, parts);
    const shortShare = split.shares.findIndex((s, i) => s.method === "cash" && s.tendered != null && money(s.tendered) < taxed[i].total);
    if (shortShare >= 0) return NextResponse.json({ ok: false, error: `第 ${shortShare + 1} 份收款不足` }, { status: 400 });
  }

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

  // 5b) build the split record — ONLY if the settled subtotal still matches what
  // the split was validated against (an order changing mid-checkout falls back to
  // a single bill so a stale partition can never mis-record money).
  let splits: SplitShare[] = [];
  let splitMode = "single";
  if (split && cents(subtotal) === cents(previewSubtotal)) {
    const taxed = reconcileShares(subtotal, split.shares.map((s) => money(s.subtotal)));
    splits = split.shares.map((s, i) => {
      const t = taxed[i];
      const tip = Math.max(0, s.tip == null ? 0 : money(s.tip));
      const tnd = s.method === "cash" && s.tendered != null ? money(s.tendered) : null;
      return {
        label: (s.label ?? `第 ${i + 1} 份`).slice(0, 40),
        method: s.method,
        subtotal: t.subtotal, gst: t.gst, pst: t.pst, total: t.total, tip,
        // change is against the BILL only; a tip is money left on top, not netted here
        tendered: tnd, change: tnd != null ? money(tnd - t.total) : null,
        evenOfN: s.evenOfN, lines: split.mode === "item" ? (s.lines ?? []) : undefined,
      };
    });
    splitMode = split.mode;
  }
  const isSplit = splits.length >= 2;
  const tipTotal = isSplit ? money(splits.reduce((a, s) => a + (s.tip ?? 0), 0)) : singleTip;

  // 6) checkout record
  const { data: session } = await db
    .from("table_sessions")
    .insert({
      tenant_slug: slug,
      table_no: tableNo,
      closed_by: uid,
      payment_method: isSplit ? "split" : method,
      amount_tendered: !isSplit && method === "cash" ? tendered : null,
      change_given: isSplit ? null : change,
      subtotal: tax.subtotal,
      gst: tax.gst,
      pst: tax.pst,
      total: tax.total,
      tip: tipTotal,
      business_date: shopBusinessDate(),
      splits,
      split_mode: splitMode,
    })
    .select("id")
    .single();
  const sessionId = session?.id ?? null;
  if (sessionId) await db.from("orders").update({ table_session_id: sessionId }).in("id", claimed.map((o) => o.id));

  // 6b) queue prints whenever a split was REQUESTED: one receipt per share + a full
  // bill (drained one-per-poll by /api/epson). If the subtotal changed between the
  // preview and the claim, isSplit is false (stale partition) — we still enqueue the
  // full bill so a settled table ALWAYS produces a receipt, never a silent no-print.
  // Enqueued AFTER the settle so an offline printer never blocks checkout.
  if (sessionId && split) {
    const fullLines = claimed.flatMap((o) => activeItems(o).map((it) => ({ name_zh: it.name_zh, name_en: it.name_en, qty: it.qty, price: it.price, ...(it.note ? { note: it.note } : {}), ...(it.adjust ? { adjust: it.adjust } : {}) })));
    const job = (kind: string, seq: number, payload: Record<string, unknown>) => ({ tenant_slug: slug, table_no: tableNo, kind, seq, session_id: sessionId, payload });
    const shareJobs = isSplit ? splits.map((sh, i) => job("share", i + 1, { ...sh, idx: i + 1, n: splits.length, tableNo })) : [];
    const fullJob = job("full", shareJobs.length + 1, {
      tableNo, subtotal: tax.subtotal, gst: tax.gst, pst: tax.pst, hst: money(tax.gst + tax.pst), total: tax.total, tip: tipTotal, lines: fullLines,
      splits: splits.map((s) => ({ label: s.label, method: s.method, total: s.total, tip: s.tip })),
    });
    await db.from("print_jobs").insert([...shareJobs, fullJob]);
  }

  // 7) post sales ONCE (over the claimed set only) — mirrors lib/store posting, server-side.
  await postClaimedSales(db, slug, claimed);

  return NextResponse.json({ ok: true, sessionId, subtotal: tax.subtotal, hst: money(tax.gst + tax.pst), total: tax.total, change, split: isSplit ? splits.length : 0 });
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
