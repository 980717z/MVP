"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface AuthState {
  session: Session | null;
  loading: boolean;
  email: string | null;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let claimed = false;
    // Link any pending email-invites to this account, once per signed-in session.
    const claim = (s: Session | null) => {
      if (s && !claimed) {
        claimed = true;
        void supabase.rpc("claim_invites").then(() => {}, () => {});
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      claim(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      claim(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading, email: session?.user?.email ?? null };
}

export async function signOut() {
  await supabase.auth.signOut();
}
