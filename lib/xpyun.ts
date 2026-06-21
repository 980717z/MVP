// ─────────────────────────────────────────────────────────────────────────
//  芯烨云 (Xprinter Cloud) 打印机 — server-only client.
//
//  Talks to the XPYun open platform: https://open.xpyun.net/api/openapi
//  Auth = our global developer account (XPYUN_USER + XPYUN_KEY), kept in env
//  and NEVER shipped to the browser. Each shop binds one printer by SN.
//
//  Receipt markup tags supported by the device firmware:
//    <C>…</C> center   <L>…</L> left   <R>…</R> right
//    <B>…</B> 2× size   <BOLD>…</BOLD> bold   <BR> line break
//  Content is sent as UTF-8 JSON (the platform decodes it for the printer).
// ─────────────────────────────────────────────────────────────────────────

import { createHash } from "crypto";
import type { Order } from "./orders";
import { price } from "./format";

const BASE = "https://open.xpyun.net/api/openapi";

export interface XpyunConfig {
  user: string;
  key: string; // UserKEY — secret
}

/** Read our developer credentials from env (server-only). */
export function xpyunConfig(): XpyunConfig | null {
  const user = process.env.XPYUN_USER;
  const key = process.env.XPYUN_KEY;
  if (!user || !key) return null;
  return { user, key };
}

/** Common params every request needs: user + timestamp + sha1 signature. */
function commonParams(cfg: XpyunConfig) {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = createHash("sha1")
    .update(cfg.user + cfg.key + timestamp)
    .digest("hex");
  return { user: cfg.user, timestamp, sign, debug: "0" };
}

interface XpyunResponse {
  code: number; // 0 = success
  msg: string;
  data?: unknown;
}

async function call(cfg: XpyunConfig, path: string, body: Record<string, unknown>): Promise<XpyunResponse> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", charset: "UTF-8" },
    body: JSON.stringify({ ...commonParams(cfg), ...body }),
  });
  const json = (await res.json().catch(() => null)) as XpyunResponse | null;
  if (!json) throw new Error(`xpyun ${path}: non-JSON response (HTTP ${res.status})`);
  return json;
}

// ── Operations ─────────────────────────────────────────────────────────────

/** Register a printer (run once per device). name shows in the XPYun console. */
export async function addPrinter(cfg: XpyunConfig, sn: string, name: string) {
  return call(cfg, "/xprinter/addPrinters", { items: [{ sn, name }] });
}

/** Send raw markup content to a printer. copies = number of identical tickets. */
export async function printContent(cfg: XpyunConfig, sn: string, content: string, copies = 1) {
  return call(cfg, "/xprinter/print", { sn, content, copies });
}

/** Liveness/paper check for a single printer. */
export async function printerStatus(cfg: XpyunConfig, sn: string) {
  return call(cfg, "/xprinter/queryPrinterStatus", { sn });
}

// ── Receipt formatting ───────────────────────────────────────────────────────

const TZ = "America/Toronto";
function stamp(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Build a kitchen ticket from an order. Tuned for an 80mm roll but degrades fine
 * on 58mm (lines just wrap). shopName is the merchant's display name.
 */
export function buildReceipt(order: Order, shopName: string): string {
  const L: string[] = [];
  L.push(`<C><B>${shopName}</B></C>`);
  L.push(`<C>新订单 NEW ORDER</C>`);
  L.push("--------------------------------");
  if (order.table_no) L.push(`<B>桌号 Table: ${order.table_no}</B>`);
  L.push(`时间 Time: ${stamp(order.created_at)}`);
  if (order.phone) L.push(`电话 Tel: ${order.phone}`);
  L.push("--------------------------------");

  for (const it of order.items) {
    const name = it.name_zh || it.name_en || it.id;
    // qty in bold so the kitchen reads counts at a glance
    L.push(`<BOLD>${it.qty} x</BOLD> ${name}`);
    if (it.name_zh && it.name_en) L.push(`   ${it.name_en}`);
  }

  L.push("--------------------------------");
  if (order.note) L.push(`<BOLD>备注 Note: ${order.note}</BOLD>`);
  L.push(`<R>合计 Total: ${price(order.total)}</R>`);
  L.push("<BR><BR>");
  return L.join("<BR>");
}

/** A fixed sample ticket — handy to confirm a freshly-bound printer works. */
export function testReceipt(shopName: string): string {
  return [
    `<C><B>${shopName}</B></C>`,
    `<C>打印测试 TEST PRINT</C>`,
    "--------------------------------",
    `<BOLD>2 x</BOLD> 测试菜品 Test Dish`,
    "--------------------------------",
    `<R>${stamp(new Date().toISOString())}</R>`,
    "如果你看到这张小票，",
    "说明云打印已经接通 ✅",
    "<BR><BR>",
  ].join("<BR>");
}
