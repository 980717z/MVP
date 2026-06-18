// ─────────────────────────────────────────────────────────────────────────
//  Orders data layer — public customers submit; tenant members read/manage.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export interface OrderItem {
  id: string;
  name_zh: string;
  name_en: string;
  price: number | null;
  qty: number;
}

export interface Order {
  id: string;
  tenant_slug: string;
  items: OrderItem[];
  total: number;
  table_no: string;
  phone: string;
  note: string;
  status: "new" | "preparing" | "done" | "cancelled";
  created_at: string;
}

/** Customer submits an order (works for anon). */
export async function createOrder(
  slug: string,
  input: { items: OrderItem[]; total: number; table_no?: string; phone?: string; note?: string }
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase
    .from("orders")
    .insert({
      tenant_slug: slug,
      items: input.items,
      total: input.total,
      table_no: input.table_no ?? "",
      phone: input.phone ?? "",
      note: input.note ?? "",
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("createOrder", error);
    return { error: error.message };
  }
  return { id: data?.id };
}

export async function listOrders(slug: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("tenant_slug", slug)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listOrders", error);
    return [];
  }
  return (data ?? []) as Order[];
}

export async function setOrderStatus(id: string, status: Order["status"]): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) console.error("setOrderStatus", error);
}
