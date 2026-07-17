"use client";

import { supabase } from "./supabase";

const SESSION_KEY = "bento_menu_session";

/** One id per browser tab session, so funnel steps can be grouped per visit
 *  without any login. Regenerates per tab/session — good enough for a funnel
 *  (we care about "how many sessions reached step N", not cross-device identity). */
function sessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** 扫码菜单转化漏斗: menu_view → menu_item_added → checkout_opened → order_placed.
 *  Fire-and-forget insert into menu_events (self-hosted, no third-party key
 *  needed) — never blocks or throws into the diner's flow if it fails. */
export function trackFunnel(slug: string, event: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined" || !slug) return;
  supabase.from("menu_events").insert({ tenant_slug: slug, session_id: sessionId(), event, meta: meta ?? {} }).then(
    () => {},
    () => {},
  );
}
