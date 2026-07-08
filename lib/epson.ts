// ─────────────────────────────────────────────────────────────────────────
//  Epson Server Direct Print — builds the ePOS-Print XML the TM-T88VI pulls.
//
//  Model: the printer POLLS our endpoint (/api/epson?slug=…) every few seconds
//  over the shop's wifi. We reply with an ePOS-Print XML document; the printer
//  prints it and cuts. Big fonts (width/height 2-3) so an older chef reads it
//  at a glance — mirrors components/KitchenTicket.tsx.
//
//  ⚠️ TEMPORARY (2026-07-07): this shop's TM-T88VI is the ALPHANUMERIC SKU
//  ("Resident Character: Alphanumeric" on its self-test) — it has NO Chinese
//  font, so any 中文 in the ticket makes the whole job fail silently. Until we
//  add image/raster rendering for CJK, the ticket is forced to English/ASCII
//  (ascii() strips anything non-printable-ASCII). Items fall back to name_en.
//  ePOS-Print ref: https://download.epson-biz.com/ (ePOS-Print XML spec).
// ─────────────────────────────────────────────────────────────────────────

import type { Order } from "./orders";
import { displayTable } from "./format";

const NS = "http://www.epson-pos.com/schemas/2011/03/epos-print";
const RULE = "--------------------------------"; // ~32 chars, fits 80mm Font A
const DBL = "================================";

/** Keep only printable ASCII — this printer can't render CJK, so non-ASCII
 *  bytes would abort the whole print job. */
function ascii(s: unknown): string {
  return String(s ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

function esc(s: string): string {
  return ascii(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtPhone(p: string): string {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

function typeBadge(o: Order): { badge: string; phone?: string; addr?: string } {
  const t = (o as any).order_type ?? "dine_in";
  if (t === "delivery") {
    const a = (o as any).address;
    return { badge: "DELIVERY", phone: o.phone, addr: a ? [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ") : undefined };
  }
  if (t === "togo") return { badge: "TAKEOUT", phone: o.phone || undefined };
  return { badge: o.table_no ? `DINE-IN  Table ${displayTable(o.table_no)}` : "DINE-IN" };
}

/** One ePOS-Print text line. Per the Epson ePOS-Print/SDP spec, formatting
 *  attributes each go on their OWN self-closing <text .../> element and the
 *  CONTENT goes on a bare <text> with no attributes — mixing them on one <text>
 *  is a SchemaError. &#10; in content is allowed with PrintRequestInfo v3.00.
 *  `big` = double width+height. */
function line(txt: string, opts: { big?: boolean; em?: boolean; align?: "left" | "center" | "right" } = {}): string {
  return (
    `<text align="${opts.align || "left"}"/>` +
    `<text dw="${opts.big ? "true" : "false"}" dh="${opts.big ? "true" : "false"}"/>` +
    `<text em="${opts.em ? "true" : "false"}"/>` +
    `<text>${esc(txt)}&#10;</text>`
  );
}

/** An empty ePOS-Print doc — the "nothing to print" reply to a poll. */
export function eposEmpty(): string {
  return `<?xml version="1.0" encoding="utf-8"?><epos-print xmlns="${NS}"/>`;
}

/** Build the big-font kitchen ticket for one order (English/ASCII only — see note above). */
export function buildEposXml(o: Order, shopName: string): string {
  const t = typeBadge(o);
  const time = (() => {
    const d = new Date(o.created_at);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();
  // never print cancelled items — a reprint after 取消 must not cook the dish
  const items = o.items.filter((it: any) => !it.cancelled);
  const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);

  const b: string[] = [];
  b.push(`<text lang="en"/>`); // ASCII font (no CJK on this unit)
  b.push(line(ascii(shopName) || "KITCHEN", { align: "center", big: true, em: true }));
  b.push(line("KITCHEN ORDER", { align: "center" }));
  b.push(line(RULE, { align: "left" }));
  // order type — biggest thing on the ticket
  b.push(line(t.badge, { align: "center", big: true, em: true }));
  b.push(line(`#${o.id.slice(0, 5).toUpperCase()}   ${time}`, { align: "left" }));
  if (t.phone) b.push(line(`Tel ${fmtPhone(t.phone)}`, { big: true, em: true }));
  if (t.addr) b.push(line(`Addr ${t.addr}`, { em: true }));
  b.push(line(DBL));
  // items — qty big; prefer English name, fall back to a placeholder if a dish
  // has only a Chinese name (which would strip to empty on this printer).
  for (const it of items) {
    const name = ascii((it as any).name_en || it.name_zh) || "(item)";
    b.push(line(`x${it.qty}  ${name}`, { big: true, em: true }));
  }
  b.push(line(RULE));
  if (o.note) {
    const note = ascii(o.note);
    if (note) b.push(line(`! Note: ${note}`, { big: true, em: true }));
  }
  b.push(line(`${count} items total`, { align: "center" }));
  b.push(`<feed line="3"/>`);
  b.push(`<cut type="feed"/>`);

  // Server Direct Print response, per the Epson SDP manual (Version="3.00",
  // supported by TM-T88VI): PrintRequestInfo → ePOSPrint → Parameter(devid,
  // timeout, printjobid) + PrintData with the ePOS-Print doc NESTED (not escaped).
  const eposDoc = `<epos-print xmlns="${NS}">${b.join("")}</epos-print>`;
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<PrintRequestInfo Version="3.00"><ePOSPrint>` +
    `<Parameter><devid>local_printer</devid><timeout>10000</timeout><printjobid>${esc(o.id)}</printjobid></Parameter>` +
    `<PrintData>${eposDoc}</PrintData>` +
    `</ePOSPrint></PrintRequestInfo>`
  );
}
