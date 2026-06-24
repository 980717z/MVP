import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { xpyunConfig, addPrinter, printContent, printerStatus, buildReceipt, testReceipt } from "@/lib/xpyun";
import type { Order } from "@/lib/orders";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  POST /api/print — server-side bridge to the XPYun cloud printer.
//
//  Actions (by request body):
//   • { orderId }                 → print an order's kitchen ticket
//   • { test: true, slug }        → print a sample ticket (verify a new device)
//   • { register: true, slug, sn, name } → bind a printer to a shop
//   • { status: true, slug }      → query the bound printer's status
//
//  Reads the order + the shop's private printer config with the service role
//  (the anon customer can't see either). Never throws on missing config: the
//  order flow calls this fire-and-forget and must not break if printing is off.
// ─────────────────────────────────────────────────────────────────────────

type Body = {
  orderId?: string;
  test?: boolean;
  register?: boolean;
  status?: boolean;
  slug?: string;
  sn?: string;
  name?: string;
};

type Tenant = {
  slug: string;
  name: { zh?: string; en?: string } | null;
  printer_sn: string;
  print_enabled: boolean;
  print_copies: number;
};

function shopName(t: Tenant): string {
  return t.name?.zh || t.name?.en || t.slug;
}

async function loadTenant(db: NonNullable<ReturnType<typeof supabaseAdmin>>, slug: string) {
  const { data, error } = await db
    .from("tenants")
    .select("slug, name, printer_sn, print_enabled, print_copies")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Tenant) ?? null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }
  const cfg = xpyunConfig();
  if (!cfg) {
    // Not an error for the order flow — printing just isn't configured yet.
    return NextResponse.json({ ok: true, printed: false, reason: "xpyun_not_configured" });
  }

  try {
    // ── Resolve the shop + its printer ──────────────────────────────────────
    let tenant: Tenant | null = null;
    if (body.orderId) {
      const { data: order, error } = await db.from("orders").select("*").eq("id", body.orderId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!order) return NextResponse.json({ ok: false, error: "order not found" }, { status: 404 });
      tenant = await loadTenant(db, (order as Order).tenant_slug);
      if (!tenant) return NextResponse.json({ ok: false, error: "tenant not found" }, { status: 404 });

      if (!tenant.print_enabled) return NextResponse.json({ ok: true, printed: false, reason: "disabled" });
      if (!tenant.printer_sn) return NextResponse.json({ ok: true, printed: false, reason: "no_printer" });

      const content = buildReceipt(order as Order, shopName(tenant));
      const r = await printContent(cfg, tenant.printer_sn, content, tenant.print_copies || 1);
      return NextResponse.json({ ok: r.code === 0, printed: r.code === 0, code: r.code, msg: r.msg });
    }

    // The remaining actions are keyed by slug.
    if (!body.slug) return NextResponse.json({ ok: false, error: "missing orderId or slug" }, { status: 400 });
    tenant = await loadTenant(db, body.slug);
    if (!tenant) return NextResponse.json({ ok: false, error: "tenant not found" }, { status: 404 });

    if (body.register) {
      const sn = body.sn?.trim();
      if (!sn) return NextResponse.json({ ok: false, error: "missing sn" }, { status: 400 });
      const r = await addPrinter(cfg, sn, body.name || shopName(tenant));
      // Persist the binding so future orders print without re-registering.
      if (r.code === 0) await db.from("tenants").update({ printer_sn: sn }).eq("slug", tenant.slug);
      return NextResponse.json({ ok: r.code === 0, code: r.code, msg: r.msg });
    }

    if (body.status) {
      if (!tenant.printer_sn) return NextResponse.json({ ok: false, error: "no_printer" });
      const r = await printerStatus(cfg, tenant.printer_sn);
      return NextResponse.json({ ok: r.code === 0, code: r.code, msg: r.msg, data: r.data });
    }

    if (body.test) {
      if (!tenant.printer_sn) return NextResponse.json({ ok: false, error: "no_printer" });
      const r = await printContent(cfg, tenant.printer_sn, testReceipt(shopName(tenant)), 1);
      return NextResponse.json({ ok: r.code === 0, printed: r.code === 0, code: r.code, msg: r.msg });
    }

    return NextResponse.json({ ok: false, error: "no action (orderId | test | register | status)" }, { status: 400 });
  } catch (e) {
    console.error("[print]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
