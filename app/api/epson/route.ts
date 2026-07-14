import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildEposXml, buildEposReceiptXml, buildEposSplitXml } from "@/lib/epson";
import type { Order } from "@/lib/orders";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  Epson Server Direct Print endpoint. The TM-T88VI is configured (in its web
//  console) to POLL this URL, e.g.  https://bentoos.io/api/epson?slug=fulai
//
//  Each poll: we return the oldest un-printed, print-eligible order as an
//  ePOS-Print XML ticket, and mark it printed (optimistic — one printer, and
//  staff can 重打 if a print is lost). No job → an empty ePOS doc.
//
//  Print-eligible: dine-in always; togo/delivery only once payment_status='paid'
//  (the pay-first gate). Cancelled orders never print. Honors tenants.print_enabled.
//
//  Server Direct Print uses TWO POST channels (ConnectionType in the form body):
//    • GetRequest  — "give me a job". Reply: the job's <PrintRequestInfo> XML,
//                    OR an EMPTY body (Content-Length: 0) when nothing to print.
//    • SetResponse — "here is my last print result". Reply: an EMPTY body (ack).
//  Per the SDP manual (p.45 "Response When No Printing Is Performed" and the
//  print-result flow), the no-job / ack reply MUST be an empty 200 — NOT an XML
//  doc. Returning <epos-print/> here made the printer reject every poll and
//  jobs served on the SetResponse channel were silently dropped (never printed).
// ─────────────────────────────────────────────────────────────────────────

const XML_HEADERS = { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" };
// SDP "nothing for you" reply: empty body, 200. Used for idle GetRequest and for
// the SetResponse ack. eposEmpty() (a real <epos-print/>) is kept only for tests.
const empty = (status = 200) => new Response(null, { status, headers: XML_HEADERS });

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  // Shared secret: the printer's configured URL carries ?key=… (docs/epson-print.md).
  // Without it, anyone knowing the public slug could poll this endpoint, steal
  // kitchen tickets (incl. customer phone/address) AND mark them printed so the
  // real printer never sees them. Requires EPSON_PRINT_KEY in the environment.
  const secret = process.env.EPSON_PRINT_KEY;
  if (secret && url.searchParams.get("key") !== secret) {
    return empty(401);
  }
  const db = supabaseAdmin();
  if (!slug || !db) return empty();

  // The SDP POST body is form-urlencoded: ConnectionType=GetRequest&ID=…  or
  // ConnectionType=SetResponse&ID=&ResponseFile=<urlencoded PrintResponseInfo>.
  let connType = "GetRequest";
  if (req.method === "POST") {
    try {
      const body = await req.text();
      // ConnectionType is the first param; URLSearchParams reads it even though
      // ResponseFile downstream may itself contain '&'.
      connType = new URLSearchParams(body).get("ConnectionType") || "GetRequest";
    } catch { /* ignore */ }
  }

  // SetResponse = the printer reporting a result → just acknowledge (empty 200).
  // Never hand out a job here: a job served on this channel is never printed.
  if (connType === "SetResponse") return empty();

  try {
    // shop name + print switch
    const { data: tenant } = await db
      .from("tenants")
      .select("name, print_enabled, payment_mode")
      .eq("slug", slug)
      .maybeSingle();
    if (tenant && tenant.print_enabled === false) return empty();
    // Prefer the Chinese name — the ticket is now rendered as a bitmap <image>
    // (lib/ticketImage.ts) so CJK prints fine. Falls back to en/slug.
    const shopName = (tenant?.name as any)?.zh || (tenant?.name as any)?.en || slug;

    // Oldest unprinted print-ELIGIBLE order. Eligibility lives in the query itself
    // (filtering after limit() would let stale unpaid orders block printing forever):
    //   • dine-in            → always
    //   • pickup @ order_only → always (order-ahead, pay at pickup / no online charge)
    //   • togo / delivery / pickup@pay_first → only when payment_status='paid'
    // payment_mode defaults to 'order_only' (campus trucks); a tenant that wires up
    // payment flips to 'pay_first' and pickup then requires paid, like togo.
    const orderOnly = !tenant?.payment_mode || tenant.payment_mode === "order_only";
    const eligOr = orderOnly
      ? "order_type.eq.dine_in,order_type.eq.pickup,payment_status.eq.paid"
      : "order_type.eq.dine_in,payment_status.eq.paid";
    const { data, error } = await db
      .from("orders")
      .select("*")
      .eq("tenant_slug", slug)
      .is("printed_at", null)
      .neq("status", "cancelled")
      .or(eligOr)
      .order("created_at", { ascending: true })
      .limit(5);
    if (error) {
      // Most likely the `printed_at` column isn't migrated yet — fail quiet so the
      // printer just gets "nothing to print" instead of erroring.
      console.error("[epson] query", error.message);
      return empty();
    }

    // Drain pending kitchen tickets oldest-first. A round of ONLY no-kitchen items
    // (drinks / plain rice) gets claimed but NOT printed — the kitchen doesn't cook
    // it (it still shows on the bill). Print the first round that has cookable food.
    for (const order of (data as Order[] | null) ?? []) {
      const active = (order.items ?? []).filter((it) => !(it as { cancelled?: boolean }).cancelled);
      const needsKitchen = active.some((it) => !(it as { noKitchen?: boolean }).noKitchen);
      // CAS-claim so a rare double-poll can't double-print.
      const { data: claimed } = await db
        .from("orders")
        .update({ printed_at: new Date().toISOString() })
        .eq("id", order.id)
        .is("printed_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue; // another poll claimed it
      if (needsKitchen) return new Response(buildEposXml(order, shopName), { headers: XML_HEADERS });
      // no-cook-only round → claimed (won't reprint), no kitchen ticket; keep looking.
    }

    // Split-bill queue (分单): one sub-bill / full-bill per poll, FIFO (created_at
    // then seq → share 1, share 2, …, full). This is the checkout the waiter is
    // running right now, so it beats general 账单 prints. CAS on printed_at.
    const { data: pj } = await db
      .from("print_jobs")
      .select("id,kind,payload")
      .eq("tenant_slug", slug)
      .is("printed_at", null)
      .order("created_at", { ascending: true })
      .order("seq", { ascending: true })
      .limit(1);
    const jobRow = (pj as { id: string; kind: string; payload: Record<string, unknown> }[] | null)?.[0];
    if (jobRow) {
      const { data: jclaimed } = await db
        .from("print_jobs")
        .update({ printed_at: new Date().toISOString() })
        .eq("id", jobRow.id)
        .is("printed_at", null)
        .select("id")
        .maybeSingle();
      if (jclaimed) return new Response(buildEposSplitXml(jobRow.kind, jobRow.payload, shopName), { headers: XML_HEADERS });
      // else another poll claimed it — fall through.
    }

    // No kitchen ticket to print → serve the oldest pending customer bill (账单),
    // requested when staff tapped 标记完成 / 打印账单. Kitchen tickets always win.
    const { data: bills } = await db
      .from("orders")
      .select("*")
      .eq("tenant_slug", slug)
      .not("bill_at", "is", null)
      .is("bill_printed_at", null)
      .neq("status", "cancelled")
      .order("bill_at", { ascending: true })
      .limit(1);
    const bill = (bills as Order[] | null)?.[0];
    if (!bill) return empty();
    const now = new Date().toISOString();

    if (bill.order_type === "dine_in" && bill.table_no) {
      // Merge the whole table's pending tab (all 加餐 rounds) into ONE bill and
      // claim them all at once — the CAS on bill_printed_at IS the gather, so a
      // concurrent poll gets 0 rows and idles instead of double-printing.
      const { data: claimed } = await db
        .from("orders")
        .update({ bill_printed_at: now })
        .eq("tenant_slug", slug)
        .eq("order_type", "dine_in")
        .eq("table_no", bill.table_no)
        .not("bill_at", "is", null)
        .is("bill_printed_at", null)
        .select("*");
      const rows = (claimed as Order[] | null) ?? [];
      if (rows.length === 0) return empty();
      rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      return new Response(buildEposReceiptXml(rows, shopName), { headers: XML_HEADERS });
    }

    // togo / delivery (or dine-in with no table): a single-order bill.
    const { data: bclaimed } = await db
      .from("orders")
      .update({ bill_printed_at: now })
      .eq("id", bill.id)
      .is("bill_printed_at", null)
      .select("*")
      .maybeSingle();
    if (!bclaimed) return empty(); // another poll claimed this bill
    return new Response(buildEposReceiptXml(bclaimed as Order, shopName), { headers: XML_HEADERS });
  } catch (e) {
    console.error("[epson]", e);
    return empty();
  }
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
