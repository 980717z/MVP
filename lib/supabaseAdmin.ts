import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY. Bypasses RLS, so it must never be imported
// into a client component. Used by API routes that need to read data the
// anon/customer can't (e.g. an order row + the shop's private printer config).
//
// Returns null if the key isn't set, so callers can degrade gracefully instead
// of throwing at import time.
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
