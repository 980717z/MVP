"use client";

// ─────────────────────────────────────────────────────────────────────────
//  /admin — platform-owner traction dashboard (internal, single-user).
//  Server-gated: this page only renders what /api/admin/stats returns, and
//  that route verifies the caller's JWT email against ADMIN_EMAILS. Nothing
//  sensitive ships in this bundle. English-only by design (internal tool —
//  the EN/FR/中 rule applies to merchant/customer surfaces).
//  Style: DESIGN-PLATFORM (emerald / app-grey).
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BentoMark } from "@/components/BentoMark";

type Funnel = { campus: number; directory: number; vendorTaps: number; menuViews: number; menuSessions: number; ordersPlaced: number };
type Stats = {
  ok: true;
  generatedAt: string;
  kpis: { orders7: number; orders30: number; gmvOnline7: number; gmvOnline30: number; gmvDine7: number; gmvDine30: number; tenants: number; listedVendors: number };
  funnel7: Funnel;
  funnel30: Funnel;
  daily: { date: string; orders: number; dineSessions: number; menuViews: number }[];
  vendors: { slug: string; name: string; orders7: number; orders30: number; dine30: number; menuViews7: number; lastOrderAt: string | null; listed: boolean }[];
};

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "login" | "forbidden" | "unconfigured" | "error" | "ok">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [win, setWin] = useState<"7" | "30">("7");

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) { setState("login"); return; }
      const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${jwt}` } }).catch(() => null);
      if (!res) { setState("error"); return; }
      if (res.status === 401) { setState("login"); return; }
      if (res.status === 403) { setState("forbidden"); return; }
      if (res.status === 503) { setState("unconfigured"); return; }
      const d = await res.json().catch(() => null);
      if (!d?.ok) { setState("error"); return; }
      setStats(d as Stats);
      setState("ok");
    })();
  }, []);

  const funnel = win === "7" ? stats?.funnel7 : stats?.funnel30;
  const maxDaily = useMemo(() => Math.max(1, ...(stats?.daily ?? []).map((d) => d.orders + d.dineSessions)), [stats]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-[#FBFAF8] px-6 py-8 text-ink lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BentoMark className="h-7 w-7" />
            <div>
              <h1 className="text-xl font-bold">BentoOS Admin</h1>
              <p className="text-xs text-ink-faint">Traction across tenants + campus</p>
            </div>
          </div>
          <Link href="/" className="text-sm text-ink-faint hover:text-ink">← bentoos.io</Link>
        </header>
        {children}
      </div>
    </main>
  );

  if (state === "loading") return <Shell><div className="card p-10 text-center text-sm text-ink-faint">Loading…</div></Shell>;
  if (state === "login")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">Sign in with the platform-owner account first. <Link className="font-semibold text-brand hover:underline" href="/login">Log in →</Link></div></Shell>;
  if (state === "forbidden")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">This account isn’t on the admin allowlist.</div></Shell>;
  if (state === "unconfigured")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">ADMIN_EMAILS</code> in Vercel env (comma-separated) to enable this dashboard.</div></Shell>;
  if (state === "error" || !stats)
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">Couldn’t load stats — try refreshing.</div></Shell>;

  const k = stats.kpis;
  const KPIS: { label: string; v7: string; v30: string }[] = [
    { label: "Orders", v7: String(k.orders7), v30: String(k.orders30) },
    { label: "Online GMV (togo·delivery·pickup)", v7: money(k.gmvOnline7), v30: money(k.gmvOnline30) },
    { label: "Dine-in revenue (checkouts)", v7: money(k.gmvDine7), v30: money(k.gmvDine30) },
    { label: "Tenants · listed on campus", v7: `${k.tenants} · ${k.listedVendors}`, v30: `${k.tenants} · ${k.listedVendors}` },
  ];
  const FUNNEL_ROWS: { label: string; value: number; hint?: string }[] = funnel
    ? [
        { label: "Campus page views", value: funnel.campus },
        { label: "Directory views (/eat)", value: funnel.directory },
        { label: "Vendor card taps", value: funnel.vendorTaps },
        { label: "Menu views", value: funnel.menuViews, hint: `${funnel.menuSessions} unique sessions` },
        { label: "Orders placed", value: funnel.ordersPlaced },
      ]
    : [];
  const maxFunnel = Math.max(1, ...FUNNEL_ROWS.map((r) => r.value));

  return (
    <Shell>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((x) => (
          <div key={x.label} className="card p-4">
            <div className="text-xs text-ink-faint">{x.label}</div>
            <div className="mt-1 text-2xl font-bold text-ink">{win === "7" ? x.v7 : x.v30}</div>
          </div>
        ))}
      </div>

      {/* window toggle */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Funnel</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["7", "30"] as const).map((w) => (
            <button key={w} onClick={() => setWin(w)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${win === w ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}>
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* funnel — customer traffic only (embed/staff excluded server-side) */}
      <div className="card space-y-3 p-5">
        {FUNNEL_ROWS.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink-soft">{r.label}</span>
              <span className="font-semibold text-ink">{r.value}{r.hint ? <span className="ml-1.5 font-normal text-ink-faint">({r.hint})</span> : null}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / maxFunnel) * 100)}%` }} />
            </div>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-ink-faint">Views come from the events beacon (starts counting from deploy); orders/GMV come from the database and include full history for the window.</p>
      </div>

      {/* daily series */}
      <h2 className="mt-6 mb-3 text-sm font-bold text-ink">Daily orders — last 30 days</h2>
      <div className="card p-5">
        <div className="flex h-28 items-end gap-[3px]">
          {stats.daily.map((d) => {
            const total = d.orders + d.dineSessions;
            return (
              <div key={d.date} className="group relative flex-1">
                <div className="w-full rounded-t bg-brand/80 transition group-hover:bg-brand" style={{ height: `${(total / maxDaily) * 100}%`, minHeight: total > 0 ? 3 : 1 }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-[10px] text-white group-hover:block">
                  {d.date}: {d.orders} online · {d.dineSessions} dine-in · {d.menuViews} menu views
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-ink-faint">
          <span>{stats.daily[0]?.date}</span>
          <span>{stats.daily[stats.daily.length - 1]?.date}</span>
        </div>
      </div>

      {/* per-vendor table */}
      <h2 className="mt-6 mb-3 text-sm font-bold text-ink">Vendors</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Orders 7d</th>
              <th className="px-4 py-3 font-medium">Orders 30d</th>
              <th className="px-4 py-3 font-medium">Dine-in 30d</th>
              <th className="px-4 py-3 font-medium">Menu views 7d</th>
              <th className="px-4 py-3 font-medium">Last order</th>
              <th className="px-4 py-3 font-medium">Campus</th>
            </tr>
          </thead>
          <tbody>
            {stats.vendors.map((v) => (
              <tr key={v.slug} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{v.name}</div>
                  <div className="text-xs text-ink-faint">{v.slug}</div>
                </td>
                <td className="px-4 py-3 font-semibold text-ink">{v.orders7}</td>
                <td className="px-4 py-3 text-ink-soft">{v.orders30}</td>
                <td className="px-4 py-3 text-ink-soft">{v.dine30}</td>
                <td className="px-4 py-3 text-ink-soft">{v.menuViews7}</td>
                <td className="px-4 py-3 text-xs text-ink-faint">{v.lastOrderAt ? v.lastOrderAt.slice(0, 16).replace("T", " ") : "—"}</td>
                <td className="px-4 py-3">{v.listed ? <span className="pill bg-brand-wash text-brand-ink">listed</span> : <span className="text-xs text-ink-faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-faint">Generated {stats.generatedAt.slice(0, 19).replace("T", " ")} UTC · internal — do not share</p>
    </Shell>
  );
}
