import { describe, expect, it } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  EMBED_PARAM, MENU_ROUTE, MODE_PARAM, RESERVED_SLUGS, TABLE_PARAM, TOGO_MODE,
  isValidSlug, menuUrl, qrLockErrorMessage, tableUrl, togoUrl,
} from "./qrContract";

// ─────────────────────────────────────────────────────────────────────────
//  ⚠️ 永久 QR 合约守卫。这些断言对应印在物理牌子上的 URL。
//  如果这里红了，说明有改动会让已印的牌子扫出错误页面 —— 修改动，不要改测试。
//  （build = `vitest run && next build`，红了根本部署不上去。）
// ─────────────────────────────────────────────────────────────────────────

const ORIGIN = "https://bentoos.io";

describe("printed-QR URL contract (NEVER change)", () => {
  it("table sign URLs match what was printed", () => {
    expect(tableUrl(ORIGIN, "fulai", "1")).toBe("https://bentoos.io/menu/fulai?t=1");
    expect(tableUrl(ORIGIN, "fulai", "8A")).toBe("https://bentoos.io/menu/fulai?t=8A");
    expect(tableUrl(ORIGIN, "fulai", "2A")).toBe("https://bentoos.io/menu/fulai?t=2A");
  });
  it("togo sign URL matches what was printed", () => {
    expect(togoUrl(ORIGIN, "fulai")).toBe("https://bentoos.io/menu/fulai?m=togo");
  });
  it("param names are frozen", () => {
    expect(TABLE_PARAM).toBe("t");
    expect(MODE_PARAM).toBe("m");
    expect(TOGO_MODE).toBe("togo");
    expect(MENU_ROUTE).toBe("/menu");
    expect(EMBED_PARAM).toBe("embed"); // not printed, but landing embeds depend on it
  });
  it("menu route file exists where the printed URLs point", () => {
    // 牌子指向 /menu/<slug> — 这个动态路由文件消失/改名 = 所有牌子 404
    expect(existsSync(join(process.cwd(), "app", "menu", "[tenant]", "page.tsx"))).toBe(true);
  });
  it("menu page still reads the frozen params", () => {
    // 页面代码必须继续消费 ?t= 和 ?m=togo（防重构悄悄换参数名）
    const src = require("node:fs").readFileSync(
      join(process.cwd(), "app", "menu", "[tenant]", "page.tsx"), "utf8");
    expect(src).toContain(`params.get("${TABLE_PARAM}")`);
    expect(src).toContain(`params.get("${MODE_PARAM}")`);
  });
});

describe("slug rules (sync with supabase/qr-lock.sql tenants_slug_format)", () => {
  it("accepts normal handles", () => {
    expect(isValidSlug("fulai").ok).toBe(true);
    expect(isValidSlug("golden-wok-2").ok).toBe(true);
  });
  it("rejects bad formats", () => {
    expect(isValidSlug("Fu Lai")).toEqual({ ok: false, reason: "format" });
    expect(isValidSlug("ab")).toEqual({ ok: false, reason: "format" });
    expect(isValidSlug("富来")).toEqual({ ok: false, reason: "format" });
    expect(isValidSlug("")).toEqual({ ok: false, reason: "format" });
  });
  it("rejects route-colliding reserved words", () => {
    expect(isValidSlug("demo")).toEqual({ ok: false, reason: "reserved" });
    expect(isValidSlug("login")).toEqual({ ok: false, reason: "reserved" });
    expect(isValidSlug("menu")).toEqual({ ok: false, reason: "reserved" });
  });
  it("RESERVED_SLUGS covers every top-level app/ route dir (add new routes to the list!)", () => {
    const routeDirs = readdirSync(join(process.cwd(), "app"), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("_"))
      .map((d) => d.name);
    for (const dir of routeDirs) {
      expect(RESERVED_SLUGS, `app/${dir} is a route — add "${dir}" to RESERVED_SLUGS`).toContain(dir);
    }
  });
});

describe("qrLockErrorMessage", () => {
  it("translates trigger error codes to human text", () => {
    expect(qrLockErrorMessage('update blocked: QR_LOCKED_TABLES: 牌子已锁定', "zh")).toContain("桌号只能新增");
    expect(qrLockErrorMessage("QR_LOCKED_SLUG: x", "en")).toContain("printed on every table sign");
  });
  it("returns null for unrelated errors", () => {
    expect(qrLockErrorMessage("network error", "zh")).toBeNull();
  });
});
