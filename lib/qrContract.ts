// ─────────────────────────────────────────────────────────────────────────
//  ⚠️ 永久 QR 合约 — 这个文件是印在物理牌子上的 URL 的唯一事实来源。
//
//  每张桌牌编码 https://bentoos.io/menu/<slug>?t=<label>，外卖码编码
//  ?m=togo。牌子印出去就改不了 —— 改这里的任何常量都会让已印的牌子
//  指向错误页面。lib/qrContract.test.ts 守卫这些值，且 build 脚本先跑
//  测试再构建：改坏合约的代码根本部署不上去。
//
//  约束（eng review Q2）：本文件只允许常量和纯函数，禁止 import 任何
//  带副作用/读环境变量的模块（如 lib/supabase）—— 守卫测试在 Vercel
//  构建环境里跑，那里没有运行时 env。
// ─────────────────────────────────────────────────────────────────────────

/** 桌号参数：/menu/<slug>?t=<label> — 印在每张桌牌上，永不改名 */
export const TABLE_PARAM = "t";
/** 模式参数：/menu/<slug>?m=togo — 印在外卖码上，永不改名 */
export const MODE_PARAM = "m";
export const TOGO_MODE = "togo";
/** 嵌入参数（landing 展示用，可自由演化 — 不在任何印刷品上） */
export const EMBED_PARAM = "embed";
/** 菜单路由前缀 — 印在所有牌子上，永不改名 */
export const MENU_ROUTE = "/menu";

/** 顾客菜单 URL（整店一码） */
export const menuUrl = (origin: string, slug: string) => `${origin}${MENU_ROUTE}/${slug}`;
/** 桌牌 URL — 与已印的牌子逐字符一致 */
export const tableUrl = (origin: string, slug: string, label: string) =>
  `${menuUrl(origin, slug)}?${TABLE_PARAM}=${encodeURIComponent(label)}`;
/** 外卖/自取码 URL */
export const togoUrl = (origin: string, slug: string) =>
  `${menuUrl(origin, slug)}?${MODE_PARAM}=${TOGO_MODE}`;

// ── slug 规则（与 supabase/qr-lock.sql 的 tenants_slug_format 同步；
//    守卫测试断言 RESERVED_SLUGS ⊇ app/ 顶级路由目录）────────────────────
export const SLUG_PATTERN = /^[a-z0-9-]{3,30}$/;
export const RESERVED_SLUGS = [
  "app", "api", "menu", "demo", "login", "pricing", "onboarding",
  "get-started", "how-it-works", "admin", "www", "static", "assets",
  "icons", "utoronto", "order",
] as const;

/** 新租户 slug 是否合法（格式 + 不撞路由保留字） */
export function isValidSlug(slug: string): { ok: boolean; reason?: "format" | "reserved" } {
  const s = (slug || "").trim();
  if (!SLUG_PATTERN.test(s)) return { ok: false, reason: "format" };
  if ((RESERVED_SLUGS as readonly string[]).includes(s)) return { ok: false, reason: "reserved" };
  return { ok: true };
}

// ── 触发器错误码 → 人话（supabase/qr-lock.sql 的 QR_LOCKED_* 异常）────────
const QR_LOCK_MESSAGES: Record<string, { zh: string; en: string }> = {
  QR_LOCKED_SLUG: {
    zh: "牌子已锁定：店铺网址标识不可修改（印在每张桌牌的二维码里）。",
    en: "QR codes are locked: the shop handle can't change — it's printed on every table sign.",
  },
  QR_LOCKED_TABLES: {
    zh: "牌子已锁定：桌号只能新增，不能修改或删除。如确需修改请先在 Supabase 解锁。",
    en: "QR codes are locked: table labels can only be added, not renamed or removed.",
  },
  QR_LOCKED_DELETE: {
    zh: "牌子已锁定：店铺不可删除。如确需删除请先在 Supabase 解锁。",
    en: "QR codes are locked: this shop can't be deleted while signs are in use.",
  },
  QR_LOCKED_UNLOCK: {
    zh: "解锁只能由店主本人在 Supabase SQL 编辑器操作。",
    en: "Unlocking is only possible from the Supabase SQL editor.",
  },
};

/** 把 DB 报错翻译成人话；不是锁类错误时返回 null（调用方自行兜底） */
export function qrLockErrorMessage(dbMessage: string, lang: "zh" | "en" = "zh"): string | null {
  for (const [code, msg] of Object.entries(QR_LOCK_MESSAGES)) {
    if (dbMessage.includes(code)) return msg[lang];
  }
  return null;
}
