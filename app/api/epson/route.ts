import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildEposXml, eposEmpty } from "@/lib/epson";
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
//  Server Direct Print sends both the poll and the print-result as POSTs; we
//  treat every request the same (return next job or empty), which drains the
//  queue safely because each job is marked on serve.
// ─────────────────────────────────────────────────────────────────────────

const XML_HEADERS = { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" };

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  // Shared secret: the printer's configured URL carries ?key=… (docs/epson-print.md).
  // Without it, anyone knowing the public slug could poll this endpoint, steal
  // kitchen tickets (incl. customer phone/address) AND mark them printed so the
  // real printer never sees them. Requires EPSON_PRINT_KEY in the environment.
  const secret = process.env.EPSON_PRINT_KEY;
  if (secret && url.searchParams.get("key") !== secret) {
    return new Response(eposEmpty(), { status: 401, headers: XML_HEADERS });
  }
  const db = supabaseAdmin();
  if (!slug || !db) return new Response(eposEmpty(), { headers: XML_HEADERS });

  try {
    // shop name + print switch
    const { data: tenant } = await db
      .from("tenants")
      .select("name, print_enabled")
      .eq("slug", slug)
      .maybeSingle();
    if (tenant && tenant.print_enabled === false) return new Response(eposEmpty(), { headers: XML_HEADERS });
    const shopName = (tenant?.name as any)?.zh || (tenant?.name as any)?.en || slug;

    // Oldest unprinted print-ELIGIBLE order. Eligibility lives in the query
    // itself (dine-in always; togo/delivery only when paid) — filtering after a
    // limit() would let 10 stale unpaid togo orders block dine-in printing forever.
    const { data, error } = await db
      .from("orders")
      .select("*")
      .eq("tenant_slug", slug)
      .is("printed_at", null)
      .neq("status", "cancelled")
      .or("order_type.eq.dine_in,payment_status.eq.paid")
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) {
      // Most likely the `printed_at` column isn't migrated yet — fail quiet so the
      // printer just gets "nothing to print" instead of erroring.
      console.error("[epson] query", error.message);
      return new Response(eposEmpty(), { headers: XML_HEADERS });
    }

    const order = (data as Order[] | null)?.[0];
    if (!order) return new Response(eposEmpty(), { headers: XML_HEADERS });

    // Optimistically mark printed. The `.is('printed_at', null)` guard makes this a
    // compare-and-set so a rare double-poll can't double-print.
    const { data: claimed } = await db
      .from("orders")
      .update({ printed_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("printed_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return new Response(eposEmpty(), { headers: XML_HEADERS }); // someone else claimed it

    return new Response(buildEposXml(order, shopName), { headers: XML_HEADERS });
  } catch (e) {
    console.error("[epson]", e);
    return new Response(eposEmpty(), { headers: XML_HEADERS });
  }
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}
