// ─────────────────────────────────────────────────────────────────────────
//  Epson Server Direct Print — builds the ePOS-Print XML the TM-T88VI pulls.
//
//  Model: the printer POLLS our endpoint (/api/epson?slug=…) every few seconds
//  over the shop's wifi. We reply with an ePOS-Print XML document; the printer
//  prints it and cuts. Big fonts (width/height 2-3) so an older chef reads it
//  at a glance — mirrors components/KitchenTicket.tsx.
//
//  ePOS-Print ref: https://download.epson-biz.com/ (ePOS-Print XML spec).
// ─────────────────────────────────────────────────────────────────────────

import type { Order } from "./orders";

const NS = "http://www.epson-pos.com/schemas/2011/03/epos-print";
const RULE = "--------------------------------"; // ~32 chars, fits 80mm Font A
const DBL = "================================";

function esc(s: string): string {
  return (s || "")
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
    return { badge: "配送 DELIVERY", phone: o.phone, addr: a ? [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ") : undefined };
  }
  if (t === "togo") return { badge: "自取 TAKEOUT", phone: o.phone || undefined };
  return { badge: o.table_no ? `堂食 桌 ${o.table_no}` : "堂食 DINE-IN" };
}

/** An ePOS-Print `<text>` line with size (1-8) + optional bold, ending in a newline. */
function line(txt: string, opts: { w?: number; h?: number; em?: boolean; align?: "left" | "center" | "right" } = {}): string {
  const attrs: string[] = [];
  if (opts.align) attrs.push(`align="${opts.align}"`);
  if (opts.w) attrs.push(`width="${opts.w}"`);
  if (opts.h) attrs.push(`height="${opts.h}"`);
  attrs.push(`em="${opts.em ? "true" : "false"}"`);
  return `<text ${attrs.join(" ")}>${esc(txt)}&#10;</text>`;
}

/** An empty ePOS-Print doc — the "nothing to print" reply to a poll. */
export function eposEmpty(): string {
  return `<?xml version="1.0" encoding="utf-8"?><epos-print xmlns="${NS}"/>`;
}

/** Build the big-font kitchen ticket for one order. */
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
  // zh-hans enables the multibyte (Simplified Chinese) font on the TM-T88VI.
  b.push(`<text lang="zh-hans" smooth="true"/>`);
  b.push(line(shopName, { align: "center", w: 2, h: 2, em: true }));
  b.push(line("后厨备餐单", { align: "center" }));
  b.push(line(RULE, { align: "left" }));
  // order type — biggest thing on the ticket
  b.push(line(t.badge, { align: "center", w: 3, h: 3, em: true }));
  b.push(line(`#${o.id.slice(0, 5).toUpperCase()}   ${time}`, { align: "left" }));
  if (t.phone) b.push(line(`电话 ${fmtPhone(t.phone)}`, { w: 2, h: 1, em: true }));
  if (t.addr) b.push(line(`地址 ${t.addr}`, { em: true }));
  b.push(line(DBL));
  // items — qty huge
  for (const it of items) {
    b.push(line(`x${it.qty}  ${it.name_zh}`, { w: 2, h: 2, em: true }));
  }
  b.push(line(RULE));
  if (o.note) b.push(line(`! 备注: ${o.note}`, { w: 2, h: 2, em: true }));
  b.push(line(`共 ${count} 份`, { align: "center" }));
  b.push(`<feed line="2"/>`);
  b.push(`<cut type="feed"/>`);

  return `<?xml version="1.0" encoding="utf-8"?>\n<epos-print xmlns="${NS}">${b.join("")}</epos-print>`;
}
