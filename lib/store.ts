// ─────────────────────────────────────────────────────────────────────────
//  Tenant store — now backed by Supabase (Postgres + RLS).
//  Same shapes the UI already uses (Tenant / User / RecordRow), but every
//  accessor is async.  RLS on the server guarantees a user only ever sees
//  tenants they own or are a member of, so the client never filters by user.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
import { MODULES } from "./catalog";
import { computeTax } from "./tax";

export type Role = "owner" | "manager" | "staff";

export interface User {
  id: string;
  name: string;
  role: Role;
  access: string[]; // module ids; [] = all enabled
  email?: string | null;
  pending?: boolean; // invited but hasn't signed up / linked yet
}

export interface RecordRow {
  id: string;
  createdAt: string;
  [key: string]: any;
}

type Bi = { zh: string; en: string };

export interface Tenant {
  slug: string;
  name: Bi;
  industry: string;
  address: string;
  enabled: string[];
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

/** Invite a staff member by email — creates a pending member row (no auth account
 *  yet). They get access once they sign up with this email (see claimInvites). */
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
export async function claimInvites(): Promise<number> {
  const { data, error } = await supabase.rpc("claim_invites");
  if (error) {
    console.error("claimInvites", error);
    return 0;
  }
  return (data as number) ?? 0;
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

export async function updateRecord(id: string, data: Record<string, any>): Promise<void> {
  const { error } = await supabase.from("records").update({ data }).eq("id", id);
  if (error) console.error("updateRecord", error);
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from("records").delete().eq("id", id);
  if (error) console.error("deleteRecord", error);
}

// ── cross-module sync helpers ──────────────────────────────────────────────

/** When an order comes in with a phone, upsert into the members (会员) records. */
export async function syncMemberFromOrder(
  slug: string,
  phone: string,
  customerName: string,
  amount: number,
): Promise<void> {
  if (!phone) return;
  const { data: existing } = await supabase
    .from("records")
    .select("*")
    .eq("tenant_slug", slug)
    .eq("module_id", "members")
    .order("created_at", { ascending: false });

  const match = (existing ?? []).find((r) => r.data?.phone === phone);
  if (match) {
    const prev = match.data ?? {};
    const visits = (parseInt(prev.visits) || 0) + 1;
    const spend = (parseFloat(prev.spend) || 0) + amount;
    const { error } = await supabase
      .from("records")
      .update({ data: { ...prev, visits: String(visits), spend: String(Math.round(spend * 100) / 100) } })
      .eq("id", match.id);
    if (error) console.error("syncMember/update", error);
  } else {
    const { error } = await supabase.from("records").insert({
      tenant_slug: slug,
      module_id: "members",
      data: { phone, name: customerName || "", visits: "1", spend: String(amount || 0), tier: "普通", note: "" },
    });
    if (error) console.error("syncMember/insert", error);
  }
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
  const date = now.toISOString().slice(0, 10);
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

/** Pull dishes from 菜单设置 into 菜品销量与毛利 (dish-margin) records. */
export async function syncMenuToMargin(slug: string): Promise<{ added: number; updated: number }> {
  const [{ data: menuItems }, { data: existing }] = await Promise.all([
    supabase.from("menu_items").select("*").eq("tenant_slug", slug),
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "dish-margin"),
  ]);
  const dishes = menuItems ?? [];
  const byDish = new Map((existing ?? []).map((r) => [r.data?.dish, r]));
  let added = 0, updated = 0;
  for (const d of dishes) {
    const match = byDish.get(d.name_zh);
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
        data: { dish: d.name_zh, price: d.price != null ? String(d.price) : "", cost: "", soldMonth: "" },
      });
      added++;
    }
  }
  return { added, updated };
}

/** Pull purchasing records into 库存与损耗 (stock-loss). */
export async function syncPurchasingToStock(slug: string): Promise<{ added: number; updated: number }> {
  const [{ data: purchaseRecs }, { data: stockRecs }] = await Promise.all([
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "purchasing"),
    supabase.from("records").select("*").eq("tenant_slug", slug).eq("module_id", "stock-loss"),
  ]);
  const purchases = purchaseRecs ?? [];
  const stockByKey = new Map((stockRecs ?? []).map((r) => [`${r.data?.date}_${r.data?.item}`, r]));
  let added = 0, updated = 0;
  for (const p of purchases) {
    const d = p.data ?? {};
    if (!d.item) continue;
    const key = `${d.date}_${d.item}`;
    const match = stockByKey.get(key);
    if (match) {
      const prev = match.data ?? {};
      const changed = prev.unitCost !== (d.unitPrice || "") || prev.type !== (d.itemType || "");
      if (changed) {
        await supabase.from("records").update({
          data: { ...prev, unitCost: d.unitPrice || prev.unitCost, type: d.itemType || prev.type },
        }).eq("id", match.id);
        updated++;
      }
    } else {
      await supabase.from("records").insert({
        tenant_slug: slug,
        module_id: "stock-loss",
        data: { date: d.date || "", item: d.item, type: d.itemType || "", inQty: d.qty || "", unitCost: d.unitPrice || "", lossQty: "", onHand: "" },
      });
      added++;
    }
  }
  return { added, updated };
}

// ── helpers ──────────────────────────────────────────────────────────────

export async function newTenantSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "shop";
  const { data } = await supabase.from("tenants").select("slug");
  const existing = new Set((data ?? []).map((t) => t.slug));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
