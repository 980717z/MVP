"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface AuthState {
  session: Session | null;
  loading: boolean;
  email: string | null;
  /** true once we've confirmed this session's email is in admin_emails (public.is_admin()).
   *  Starts false and flips after an async RPC round-trip — callers that gate
   *  destructive UI on `!isAdmin` should also wait on `loading` to avoid a
   *  flash of the locked state before the check resolves. */
  isAdmin: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let claimed = false;
    // Link any pending email-invites to this account, once per signed-in session.
    const claim = (s: Session | null) => {
      if (s && !claimed) {
        claimed = true;
        void supabase.rpc("claim_invites").then(() => {}, () => {});
      }
    };
    // Awaited (not fire-and-forget) so `loading` only clears once isAdmin is
    // actually settled — callers gating destructive UI on `!isAdmin` rely on
    // `loading` covering this, not just the initial getSession() round-trip.
    const checkAdmin = async (s: Session | null) => {
      if (!s) { setIsAdmin(false); return; }
      try {
        const { data } = await supabase.rpc("is_admin");
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
    };
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      claim(data.session);
      await checkAdmin(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      claim(s);
      void checkAdmin(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading, email: session?.user?.email ?? null, isAdmin };
}

export async function signOut() {
  await supabase.auth.signOut();
}
