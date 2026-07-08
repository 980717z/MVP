// ─────────────────────────────────────────────────────────────────────────
//  Chinese kitchen ticket → 1-bit raster for ePOS-Print <image>.
//
//  This shop's TM-T88VI has NO CJK font (Alphanumeric SKU), so 中文 can't be
//  printed as text. Instead we render the whole ticket to a monochrome bitmap
//  with a bundled Noto Sans SC font and print it as a raster <image> — the
//  printer reproduces any bitmap regardless of its resident fonts.
//
//  Output packing per ePOS-Print spec: 1 bit/pixel, MSB = leftmost pixel, each
//  row zero-padded to a whole byte. Returned base64 goes straight into
//  <image width height>…</image>.
// ─────────────────────────────────────────────────────────────────────────
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "path";
import type { Order } from "./orders";
import { displayTable } from "./format";

// 80mm paper printable width on the TM-T88VI = 512 dots.
const W = 512;
const PAD = 16;
const FONT = "NotoSC";

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

/** Render one order to a 1-bit raster. Returns null if canvas/font is
 *  unavailable so the caller can fall back to the ASCII text ticket. */
export function renderTicketImage(
  o: Order,
  shopName: string,
): { width: number; height: number; base64: string } | null {
  if (!ensureFont()) return null;
  try {
    const t = typeBadge(o);
    const time = (() => {
      const d = new Date(o.created_at);
      return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    })();
    const items = o.items.filter((it: any) => !it.cancelled);
    const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);
    const note = (o.note || "").trim();

    // ── measure pass: compute total height ──
    const BIG = 40, MID = 34, SM = 28;
    const H_BIG = 58, H_MID = 46, H_SM = 40, GAP = 18;
    let h = PAD;
    h += 60;                       // shop name
    h += GAP + 6;                  // rule
    h += H_BIG;                    // badge
    if (t.sub) h += H_SM;          // sub (phone/addr)
    h += H_SM;                     // time
    h += GAP + 4;                  // rule
    h += items.length * H_BIG;     // items
    h += GAP + 4;                  // rule
    h += H_MID;                    // count
    if (note) h += H_SM;           // note
    h += 40;                       // bottom margin
    const height = Math.ceil(h);

    const canvas = createCanvas(W, height);
    const c = canvas.getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, W, height);
    c.fillStyle = "#000";
    c.textBaseline = "top";

    let y = PAD;
    const center = (txt: string, size: number, bold = false) => {
      c.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
      const w = c.measureText(txt).width;
      c.fillText(txt, Math.max(PAD, (W - w) / 2), y);
    };
    const left = (txt: string, size: number, bold = false) => {
      c.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
      c.fillText(txt, PAD, y);
    };
    const rule = (dbl = false) => { c.fillRect(PAD, y + 8, W - PAD * 2, dbl ? 3 : 1); };

    center(shopName, 44, true); y += 60;
    rule(true); y += GAP + 6;
    left(t.badge, BIG, true); y += H_BIG;
    if (t.sub) { left(t.sub, SM); y += H_SM; }
    left(time, SM); y += H_SM;
    rule(); y += GAP + 4;
    for (const it of items) {
      const qty = Number(it.qty) || 1;
      const name = (it.name_zh || it.name_en || "菜品").trim();
      left(`${qty} x ${name}`, BIG, true);
      y += H_BIG;
    }
    rule(); y += GAP + 4;
    left(`合计 ${count} 份`, MID, true); y += H_MID;
    if (note) { left(`备注: ${note}`, SM); y += H_SM; }

    // ── pack to 1-bit raster (MSB first, row byte-aligned) ──
    return packRaster(c, W, height);
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
