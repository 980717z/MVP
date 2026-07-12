// ─────────────────────────────────────────────────────────────────────────
//  Tenant store — now backed by Supabase (Postgres + RLS).
//  Same shapes the UI already uses (Tenant / User / RecordRow), but every
//  accessor is async.  RLS on the server guarantees a user only ever sees
//  tenants they own or are a member of, so the client never filters by user.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import { MODULES } from "./catalog";
import { computeTax } from "./tax";
import { isValidSlug } from "./qrContract";

export type Role = "owner" | "manager" | "staff";

export interface User {
  id: string;
  name: string;
  role: Role;
  access: string[]; // module ids; [] = all enabled
  email?: string | null;
  pending?: boolean; // invited by email but hasn't signed up / linked yet
}

export interface RecordRow {
  id: string;
  createdAt: string;
  [key: string]: any;
}

type Bi = { zh: string; en: string };

export interface TableSpot {
  label: string;
  x: number; // 0..1 relative
  y: number; // 0..1 relative
  shape?: "square" | "round";
  w?: number;
  h?: number;
}

export interface Tenant {
  slug: string;
  name: Bi;
  industry: string;
  address: string;
  enabled: string[];
  tables: string[]; // printed QR table labels (permanent contract)
  tableLayout: TableSpot[]; // floor-plan positions (additive; keyed by label)
  users: User[];
  records: Record<string, RecordRow[]>;
}

// keep enabled in canonical catalog order
function orderEnabled(ids: string[]): string[] {
  const set = new Set(ids);
  return MODULES.filter((m) => set.has(m.id)).map((m) => m.id);
}

function rowToTenant(row: any, users: User[] = [], records: Record<string, RecordRow[]> = {}): Tenant {
  return {
    slug: row.slug,
    name: typeof row.name === "string" ? { zh: row.name, en: row.name } : row.name ?? { zh: row.slug, en: row.slug },
    industry: row.industry ?? "restaurant",
    address: row.address ?? "",
    enabled: Array.isArray(row.enabled) ? row.enabled : [],
    tables: Array.isArray(row.tables) ? row.tables : [],
    tableLayout: Array.isArray(row.table_layout) ? row.table_layout : [],
    users,
    records,
  };
}

// ── reads ──────────────────────────────────────────────────────────────────

/** Lightweight list for the home page (no members/records hydrated). */
export async function loadTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("loadTenants", error);
    return [];
  }
  return (data ?? []).map((r) => rowToTenant(r));
}

/** Full tenant: members → users, and records grouped by module_id. */
export async function getTenant(slug: string): Promise<Tenant | undefined> {
  const [{ data: t, error: te }, { data: mem }, { data: recs }] = await Promise.all([
    supabase.from("tenants").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("members").select("*").eq("tenant_slug", slug).order("created_at"),
    supabase.from("records").select("*").eq("tenant_slug", slug).order("created_at", { ascending: false }),
  ]);
  if (te || !t) return undefined;

  const users: User[] = (mem ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role as Role,
    access: Array.isArray(m.access) ? m.access : [],
    email: m.email ?? null,
    pending: !m.member_id,
  }));

  const records: Record<string, RecordRow[]> = {};
  for (const r of recs ?? []) {
    const list = (records[r.module_id] ??= []);
    list.push({ id: r.id, createdAt: r.created_at, ...(r.data ?? {}) });
  }

  return rowToTenant(t, users, records);
}

// ── writes ───────────────────────────────────────────────────────────────

export async function createTenant(input: {
  name: string;
  /** desired URL handle, e.g. "fulai" → bentoos.io/fulai. falls back to name. */
  slug?: string;
  address?: string;
  enabled?: string[];
}): Promise<{ slug?: string; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { error: "未登录：请先登录后再创建商家。" };

  const slug = await newTenantSlug(input.slug?.trim() || input.name);
  const { error } = await supabase.from("tenants").insert({
    slug,
    name: { zh: input.name, en: input.name },
    industry: "restaurant",
    address: input.address ?? "",
    enabled: orderEnabled(input.enabled ?? []),
    owner_id: uid,
  });
  if (error) {
    console.error("createTenant", error);
    return { error: `${error.message}${error.hint ? "（提示：" + error.hint + "）" : ""}` };
  }
  // owner is implicitly a member-with-all-access; add a row for the roster UI
  const { error: memErr } = await supabase.from("members").insert({
    tenant_slug: slug,
    member_id: uid,
    name: "我（老板）",
    role: "owner",
    access: [],
  });
  if (memErr) console.error("createTenant/member", memErr);
  return { slug };
}

export async function setEnabled(slug: string, enabled: string[]): Promise<void> {
  const { error } = await supabase
    .from("tenants")
    .update({ enabled: orderEnabled(enabled) })
    .eq("slug", slug);
  if (error) console.error("setEnabled", error);
}

export async function addMember(
  slug: string,
  user: { name: string; role: Role; access: string[] }
): Promise<void> {
  const { error } = await supabase.from("members").insert({
    tenant_slug: slug,
    name: user.name,
    role: user.role,
    access: user.role === "owner" ? [] : user.access,
  });
  if (error) console.error("addMember", error);
}

export async function removeMember(id: string): Promise<void> {
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) console.error("removeMember", error);
}

/** Invite a staff member by email — creates a pending member row (no auth
 *  account yet). They get access once they sign up with this email and
 *  claim_invites() links them (supabase/invites.sql). */
export async function inviteMember(
  slug: string,
  user: { name: string; email: string; role: Role; access: string[] },
): Promise<{ error?: string }> {
  const email = user.email.trim().toLowerCase();
  const { error } = await supabase.from("members").insert({
    tenant_slug: slug,
    name: user.name.trim() || email,
    email,
    role: user.role,
    access: user.role === "owner" ? [] : user.access,
  });
  if (error) return { error: error.message };
  return {};
}

/** After login, link any pending invites for this user's email to their account. */
export async function claimInvites(): Promise<void> {
  const { error } = await supabase.rpc("claim_invites");
  if (error) console.error("claimInvites", error);
}

/** The signed-in user's membership for a tenant: role + allowed module ids.
 *  Owner (or access=[]) → full access (null = unrestricted). */
export async function myAccess(slug: string): Promise<{ role: Role; allowed: string[] | null } | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const [{ data: t }, { data: m }] = await Promise.all([
    supabase.from("tenants").select("owner_id").eq("slug", slug).maybeSingle(),
    supabase.from("members").select("role, access").eq("tenant_slug", slug).eq("member_id", uid).maybeSingle(),
  ]);
  if (t?.owner_id === uid) return { role: "owner", allowed: null };
  if (!m) return null;
  const access = Array.isArray(m.access) ? m.access : [];
  return { role: m.role as Role, allowed: m.role === "owner" || access.length === 0 ? null : access };
}

export async function addRecord(
  slug: string,
  moduleId: string,
  data: Record<string, any>
): Promise<void> {
  const { error } = await supabase.from("records").insert({
    tenant_slug: slug,
    module_id: moduleId,
    data,
  });
  if (error) console.error("addRecord", error);
}

/** Returns { error } on failure so callers that need to know (e.g. "mark done"
 *  buttons) can warn the user instead of silently reloading unchanged data. */
export async function updateRecord(id: string, data: Record<string, any>): Promise<{ error?: string }> {
  const { error } = await supabase.from("records").update({ data }).eq("id", id);
  if (error) {
    console.error("updateRecord", error);
    return { error: error.message || "更新失败" };
  }
  return {};
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from("records").delete().eq("id", id);
  if (error) console.error("deleteRecord", error);
}

// ── cross-module sync helpers ──────────────────────────────────────────────

// ── member tier rules ─────────────────────────────────────────────────────

export interface TierRule {
  name: string;
  minSpend: number;
}

const DEFAULT_TIERS: TierRule[] = [
  { name: "普通", minSpend: 0 },
  { name: "银卡", minSpend: 500 },
  { name: "金卡", minSpend: 1000 },
];

export async function loadTierRules(slug: string): Promise<TierRule[]> {
  const { data } = await supabase
    .from("records")
    .select("data")
    .eq("tenant_slug", slug)
    .eq("module_id", "member-tier-config")
    .order("created_at", { ascending: false })
    .limit(1);
  const tiers = data?.[0]?.data?.tiers;
  return Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS;
}

export async function saveTierRules(slug: string, tiers: TierRule[]): Promise<void> {
  const sorted = [...tiers].sort((a, b) => a.minSpend - b.minSpend);
  const { data: existing } = await supabase
    .from("records")
    .select("id")
    .eq("tenant_slug", slug)
    .eq("module_id", "member-tier-config")
    .limit(1);
  if (existing?.length) {
    await supabase.from("records").update({ data: { tiers: sorted } }).eq("id", existing[0].id);
  } else {
    await supabase.from("records").insert({
      tenant_slug: slug,
      module_id: "member-tier-config",
      data: { tiers: sorted },
    });
  }
}

function tierForSpend(spend: number, rules: TierRule[]): string {
  const sorted = [...rules].sort((a, b) => b.minSpend - a.minSpend);
  for (const r of sorted) {
    if (spend >= r.minSpend) return r.name;
  }
  return rules[0]?.name ?? "普通";
}

/** When an order comes in with a phone, upsert into the members (会员) records. */
export async function syncMemberFromOrder(
  slug: string,
  phone: string,
  customerName: string,
  amount: number,
): Promise<void> {
  if (!phone) return;
  const [{ data: existing }, tiers] = await Promise.all([
    supabase
      .from("records")
      .select("*")
      .eq("tenant_slug", slug)
      .eq("module_id", "members")
      .order("created_at", { ascending: false }),
    loadTierRules(slug),
  ]);

  const match = (existing ?? []).find((r) => r.data?.phone === phone);
  if (match) {
    const prev = match.data ?? {};
    const visits = (parseInt(prev.visits) || 0) + 1;
    const spend = (parseFloat(prev.spend) || 0) + amount;
    const tier = tierForSpend(spend, tiers);
    const { error } = await supabase
      .from("records")
      .update({ data: { ...prev, visits: String(visits), spend: String(Math.round(spend * 100) / 100), tier } })
      .eq("id", match.id);
    if (error) console.error("syncMember/update", error);
  } else {
    const spend = amount || 0;
    const tier = tierForSpend(spend, tiers);
    const { error } = await supabase.from("records").insert({
      tenant_slug: slug,
      module_id: "members",
      data: { phone, name: customerName || "", visits: "1", spend: String(spend), tier, note: "" },
    });
    if (error) console.error("syncMember/insert", error);
  }
}

/** Re-apply tier rules to all existing members. */
export async function reapplyTiers(slug: string): Promise<number> {
  const [{ data: members }, tiers] = await Promise.all([
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "members"),
    loadTierRules(slug),
  ]);
  let updated = 0;
  for (const m of members ?? []) {
    const prev = m.data ?? {};
    const spend = parseFloat(prev.spend) || 0;
    const tier = tierForSpend(spend, tiers);
    if (prev.tier !== tier) {
      await supabase.from("records").update({ data: { ...prev, tier } }).eq("id", m.id);
      updated++;
    }
  }
  return updated;
}

/** List records for one module (newest first). */
export async function listRecords(slug: string, moduleId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("tenant_slug", slug)
    .eq("module_id", moduleId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listRecords", error);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, createdAt: r.created_at, ...(r.data ?? {}) }));
}

/**
 * When an order is completed, write a transaction into the 销售流水 (sales)
 * ledger with the Ontario tax breakdown. Idempotent per order: skips if a sale
 * already references this order id, so re-completing won't double-record.
 */
export async function recordOrderSale(
  slug: string,
  order: { id: string; total: number; items: { name_zh: string; qty: number }[]; source?: string },
): Promise<void> {
  const { data: existing } = await supabase
    .from("records")
    .select("id,data")
    .eq("tenant_slug", slug)
    .eq("module_id", "sales");
  if ((existing ?? []).some((r) => r.data?.orderId === order.id)) return;

  const { subtotal, gst, pst, total } = computeTax(Number(order.total) || 0, false);
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const desc = order.items.map((it) => `${it.name_zh}×${it.qty}`).join(", ");

  const { error } = await supabase.from("records").insert({
    tenant_slug: slug,
    module_id: "sales",
    data: {
      date,
      ts,
      source: order.source ?? "qr",
      desc,
      subtotal: String(subtotal),
      gst: String(gst),
      pst: String(pst),
      total: String(total),
      orderId: order.id,
    },
  });
  if (error) console.error("recordOrderSale", error);
}

/**
 * When an order is completed, add each dish's quantity to 菜品销量与毛利
 * (dish-margin) so sales figures update automatically. Matches by Chinese dish
 * name; creates the dish row if it doesn't exist yet. Call exactly once per
 * order (on the transition into "done") to avoid double-counting.
 */
export async function postOrderSales(
  slug: string,
  items: { name_zh: string; qty: number; price: number | null }[],
): Promise<void> {
  // aggregate qty per dish first (an order may list the same dish twice)
  const want = new Map<string, { qty: number; price?: string }>();
  for (const it of items) {
    const name = (it.name_zh || "").trim();
    const qty = Number(it.qty) || 0;
    if (!name || !qty) continue;
    const e = want.get(name) ?? { qty: 0 };
    e.qty += qty;
    if (e.price == null && it.price != null) e.price = String(it.price);
    want.set(name, e);
  }
  if (want.size === 0) return;

  const { data: existing } = await supabase
    .from("records")
    .select("*")
    .eq("tenant_slug", slug)
    .eq("module_id", "dish-margin");
  const byDish = new Map((existing ?? []).map((r) => [r.data?.dish, r]));

  for (const [dish, { qty, price }] of want) {
    const match = byDish.get(dish);
    if (match) {
      const prev = match.data ?? {};
      const sold = (parseFloat(prev.soldMonth) || 0) + qty;
      const data = { ...prev, soldMonth: String(sold), price: prev.price && prev.price !== "" ? prev.price : price ?? "" };
      const { error } = await supabase.from("records").update({ data }).eq("id", match.id);
      if (error) console.error("postOrderSales/update", error);
    } else {
      const { error } = await supabase.from("records").insert({
        tenant_slug: slug,
        module_id: "dish-margin",
        data: { dish, price: price ?? "", cost: "", soldMonth: String(qty) },
      });
      if (error) console.error("postOrderSales/insert", error);
    }
  }
}

/** Pull dishes from 菜单设置 into 菜品销量 (dish-margin) records. */
let _syncMenuLock: Promise<{ added: number; updated: number }> | null = null;
export function syncMenuToMargin(slug: string): Promise<{ added: number; updated: number }> {
  if (_syncMenuLock) return _syncMenuLock;
  _syncMenuLock = _syncMenuToMarginImpl(slug).finally(() => { _syncMenuLock = null; });
  return _syncMenuLock;
}
async function _syncMenuToMarginImpl(slug: string): Promise<{ added: number; updated: number }> {
  const [{ data: menuItems }, { data: existing }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("tenant_slug", slug),
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "dish-margin"),
  ]);
  const dishes = menuItems ?? [];
  // dedupe: if multiple records exist for the same dish, keep the one with the most sales
  const byDish = new Map<string, typeof existing extends (infer T)[] | null ? T : never>();
  for (const r of existing ?? []) {
    const name = r.data?.dish;
    if (!name) continue;
    const prev = byDish.get(name);
    if (!prev || (parseFloat(r.data?.soldMonth) || 0) > (parseFloat(prev.data?.soldMonth) || 0)) {
      byDish.set(name, r);
    }
  }
  // remove duplicate records
  for (const r of existing ?? []) {
    const name = r.data?.dish;
    if (name && byDish.get(name)?.id !== r.id) {
      await supabase.from("records").delete().eq("id", r.id);
    }
  }
  let added = 0, updated = 0;
  for (const d of dishes) {
    const name = (d.name_zh || "").trim();
    if (!name) continue;
    const match = byDish.get(name);
    if (match) {
      const prev = match.data ?? {};
      const price = d.price != null ? String(d.price) : prev.price ?? "";
      if (prev.price !== price) {
        await supabase.from("records").update({ data: { ...prev, price } }).eq("id", match.id);
        updated++;
      }
    } else {
      await supabase.from("records").insert({
        tenant_slug: slug,
        module_id: "dish-margin",
        data: { dish: name, price: d.price != null ? String(d.price) : "", soldMonth: "" },
      });
      byDish.set(name, { id: "pending" } as any);
      added++;
    }
  }
  return { added, updated };
}

/** Pull purchasing records into 库存与损耗 (stock-loss).
 *  Uses purchaseId as idempotent key so each purchasing record maps to exactly
 *  one stock-loss row, even for the same item on the same day. */
export async function syncPurchasingToStock(slug: string): Promise<{ added: number; updated: number }> {
  const [{ data: purchaseRecs }, { data: stockRecs }] = await Promise.all([
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "purchasing"),
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "stock-loss"),
  ]);
  const purchases = purchaseRecs ?? [];
  const stockByPurchaseId = new Map(
    (stockRecs ?? []).filter((r) => r.data?.purchaseId).map((r) => [r.data.purchaseId, r]),
  );
  let added = 0, updated = 0;
  for (const p of purchases) {
    const d = p.data ?? {};
    if (!d.item) continue;
    const match = stockByPurchaseId.get(p.id);
    if (match) {
      const prev = match.data ?? {};
      const changed =
        prev.inQty !== (d.qty || "") ||
        prev.unitCost !== (d.unitPrice || "") ||
        prev.type !== (d.itemType || "");
      if (changed) {
        await supabase.from("records").update({
          data: { ...prev, inQty: d.qty || prev.inQty, unitCost: d.unitPrice || prev.unitCost, type: d.itemType || prev.type },
        }).eq("id", match.id);
        updated++;
      }
    } else {
      await supabase.from("records").insert({
        tenant_slug: slug,
        module_id: "stock-loss",
        data: {
          purchaseId: p.id,
          date: d.date || "",
          item: d.item,
          type: d.itemType || "",
          inQty: d.qty || "",
          unitCost: d.unitPrice || "",
          lossQty: "",
          onHand: "",
        },
      });
      added++;
    }
  }
  return { added, updated };
}

// ── daily-close auto-fill ────────────────────────────────────────────────

export async function computeDailyClose(
  slug: string,
  date: string,
): Promise<{ dineIn: string; delivery: string; expenses: string; tips: string }> {
  const [{ data: salesRecs }, { data: deliveryRecs }, { data: purchaseRecs }, { data: groupRecs }, { data: equipRecs }] =
    await Promise.all([
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "sales"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "delivery-agg"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "purchasing"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "group-booking"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "equipment"),
    ]);

  let dineIn = 0;
  let tips = 0;
  for (const r of salesRecs ?? []) {
    if (r.data?.date === date) dineIn += parseFloat(r.data.subtotal) || 0;
  }
  for (const r of groupRecs ?? []) {
    if (r.data?.date === date) {
      dineIn += (parseFloat(r.data?.total) || 0) - (parseFloat(r.data?.balance) || 0);
      tips += parseFloat(r.data?.tips) || 0;
    }
  }

  let delivery = 0;
  for (const r of deliveryRecs ?? []) {
    if (r.data?.date === date) delivery += parseFloat(r.data.net) || 0;
  }

  let expenses = 0;
  for (const r of purchaseRecs ?? []) {
    if (r.data?.date === date) expenses += parseFloat(r.data.total) || 0;
  }
  for (const r of equipRecs ?? []) {
    if (r.data?.date === date) expenses += parseFloat(r.data.cost) || 0;
  }

  const r2 = (n: number) => String(Math.round(n * 100) / 100);
  return { dineIn: r2(dineIn), delivery: r2(delivery), expenses: r2(expenses), tips: r2(tips) };
}

/** Auto-create or update daily-close records for all dates with activity. */
export async function autoSyncDailyClose(slug: string): Promise<void> {
  const [{ data: salesRecs }, { data: deliveryRecs }, { data: purchaseRecs }, { data: groupRecs }, { data: equipRecs }, { data: closeRecs }] =
    await Promise.all([
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "sales"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "delivery-agg"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "purchasing"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "group-booking"),
      supabase.from("records").select("data").eq("tenant_slug", slug).eq("module_id", "equipment"),
      supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "daily-close"),
    ]);

  // collect all dates with activity
  const dates = new Set<string>();
  for (const r of salesRecs ?? []) if (r.data?.date) dates.add(r.data.date);
  for (const r of deliveryRecs ?? []) if (r.data?.date) dates.add(r.data.date);
  for (const r of purchaseRecs ?? []) if (r.data?.date) dates.add(r.data.date);
  for (const r of groupRecs ?? []) if (r.data?.date) dates.add(r.data.date);
  for (const r of equipRecs ?? []) if (r.data?.date && (parseFloat(r.data.cost) || 0) > 0) dates.add(r.data.date);

  const closeByDate = new Map((closeRecs ?? []).map((r) => [r.data?.date, r]));
  const r2 = (n: number) => String(Math.round(n * 100) / 100);

  for (const date of dates) {
    let dineIn = 0, tips = 0, delivery = 0, expenses = 0;
    for (const r of salesRecs ?? []) {
      if (r.data?.date === date) dineIn += parseFloat(r.data.subtotal) || 0;
    }
    for (const r of groupRecs ?? []) {
      if (r.data?.date === date) {
        dineIn += (parseFloat(r.data?.total) || 0) - (parseFloat(r.data?.balance) || 0);
        tips += parseFloat(r.data?.tips) || 0;
      }
    }
    for (const r of deliveryRecs ?? []) {
      if (r.data?.date === date) delivery += parseFloat(r.data.net) || 0;
    }
    for (const r of purchaseRecs ?? []) {
      if (r.data?.date === date) expenses += parseFloat(r.data.total) || 0;
    }
    for (const r of equipRecs ?? []) {
      if (r.data?.date === date) expenses += parseFloat(r.data.cost) || 0;
    }

    const d = r2(dineIn), del = r2(delivery), exp = r2(expenses), tip = r2(tips);
    const net = r2(dineIn + delivery - tips - expenses);
    const match = closeByDate.get(date);

    if (match) {
      const prev = match.data ?? {};
      if (prev.dineIn !== d || prev.delivery !== del || prev.expenses !== exp || prev.tips !== tip) {
        await supabase.from("records").update({
          data: { ...prev, date, dineIn: d, delivery: del, expenses: exp, tips: tip, net },
        }).eq("id", match.id);
      }
    } else {
      await supabase.from("records").insert({
        tenant_slug: slug,
        module_id: "daily-close",
        data: { date, dineIn: d, delivery: del, expenses: exp, tips: tip, net },
      });
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

export async function newTenantSlug(name: string): Promise<string> {
  let base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "shop";
  // QR 合约规则（lib/qrContract.ts + supabase/qr-lock.sql）：
  // 太短补长、太长截断、撞路由保留字加后缀 —— DB CHECK 会拒绝不合规 slug。
  if (base.length < 3) base = `${base}-shop`.slice(0, 30).replace(/^-|-$/g, "");
  base = base.slice(0, 30).replace(/-$/g, "");
  if (!isValidSlug(base).ok) base = `${base.slice(0, 25)}-shop`;
  const { data } = await supabase.from("tenants").select("slug");
  const existing = new Set((data ?? []).map((t) => t.slug));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
