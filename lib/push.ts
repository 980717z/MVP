// Client-side Web Push helpers. Subscribes the browser to push and stores the
// subscription in Supabase (RLS-scoped to the logged-in merchant). The service
// worker (public/sw.js) receives the pushes and shows the OS notification even
// when the app is closed.
import { supabase } from "./supabase";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState = "unsupported" | "denied" | "off" | "on";

// Web Push is only available with a service worker + PushManager, and on iOS
// only inside an installed PWA (standalone). Safari also needs Notification.
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// base64url (VAPID public key) → Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported() || !VAPID_PUBLIC) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

// Ask permission → subscribe → persist to Supabase for this tenant. Returns the
// resulting state so the UI can reflect denied/unsupported without throwing.
export async function enablePush(slug: string): Promise<PushState> {
  if (!pushSupported() || !VAPID_PUBLIC) return "unsupported";

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const keys = json.keys ?? {};
  // Upsert by endpoint: one row per browser; switching shops updates tenant_slug.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      tenant_slug: slug,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh ?? "",
      auth: keys.auth ?? "",
      ua: navigator.userAgent.slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
  return "on";
}

// Unsubscribe locally and remove the row so we stop pushing to this device.
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* best-effort */
  }
  return "off";
}
