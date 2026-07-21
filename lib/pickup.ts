// ─────────────────────────────────────────────────────────────────────────
//  Campus order-ahead pickup — client helpers.
//  createPickupOrder → server route (server-generated token/code).
//  getTracking       → token-gated SECURITY DEFINER RPC (public fields only).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabase";
import { pushSupported } from "./push";
import type { OrderItem } from "./orders";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export interface Tracking {
  status: string;
  ready_at: string | null;
  picked_up_at: string | null;
  eta_minutes: number | null;
  pickup_code: string | null;
  created_at: string;
  /** Target pickup clock: student-chosen, or staff-stamped at ASAP accept
   *  (one time contract). Absent until pickup-time.sql runs. */
  requested_pickup_at?: string | null;
  /** Order total — powers "Pay at the truck · $X". Absent pre-migration. */
  total?: number | null;
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
  /** Customer name + email — required for campus pickup (no-show accountability);
   *  the server re-validates and stores them. */
  name?: string;
  email?: string;
  note?: string;
  /** ISO timestamp of the student's chosen pickup time; omit for ASAP. */
  pickup_at?: string | null;
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

// base64url (VAPID public key) → Uint8Array for applicationServerKey.
function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type PickupPushState = "unsupported" | "denied" | "on" | "error";

/** Diner opt-in: subscribe THIS browser to a push for when the order goes
 *  READY. The subscription is verified + stored server-side against the
 *  tracking_token (no raw anon insert — see /api/pickup/subscribe). */
export async function subscribePickupPush(orderId: string, token: string): Promise<PickupPushState> {
  if (!pushSupported() || !VAPID_PUBLIC) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "error";
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
    }
    const res = await fetch("/api/pickup/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, token, subscription: sub.toJSON() }),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok && j?.ok ? "on" : "error";
  } catch (e) {
    console.error("subscribePickupPush", e);
    return "error";
  }
}

/** Distinguishes a transient fetch failure from a genuinely-missing order.
 *  The tracker polls this every 8s on campus wifi: a dropped request must NOT
 *  read the same as a real 404, or one blip flips a live order to "not found"
 *  and kills the poll (design review, order-tracker CRITICAL). */
export type TrackingResult =
  | { ok: true; track: Tracking }
  | { ok: false; reason: "notfound" }
  | { ok: false; reason: "error" };

export async function getTracking(orderId: string, token: string): Promise<TrackingResult> {
  const { data, error } = await supabase.rpc("get_order_tracking", { p_order_id: orderId, p_token: token });
  if (error) {
    console.error("getTracking", error.message);
    return { ok: false, reason: "error" }; // transient — caller keeps last-good + keeps polling
  }
  const row = (Array.isArray(data) ? data[0] : data) ?? null;
  return row ? { ok: true, track: row } : { ok: false, reason: "notfound" };
}
