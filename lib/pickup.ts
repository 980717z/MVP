// ─────────────────────────────────────────────────────────────────────────
//  Campus order-ahead pickup — client helpers.
//  createPickupOrder → server route (server-generated token/code).
//  getTracking       → token-gated SECURITY DEFINER RPC (public fields only).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";
import type { OrderItem } from "./orders";

export interface Tracking {
  status: string;
  ready_at: string | null;
  picked_up_at: string | null;
  eta_minutes: number | null;
  pickup_code: string | null;
  created_at: string;
  items: { name_zh?: string; name_en?: string; qty?: number }[];
}

/** Pickup-flow step (1..4) derived from status + additive timestamps.
 *  received → preparing → ready(ready_at) → picked-up(picked_up_at). */
export function pickupStep(t: Pick<Tracking, "status" | "ready_at" | "picked_up_at">): 1 | 2 | 3 | 4 {
  if (t.picked_up_at) return 4;
  if (t.ready_at) return 3;
  if (t.status === "preparing") return 2;
  return 1;
}

export async function createPickupOrder(input: {
  slug: string;
  items: OrderItem[];
  phone?: string;
  note?: string;
}): Promise<{ id: string; tracking_token: string; pickup_code: string } | { error: string }> {
  try {
    const res = await fetch("/api/pickup/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) return { error: j?.error || `HTTP ${res.status}` };
    return { id: j.id, tracking_token: j.tracking_token, pickup_code: j.pickup_code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}

export async function getTracking(orderId: string, token: string): Promise<Tracking | null> {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_order_id: orderId, p_token: token });
  if (error) {
    console.error("getTracking", error.message);
    return null;
  }
  return (Array.isArray(data) ? data[0] : data) ?? null;
}
