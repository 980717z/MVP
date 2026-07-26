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
import { renderTicketImage, renderReceiptImage, renderSplitReceiptImage } from "./ticketImage";
import { computeTax } from "./tax";

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
  const phone = (o.phone || "").trim() || "N/A"; // blank phone → N/A on togo/delivery
  if (t === "delivery") {
    const a = (o as any).address;
    return { badge: "DELIVERY", phone, addr: a ? [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ") : undefined };
  }
  if (t === "togo") return { badge: "TAKEOUT", phone };
  return { badge: o.table_no ? `DINE-IN  Table ${displayTable(o.table_no)}` : "DINE-IN" };
}

/** One ePOS-Print text line. Formatting attributes are set on their own
 *  self-closing <text .../> elements, then the content on a <text>…&#10;</text>
 *  (the &#10; is the line break). width/height="2" = double-size — confirmed
 *  working on this unit; `big` uses it for lines the chef must read fast. */
function line(txt: string, opts: { big?: boolean; em?: boolean; align?: "left" | "center" | "right" } = {}): string {
  return (
    `<text align="${opts.align || "left"}"/>` +
    `<text width="${opts.big ? "2" : "1"}" height="${opts.big ? "2" : "1"}"/>` +
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

  // Preferred path: render the whole ticket (中文 included) to a 1-bit raster
  // and print it as an <image> — this shop's printer has no CJK font, so text
  // 中文 is impossible; a bitmap prints regardless. Falls back to the ASCII
  // text ticket below if canvas/font is unavailable (keeps printing alive).
  const img = renderTicketImage(o, shopName);
  if (img) {
    const doc =
      `<epos-print xmlns="${NS}">` +
      `<text align="center"/>` +
      `<image width="${img.width}" height="${img.height}">${img.base64}</image>` +
      `<feed line="3"/><cut type="feed"/>` +
      `</epos-print>`;
    return (
      `<?xml version="1.0" encoding="utf-8"?>` +
      `<PrintRequestInfo><ePOSPrint>` +
      `<Parameter><devid>local_printer</devid><timeout>10000</timeout></Parameter>` +
      `<PrintData>${doc}</PrintData>` +
      `</ePOSPrint></PrintRequestInfo>`
    );
  }

  // Fallback: big-font English/ASCII ticket (items fall back to name_en). Only
  // reached if canvas/font is unavailable; shopName may be 中文 → strips empty,
  // so guard it and fall back to the slug-ish header.
  const b: string[] = [];
  const sn = ascii(shopName);
  b.push(line(sn || "KITCHEN", { big: true, align: "center" }));
  b.push(line(DBL));
  b.push(line(t.badge, { big: true, em: true }));
  b.push(line(time));
  if (t.phone) b.push(line(`Tel ${fmtPhone(t.phone)}`));
  if (t.addr) b.push(line(t.addr));
  b.push(line(RULE));
  for (const it of items) {
    const qty = Number(it.qty) || 1;
    const name = ascii(it.name_en) || ascii(it.name_zh) || "Item";
    b.push(line(qty >= 2 ? `${qty} x ${name}` : name, { big: true }));
  }
  b.push(line(RULE));
  b.push(line(`Items: ${count}`, { em: true }));
  const onote = ascii(o.note);
  if (onote) b.push(line(`Note: ${onote}`));
  b.push(`<feed line="3"/>`);
  b.push(`<cut type="feed"/>`);

  // Wrapper matches the proven cloudPrint sample: BARE <PrintRequestInfo> (no
  // Version → implicit 1.00), Parameter = devid + timeout only (NO printjobid),
  // PrintData with the ePOS-Print doc NESTED. Version/printjobid (v2/v3) appear
  // to make THIS unit's firmware SchemaError even on Epson's own sample.
  const eposDoc = `<epos-print xmlns="${NS}">${b.join("")}</epos-print>`;
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<PrintRequestInfo><ePOSPrint>` +
    `<Parameter><devid>local_printer</devid><timeout>10000</timeout></Parameter>` +
    `<PrintData>${eposDoc}</PrintData>` +
    `</ePOSPrint></PrintRequestInfo>`
  );
}

/** Wrap an ePOS-Print body in the proven PrintRequestInfo envelope. */
function wrapPrintJob(body: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<PrintRequestInfo><ePOSPrint>` +
    `<Parameter><devid>local_printer</devid><timeout>10000</timeout></Parameter>` +
    `<PrintData><epos-print xmlns="${NS}">${body}</epos-print></PrintData>` +
    `</ePOSPrint></PrintRequestInfo>`
  );
}

/** left…right within `width` cols (Font A ≈ 42 cols on 80mm; 32 keeps a margin). */
function padRow(l: string, r: string, width = 32): string {
  const left = ascii(l);
  const right = ascii(r);
  const room = Math.max(1, width - right.length);
  const shown = left.length > room ? left.slice(0, room - 1) : left;
  const pad = Math.max(1, width - shown.length - right.length);
  return shown + " ".repeat(pad) + right;
}

/** Build the priced customer bill (账单). Pass one order, or several rounds of a
 *  dine-in table (加餐) to merge into ONE bill: all items, one 小计/GST/PST/合计.
 *  Menu prices are pre-tax → HST added on top (matches togo checkout). */
export function buildEposReceiptXml(orders: Order | Order[], shopName: string): string {
  const list = Array.isArray(orders) ? orders : [orders];
  const o = list[0];
  // Preferred: render the whole bill (中文 + prices) to a raster <image>.
  const img = renderReceiptImage(list, shopName);
  if (img) {
    return wrapPrintJob(
      `<text align="center"/>` +
      `<image width="${img.width}" height="${img.height}">${img.base64}</image>` +
      `<feed line="3"/><cut type="feed"/>`,
    );
  }

  // Fallback: ASCII bill (only if canvas/font is unavailable). Prices still print.
  const t = typeBadge(o);
  const items = list.flatMap((r) => r.items.filter((it: any) => !it.cancelled));
  const subtotal = Math.round(items.reduce((a, it) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0) * 100) / 100;
  const tax = computeTax(subtotal, false);
  const usd = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);
  const b: string[] = [];
  b.push(line(ascii(shopName) || "RECEIPT", { big: true, align: "center" }));
  b.push(line(`BILL  ${t.badge}`, { em: true }));
  b.push(line(DBL));
  for (const it of items) {
    const qty = Number(it.qty) || 1;
    const name = ascii(it.name_en) || ascii(it.name_zh) || "Item";
    b.push(line(padRow(qty >= 2 ? `${name} x${qty}` : name, usd((Number(it.price) || 0) * qty))));
  }
  b.push(line(RULE));
  b.push(line(padRow("Subtotal", usd(subtotal))));
  // One HST 13% line (= GST+PST components — reconciles with the split ledger).
  b.push(line(padRow("HST 13%", usd(Math.round((tax.gst + tax.pst) * 100) / 100))));
  b.push(line(RULE));
  b.push(line(padRow("TOTAL", usd(tax.total)), { big: true, em: true }));
  b.push(`<feed line="3"/><cut type="feed"/>`);
  return wrapPrintJob(b.join(""));
}

/** Build a split sub-bill ('share') or the merged full bill ('full') for a
 *  print_jobs row. Renders 中文 + prices to a raster <image>; ASCII fallback keeps
 *  the totals + payment method readable if canvas/font is unavailable. */
export function buildEposSplitXml(kind: string, payload: Record<string, unknown>, shopName: string): string {
  const img = renderSplitReceiptImage(kind, payload, shopName);
  if (img) {
    return wrapPrintJob(
      `<text align="center"/>` +
      `<image width="${img.width}" height="${img.height}">${img.base64}</image>` +
      `<feed line="3"/><cut type="feed"/>`,
    );
  }
  // Fallback: minimal ASCII (totals + method still print).
  const usd = (n: unknown) => "$" + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
  const mLabel = (m: unknown) => (m === "cash" ? "CASH" : m === "card" ? "CARD" : m === "emt" ? "EMT" : m === "split" ? "SPLIT" : "OTHER");
  const p = payload as Record<string, unknown>;
  const b: string[] = [];
  b.push(line(ascii(shopName) || "RECEIPT", { big: true, align: "center" }));
  if (kind === "full") {
    b.push(line(`BILL Table ${ascii(String(p.tableNo ?? ""))} FULL`, { em: true }));
    b.push(line(RULE));
    b.push(line(padRow("TOTAL", usd(p.total)), { big: true, em: true }));
    for (const s of (Array.isArray(p.splits) ? p.splits : []) as Record<string, unknown>[])
      b.push(line(padRow(`${ascii(String(s.label ?? ""))} ${mLabel(s.method)}`, usd(s.total))));
  } else {
    b.push(line(`Table ${ascii(String(p.tableNo ?? ""))}  ${Number(p.idx) || 1}/${Number(p.n) || 1}`, { em: true }));
    b.push(line(RULE));
    b.push(line(padRow("TOTAL", usd(p.total)), { big: true, em: true }));
    b.push(line(`PAID ${mLabel(p.method)}`));
  }
  b.push(`<feed line="3"/><cut type="feed"/>`);
  return wrapPrintJob(b.join(""));
}
