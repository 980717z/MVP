// ─────────────────────────────────────────────────────────────────────────
//  Chinese kitchen ticket → 1-bit raster for ePOS-Print <image>.
//
//  This shop's TM-T88VI has NO CJK font (Alphanumeric SKU), so 中文 can't be
//  printed as text. Instead we render the whole ticket to a monochrome bitmap
//  with a bundled Noto Sans SC font and print it as a raster <image> — the
//  printer reproduces any bitmap regardless of its resident fonts.
//
//  Every text block is WRAPPED to the printable width so a long dish name that
//  mixes 中文 + English (e.g. "本地啤酒（Molson Canadian）") can't run off the
//  right edge. Dish names hang-indent under the name so the quantity stays clear.
//
//  Output packing per ePOS-Print spec: 1 bit/pixel, MSB = leftmost pixel, each
//  row zero-padded to a whole byte. Returned base64 goes straight into
//  <image width height>…</image>.
// ─────────────────────────────────────────────────────────────────────────
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import path from "path";
import type { Order } from "./orders";
import { displayTable } from "./format";

// 80mm paper printable width on the TM-T88VI = 512 dots.
const W = 512;
const PAD = 16;
const MAXW = W - PAD * 2; // 480 dots of usable text width
const FONT = "NotoSC";

// Font sizes in printer dots (kitchen-legibility bump, ~25% over the originals).
const SHOP = 54, BIG = 50, MID = 42, SM = 34;
// Line advance per size (≈1.4× the font, matched to the originals' rhythm).
const LH_SHOP = 74, LH_BIG = 72, LH_MID = 56, LH_SM = 48;
const GAP = 22;

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

function typeBadge(o: Order): { badge: string; sub?: string } {
  const t = (o as any).order_type ?? "dine_in";
  const phone = (o.phone || "").trim() || "N/A"; // blank phone → N/A on the ticket
  if (t === "delivery") {
    const a = (o as any).address;
    return { badge: "外卖", sub: a ? [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ") : phone };
  }
  if (t === "togo") return { badge: "自取", sub: phone };
  return { badge: o.table_no ? `堂食  台号 ${displayTable(o.table_no)}` : "堂食" };
}

type Op =
  | { kind: "text"; x: number; y: number; text: string; size: number; bold: boolean }
  | { kind: "rule"; y: number; dbl: boolean };

/** Build the ticket as a drawn canvas. Wraps every block to MAXW. Returns null
 *  if canvas/font is unavailable so callers can fall back to the ASCII ticket. */
function drawTicket(o: Order, shopName: string): { canvas: Canvas; height: number } | null {
  if (!ensureFont()) return null;
  const t = typeBadge(o);
  const time = (() => {
    const d = new Date(o.created_at);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();
  const items = o.items.filter((it: any) => !it.cancelled);
  const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
  const note = (o.note || "").trim();

  // Measuring context: we need text widths to wrap BEFORE we know the height.
  const mc = createCanvas(W, 10).getContext("2d");
  const setFont = (ctx: SKRSContext2D, size: number, bold: boolean) => {
    ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
  };

  // Greedy wrap: Latin words stay whole, CJK/fullwidth chars break anywhere, and
  // an over-long single token (e.g. a URL) hard-breaks by character.
  const wrap = (text: string, size: number, bold: boolean, maxW: number): string[] => {
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
  };

  const ops: Op[] = [];
  let y = PAD;

  const centered = (text: string, size: number, bold: boolean, lineH: number) => {
    for (const ln of wrap(text, size, bold, MAXW)) {
      setFont(mc, size, bold);
      const w = mc.measureText(ln).width;
      ops.push({ kind: "text", x: Math.max(PAD, (W - w) / 2), y, text: ln, size, bold });
      y += lineH;
    }
  };
  const left = (text: string, size: number, bold: boolean, lineH: number) => {
    for (const ln of wrap(text, size, bold, MAXW)) {
      ops.push({ kind: "text", x: PAD, y, text: ln, size, bold });
      y += lineH;
    }
  };
  const item = (qty: number, name: string) => {
    const prefix = `${qty} x `;
    setFont(mc, BIG, true);
    const hang = mc.measureText(prefix).width; // continuation lines align under the name
    const lines = wrap(name, BIG, true, MAXW - hang);
    ops.push({ kind: "text", x: PAD, y, text: prefix + (lines[0] ?? ""), size: BIG, bold: true });
    y += LH_BIG;
    for (let i = 1; i < lines.length; i++) {
      ops.push({ kind: "text", x: PAD + hang, y, text: lines[i], size: BIG, bold: true });
      y += LH_BIG;
    }
  };
  const rule = (dbl = false) => { ops.push({ kind: "rule", y: y + 8, dbl }); y += GAP + (dbl ? 6 : 4); };

  centered(shopName, SHOP, true, LH_SHOP);
  rule(true);
  left(t.badge, BIG, true, LH_BIG);
  if (t.sub) left(t.sub, SM, false, LH_SM);
  left(time, SM, false, LH_SM);
  rule();
  for (const it of items) item(Number(it.qty) || 1, (it.name_zh || it.name_en || "菜品").trim());
  rule();
  left(`合计 ${count} 份`, MID, true, LH_MID);
  if (note) left(`备注: ${note}`, SM, false, LH_SM);
  y += 40; // bottom margin

  const height = Math.ceil(y);
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
  return { canvas, height };
}

/** Render one order to a 1-bit raster for ePOS-Print. Null → caller falls back
 *  to the ASCII text ticket. */
export function renderTicketImage(
  o: Order,
  shopName: string,
): { width: number; height: number; base64: string } | null {
  try {
    const drawn = drawTicket(o, shopName);
    if (!drawn) return null;
    return packRaster(drawn.canvas.getContext("2d"), W, drawn.height);
  } catch {
    return null;
  }
}

/** Same ticket as a base64 PNG — for previewing the real print output in the
 *  back-office / QA without a printer. Null → not available. */
export function renderTicketPngBase64(o: Order, shopName: string): string | null {
  try {
    const drawn = drawTicket(o, shopName);
    if (!drawn) return null;
    return drawn.canvas.toBuffer("image/png").toString("base64");
  } catch {
    return null;
  }
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
