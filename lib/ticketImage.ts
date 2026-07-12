// ─────────────────────────────────────────────────────────────────────────
//  Kitchen ticket + customer bill → 1-bit raster for ePOS-Print <image>.
//
//  This shop's TM-T88VI has NO CJK font (Alphanumeric SKU), so 中文 can't be
//  printed as text. Instead we render the whole ticket to a monochrome bitmap
//  with a bundled Noto Sans SC font and print it as a raster <image> — the
//  printer reproduces any bitmap regardless of its resident fonts.
//
//  Two documents share one layout engine (newBuilder):
//   • KITCHEN ticket  (renderTicketImage)  — dish names + qty, NO prices. Prints
//     when the order comes in.
//   • CUSTOMER bill   (renderReceiptImage) — line prices, 小计, GST 5%, PST 8%,
//     合计. Prints on 标记完成 / 打印账单. Menu prices are pre-tax, so tax is
//     added on top (matches the togo checkout: subtotal × 1.13).
//
//  Every text block WRAPS to the printable width so long 中英 names can't clip.
//  Output: 1 bit/pixel, MSB = leftmost pixel, rows byte-aligned. Base64 goes
//  straight into <image width height>…</image>.
// ─────────────────────────────────────────────────────────────────────────
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import path from "path";
import type { Order } from "./orders";
import { displayTable } from "./format";
import { computeTax } from "./tax";

// 80mm paper printable width on the TM-T88VI = 512 dots.
const W = 512;
const PAD = 16;
const MAXW = W - PAD * 2; // 480 dots of usable text width
const FONT = "NotoSC";

// Font sizes in printer dots. Sized big for at-a-glance kitchen legibility;
// wrapping (below) keeps long 中英 names on the page at these sizes.
const SHOP = 64, BIG = 60, MID = 50, SM = 40;
// Line advance per size (≈1.4× the font).
const LH_SHOP = 88, LH_BIG = 84, LH_MID = 68, LH_SM = 56;
const GAP = 26;

let fontReady = false;
function ensureFont(): boolean {
  if (fontReady) return true;
  try {
    GlobalFonts.registerFromPath(path.join(process.cwd(), "assets/fonts/NotoSansSC.ttf"), FONT);
    fontReady = true;
  } catch {
    fontReady = false;
  }
  return fontReady;
}

function setFont(ctx: SKRSContext2D, size: number, bold: boolean) {
  ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
}

// Greedy wrap: Latin words stay whole, CJK/fullwidth chars break anywhere, and
// an over-long single token (e.g. a URL) hard-breaks by character.
function wrap(mc: SKRSContext2D, text: string, size: number, bold: boolean, maxW: number): string[] {
  setFont(mc, size, bold);
  if (mc.measureText(text).width <= maxW) return [text];
  const toks = text.match(/\s+|[0-9A-Za-z._@#$%&*+/-]+|[^\s]/g) || [text];
  const out: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim() !== "") out.push(cur.replace(/\s+$/, "")); cur = ""; };
  for (let tok of toks) {
    while (mc.measureText(tok).width > maxW && tok.length > 1) {
      if (cur) flush();
      let i = tok.length;
      while (i > 1 && mc.measureText(tok.slice(0, i)).width > maxW) i--;
      out.push(tok.slice(0, i));
      tok = tok.slice(i);
    }
    const trial = cur === "" ? tok : cur + tok;
    if (mc.measureText(trial).width <= maxW) cur = trial;
    else { flush(); cur = tok.replace(/^\s+/, ""); }
  }
  flush();
  return out.length ? out : [text];
}

function typeBadge(o: Order): { badge: string; sub?: string; tel?: string } {
  const t = (o as any).order_type ?? "dine_in";
  const phone = (o.phone || "").trim() || "N/A"; // blank phone → N/A on the ticket
  // Off-site orders (自取/外送) are order-only + staff callback: the phone MUST be
  // on the ticket so staff can ring back to confirm; delivery also needs the address.
  if (t === "delivery") {
    const a = (o as any).address;
    return { badge: "外卖", sub: a ? [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ") : undefined, tel: phone };
  }
  if (t === "togo") return { badge: "自取", tel: phone };
  return { badge: o.table_no ? `堂食  台号 ${displayTable(o.table_no)}` : "堂食" };
}

type Op =
  | { kind: "text"; x: number; y: number; text: string; size: number; bold: boolean }
  | { kind: "rule"; y: number; dbl: boolean };

/** Shared layout engine: accumulates draw ops + total height, wrapping to MAXW.
 *  `mc` is a measuring context (font widths). Call ops out, then paint. */
function newBuilder(mc: SKRSContext2D) {
  const ops: Op[] = [];
  let y = PAD;
  const centered = (text: string, size: number, bold: boolean, lineH: number) => {
    for (const ln of wrap(mc, text, size, bold, MAXW)) {
      setFont(mc, size, bold);
      const w = mc.measureText(ln).width;
      ops.push({ kind: "text", x: Math.max(PAD, (W - w) / 2), y, text: ln, size, bold });
      y += lineH;
    }
  };
  const left = (text: string, size: number, bold: boolean, lineH: number) => {
    for (const ln of wrap(mc, text, size, bold, MAXW)) {
      ops.push({ kind: "text", x: PAD, y, text: ln, size, bold });
      y += lineH;
    }
  };
  // Left text + right-aligned value on the same first line (prices, totals).
  const row = (l: string, r: string, size: number, bold: boolean, lineH: number) => {
    setFont(mc, size, bold);
    const rw = mc.measureText(r).width;
    const lines = wrap(mc, l, size, bold, MAXW - rw - 16);
    ops.push({ kind: "text", x: PAD, y, text: lines[0] ?? "", size, bold });
    ops.push({ kind: "text", x: W - PAD - rw, y, text: r, size, bold });
    y += lineH;
    for (let i = 1; i < lines.length; i++) {
      ops.push({ kind: "text", x: PAD, y, text: lines[i], size, bold });
      y += lineH;
    }
  };
  // Dish line for the kitchen ticket: qty prefix, name hang-indented under itself.
  const item = (qty: number, name: string) => {
    const prefix = qty >= 2 ? `${qty} x ` : ""; // single item → no "1 x"
    setFont(mc, BIG, true);
    const hang = mc.measureText(prefix).width;
    const lines = wrap(mc, name, BIG, true, MAXW - hang);
    ops.push({ kind: "text", x: PAD, y, text: prefix + (lines[0] ?? ""), size: BIG, bold: true });
    y += LH_BIG;
    for (let i = 1; i < lines.length; i++) {
      ops.push({ kind: "text", x: PAD + hang, y, text: lines[i], size: BIG, bold: true });
      y += LH_BIG;
    }
  };
  const rule = (dbl = false) => { ops.push({ kind: "rule", y: y + 8, dbl }); y += GAP + (dbl ? 6 : 4); };
  const gap = (h: number) => { y += h; };
  return { ops, centered, left, row, item, rule, gap, height: () => Math.ceil(y) };
}

/** Paint accumulated ops onto a fresh canvas of the computed height. */
function paint(ops: Op[], height: number): Canvas {
  const canvas = createCanvas(W, height);
  const c = canvas.getContext("2d");
  c.fillStyle = "#fff";
  c.fillRect(0, 0, W, height);
  c.fillStyle = "#000";
  c.textBaseline = "top";
  for (const op of ops) {
    if (op.kind === "rule") c.fillRect(PAD, op.y, W - PAD * 2, op.dbl ? 3 : 1);
    else { setFont(c, op.size, op.bold); c.fillText(op.text, op.x, op.y); }
  }
  return canvas;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
const money = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2);

// ── KITCHEN TICKET ─────────────────────────────────────────────────────────
function drawTicket(o: Order, shopName: string): { canvas: Canvas; height: number } | null {
  if (!ensureFont()) return null;
  const t = typeBadge(o);
  const items = o.items.filter((it: any) => !it.cancelled);
  const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
  const note = (o.note || "").trim();

  const mc = createCanvas(W, 10).getContext("2d");
  const b = newBuilder(mc);
  b.centered(shopName, SHOP, true, LH_SHOP);
  b.rule(true);
  b.left(t.badge, BIG, true, LH_BIG);
  if (t.sub) b.left(t.sub, SM, false, LH_SM);
  if (t.tel) b.left(`电话 ${t.tel}`, MID, true, LH_MID); // callback number — staff verify by phone
  b.left(fmtTime(o.created_at), SM, false, LH_SM);
  b.rule();
  for (const it of items) b.item(Number(it.qty) || 1, (it.name_zh || it.name_en || "菜品").trim());
  b.rule();
  b.left(`合计 ${count} 份`, MID, true, LH_MID);
  if (note) b.left(`备注: ${note}`, SM, false, LH_SM);
  b.gap(40);
  const height = b.height();
  return { canvas: paint(b.ops, height), height };
}

// ── CUSTOMER BILL ──────────────────────────────────────────────────────────
// Accepts one OR several orders. Multiple = a dine-in table's rounds (加餐)
// merged into ONE bill: every round's items, one 小计 / GST / PST / 合计.
function drawReceipt(orders: Order[], shopName: string): { canvas: Canvas; height: number } | null {
  if (!ensureFont() || orders.length === 0) return null;
  const first = orders[0];
  const t = typeBadge(first);
  const rounds = orders.length; // >1 → 加餐 (multiple rounds on this tab)
  // latest order time — closest to when the bill is settled
  const latest = orders.reduce((m, o) => (o.created_at > m ? o.created_at : m), first.created_at);
  const lines = orders.flatMap((o) => o.items.filter((it: any) => !it.cancelled).map((it: any) => ({ it })));
  const subtotal = Math.round(lines.reduce((a, { it }) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0) * 100) / 100;
  const tax = computeTax(subtotal, false); // menu prices are pre-tax → add HST on top

  const mc = createCanvas(W, 10).getContext("2d");
  const b = newBuilder(mc);
  b.centered(shopName, SHOP, true, LH_SHOP);
  b.left(`账单  ${t.badge}${rounds > 1 ? `  (${rounds}单合并)` : ""}`, MID, true, LH_MID);
  if (t.sub) b.left(t.sub, SM, false, LH_SM);      // delivery address
  if (t.tel) b.left(`电话 ${t.tel}`, SM, false, LH_SM); // contact / callback number
  b.left(fmtTime(latest), SM, false, LH_SM);
  b.rule(true);
  for (const { it } of lines) {
    const qty = Number(it.qty) || 1;
    const name = (it.name_zh || it.name_en || "菜品").trim();
    // Item rows are read up close on the bill → SM keeps long names on one line.
    b.row(qty >= 2 ? `${name} ×${qty}` : name, money((Number(it.price) || 0) * qty), SM, false, LH_SM);
  }
  b.rule();
  b.row("小计", money(subtotal), MID, false, LH_MID);
  // Ontario HST is a single 13% tax — show one line (= GST+PST components, so
  // it still reconciles penny-for-penny with the split stored in the ledger).
  b.row("HST 13%", money(Math.round((tax.gst + tax.pst) * 100) / 100), SM, false, LH_SM);
  b.rule();
  b.row("合计", money(tax.total), BIG, true, LH_BIG);
  b.gap(40);
  const height = b.height();
  return { canvas: paint(b.ops, height), height };
}

// ── SPLIT BILLS (分单) ───────────────────────────────────────────────────────
// One receipt per share (each with its own 付款方式) + a full merged bill listing
// how the table was divided. Payloads come from print_jobs.payload (jsonb).
interface SplitReceiptPayload {
  tableNo?: string; idx?: number; n?: number; evenOfN?: number; label?: string; method?: string;
  subtotal?: number; gst?: number; pst?: number; hst?: number; total?: number; tip?: number;
  tendered?: number | null; change?: number | null;
  lines?: { name_zh?: string; name_en?: string; qty?: number; price?: number | null }[];
  splits?: { label?: string; method?: string; total?: number; tip?: number }[];
}
function methodZh(m?: string): string {
  return m === "cash" ? "现金" : m === "card" ? "刷卡" : m === "emt" ? "EMT" : m === "split" ? "分单" : "其他";
}
const hstOf = (p: SplitReceiptPayload) => p.hst != null ? p.hst : Math.round(((p.gst || 0) + (p.pst || 0)) * 100) / 100;

function drawSplitShare(p: SplitReceiptPayload, shopName: string): { canvas: Canvas; height: number } | null {
  if (!ensureFont()) return null;
  const mc = createCanvas(W, 10).getContext("2d");
  const b = newBuilder(mc);
  b.centered(shopName, SHOP, true, LH_SHOP);
  b.rule(true);
  b.left(`账单 · 桌 ${p.tableNo ?? ""}`, MID, true, LH_MID);
  b.left(`第 ${p.idx ?? 1}/${p.n ?? 1} 份${p.evenOfN ? `  均分 1/${p.evenOfN}` : ""}`, SM, false, LH_SM);
  b.rule();
  const lines = p.lines ?? [];
  for (const it of lines) {
    const qty = Number(it.qty) || 1;
    const name = (it.name_zh || it.name_en || "菜品").trim();
    b.row(qty >= 2 ? `${name} ×${qty}` : name, money((Number(it.price) || 0) * qty), SM, false, LH_SM);
  }
  if (lines.length) b.rule();
  b.row("小计", money(p.subtotal || 0), MID, false, LH_MID);
  b.row("HST 13%", money(hstOf(p)), SM, false, LH_SM);
  b.rule();
  b.row("合计", money(p.total || 0), BIG, true, LH_BIG);
  if ((p.tip || 0) > 0) {
    b.row("小费", money(p.tip || 0), SM, false, LH_SM);
    b.row("实收", money((p.total || 0) + (p.tip || 0)), MID, true, LH_MID);
  }
  b.left(`付款  ${methodZh(p.method)}`, MID, true, LH_MID);
  if (p.method === "cash" && p.tendered != null) {
    b.row("收", money(p.tendered), SM, false, LH_SM);
    b.row("找", money(p.change || 0), SM, false, LH_SM);
  }
  b.gap(40);
  const height = b.height();
  return { canvas: paint(b.ops, height), height };
}

function drawSplitFull(p: SplitReceiptPayload, shopName: string): { canvas: Canvas; height: number } | null {
  if (!ensureFont()) return null;
  const mc = createCanvas(W, 10).getContext("2d");
  const b = newBuilder(mc);
  b.centered(shopName, SHOP, true, LH_SHOP);
  b.left(`账单 · 桌 ${p.tableNo ?? ""} · 合并`, MID, true, LH_MID);
  b.rule(true);
  for (const it of p.lines ?? []) {
    const qty = Number(it.qty) || 1;
    const name = (it.name_zh || it.name_en || "菜品").trim();
    b.row(qty >= 2 ? `${name} ×${qty}` : name, money((Number(it.price) || 0) * qty), SM, false, LH_SM);
  }
  b.rule();
  b.row("小计", money(p.subtotal || 0), MID, false, LH_MID);
  b.row("HST 13%", money(hstOf(p)), SM, false, LH_SM);
  b.rule();
  b.row("合计", money(p.total || 0), BIG, true, LH_BIG);
  if ((p.tip || 0) > 0) {
    b.row("小费", money(p.tip || 0), SM, false, LH_SM);
    b.row("实收", money((p.total || 0) + (p.tip || 0)), MID, true, LH_MID);
  }
  const splits = p.splits ?? [];
  if (splits.length) {
    b.rule();
    b.left(`分 ${splits.length} 单`, MID, true, LH_MID);
    splits.forEach((s, i) => b.row(`${s.label || `第 ${i + 1} 份`} · ${methodZh(s.method)}`, money(s.total || 0), SM, false, LH_SM));
  }
  b.gap(40);
  const height = b.height();
  return { canvas: paint(b.ops, height), height };
}

// ── PUBLIC: raster for ePOS-Print, or PNG for on-screen preview ─────────────
function raster(drawn: { canvas: Canvas; height: number } | null): { width: number; height: number; base64: string } | null {
  if (!drawn) return null;
  return packRaster(drawn.canvas.getContext("2d"), W, drawn.height);
}

/** Kitchen ticket raster. Null → caller falls back to the ASCII text ticket. */
export function renderTicketImage(o: Order, shopName: string): { width: number; height: number; base64: string } | null {
  try { return raster(drawTicket(o, shopName)); } catch { return null; }
}
/** Customer bill raster (prices + GST/PST + total) for one order or a merged
 *  table (multiple rounds). Null → no bill printed. */
export function renderReceiptImage(orders: Order | Order[], shopName: string): { width: number; height: number; base64: string } | null {
  try { return raster(drawReceipt(Array.isArray(orders) ? orders : [orders], shopName)); } catch { return null; }
}
/** Kitchen ticket as base64 PNG — preview without a printer. */
export function renderTicketPngBase64(o: Order, shopName: string): string | null {
  try { const d = drawTicket(o, shopName); return d ? d.canvas.toBuffer("image/png").toString("base64") : null; } catch { return null; }
}
/** Customer bill as base64 PNG — preview without a printer. */
export function renderReceiptPngBase64(orders: Order | Order[], shopName: string): string | null {
  try { const d = drawReceipt(Array.isArray(orders) ? orders : [orders], shopName); return d ? d.canvas.toBuffer("image/png").toString("base64") : null; } catch { return null; }
}
/** Split sub-bill ('share') or the merged full bill ('full') for a print_jobs row. */
export function renderSplitReceiptImage(kind: string, payload: unknown, shopName: string): { width: number; height: number; base64: string } | null {
  try {
    const p = (payload ?? {}) as SplitReceiptPayload;
    return raster(kind === "full" ? drawSplitFull(p, shopName) : drawSplitShare(p, shopName));
  } catch { return null; }
}
/** Split receipt as base64 PNG — preview without a printer. */
export function renderSplitReceiptPngBase64(kind: string, payload: unknown, shopName: string): string | null {
  try {
    const p = (payload ?? {}) as SplitReceiptPayload;
    const d = kind === "full" ? drawSplitFull(p, shopName) : drawSplitShare(p, shopName);
    return d ? d.canvas.toBuffer("image/png").toString("base64") : null;
  } catch { return null; }
}

function packRaster(c: SKRSContext2D, w: number, h: number): { width: number; height: number; base64: string } {
  const data = c.getImageData(0, 0, w, h).data; // RGBA
  const rowBytes = Math.ceil(w / 8);
  const raster = Buffer.alloc(rowBytes * h, 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const black = data[i + 3] > 128 && lum < 128;
      if (black) raster[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width: w, height: h, base64: raster.toString("base64") };
}
