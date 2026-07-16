"use client";

// ─────────────────────────────────────────────────────────────────────────
//  /admin — platform-owner traction dashboard (internal, single-user).
//  Server-gated: this page only renders what /api/admin/stats returns, and
//  that route verifies the caller's JWT email against ADMIN_EMAILS. Nothing
//  sensitive ships in this bundle. English-only by design (ratified
//  2026-07-16, DESIGN-PLATFORM decisions log — internal tools skip i18n).
//
//  v1.1 per /plan-design-review 2026-07-16 (approved mockup:
//  ~/.gstack/projects/980717z-MVP/designs/admin-cold-start-20260716/variant-A.png):
//   1A  Orders (7d) is the single hero number, delta vs prior 7d.
//   2A  Cold-start setup hero + ghost funnel; skeleton loading; errors keep
//       last-good data with inline Retry.
//   5-2A tabular-nums on all figures; nothing below the 12px meta tier.
//   6-1A daily bars are tap/keyboard-selectable → fixed caption (no hover-only).
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { BentoMark } from "@/components/BentoMark";

type Funnel = { campus: number; directory: number; vendorTaps: number; menuViews: number; menuSessions: number; ordersPlaced: number };
type Stats = {
  ok: true;
  generatedAt: string;
  eventsTableExists?: boolean;
  kpis: { orders7: number; orders30: number; gmvOnline7: number; gmvOnline30: number; gmvDine7: number; gmvDine30: number; tenants: number; listedVendors: number };
  funnel7: Funnel;
  funnel30: Funnel;
  daily: { date: string; orders: number; dineSessions: number; menuViews: number }[];
  vendors: { slug: string; name: string; orders7: number; orders30: number; dine30: number; menuViews7: number; lastOrderAt: string | null; listed: boolean }[];
};

const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "login" | "forbidden" | "unconfigured" | "error" | "ok">("loading");
  const [stats, setStats] = useState<Stats | null>(null); // last-good — kept on refresh errors
  const [win, setWin] = useState<"7" | "30">("7");
  const [selDay, setSelDay] = useState<number | null>(null); // selected daily bar (6-1A)
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const jwt = sess.session?.access_token;
    if (!jwt) { setState("login"); return; }
    const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${jwt}` } }).catch(() => null);
    if (!res) { setState("error"); return; } // keeps last-good stats rendered
    if (res.status === 401) { setState("login"); return; }
    if (res.status === 403) { setState("forbidden"); return; }
    if (res.status === 503) { setState("unconfigured"); return; }
    const d = await res.json().catch(() => null);
    if (!d?.ok) { setState("error"); return; }
    setStats(d as Stats);
    setState("ok");
  }, []);
  useEffect(() => { load(); }, [load]);

  const funnel = win === "7" ? stats?.funnel7 : stats?.funnel30;
  const daily = stats?.daily ?? [];
  const maxDaily = useMemo(() => Math.max(1, ...daily.map((d) => d.orders + d.dineSessions)), [daily]);
  // Hero delta: last 7 calendar days vs the 7 before, from the daily series.
  const last7 = daily.slice(-7).reduce((s, d) => s + d.orders, 0);
  const prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.orders, 0);
  const sel = selDay != null ? daily[selDay] : daily[daily.length - 1];

  // Cold start = funnel has never seen a customer event (2A).
  const funnelTotal30 = stats ? stats.funnel30.campus + stats.funnel30.directory + stats.funnel30.menuViews + stats.funnel30.ordersPlaced : 0;
  const coldStart = !!stats && (stats.eventsTableExists === false || funnelTotal30 === 0);
  const setupSteps: { label: string; done: boolean }[] = stats
    ? [
        { label: "Events table created", done: stats.eventsTableExists !== false },
        { label: "Admin access configured", done: true }, // you're reading this page → the gate passed
        { label: "Share the campus directory to start the funnel", done: funnelTotal30 > 0 },
      ]
    : [];
  const setupDone = setupSteps.filter((s) => s.done).length;

  const copyDirectoryLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/eat`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the link is visible in the hint text */ }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-[#FBFAF8] px-6 py-8 text-ink lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BentoMark className="h-7 w-7" />
            <div>
              <h1 className="text-xl font-bold">BentoOS Admin</h1>
              <p className="text-xs text-ink-faint">Traction across tenants + campus</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <button onClick={load} className={`rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-slate-50 ${focusRing}`}>
                ↻ Refresh
              </button>
            )}
            <Link href="/" className={`text-sm text-ink-faint hover:text-ink ${focusRing}`}>← bentoos.io</Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );

  // Skeleton mirrors the real layout (DESIGN-PLATFORM §States: no spinner-on-blank).
  if (state === "loading" && !stats)
    return (
      <Shell>
        <div className="animate-pulse space-y-6" aria-label="Loading dashboard">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card col-span-2 h-28 bg-slate-50 lg:col-span-1" />
            <div className="card h-28 bg-slate-50" />
            <div className="card h-28 bg-slate-50" />
            <div className="card hidden h-28 bg-slate-50 lg:block" />
          </div>
          <div className="card space-y-4 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-3 rounded-full bg-slate-100" style={{ width: `${90 - i * 15}%` }} />)}</div>
          <div className="card h-40 bg-slate-50" />
        </div>
      </Shell>
    );
  if (state === "login")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">Sign in with the platform-owner account first. <Link className={`font-semibold text-brand hover:underline ${focusRing}`} href="/login">Log in →</Link></div></Shell>;
  if (state === "forbidden")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">This account isn’t on the admin allowlist.</div></Shell>;
  if (state === "unconfigured")
    return <Shell><div className="card p-10 text-center text-sm text-ink-soft">Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">ADMIN_EMAILS</code> in Vercel env (comma-separated) to enable this dashboard.</div></Shell>;
  if (state === "error" && !stats)
    return (
      <Shell>
        <div className="card p-10 text-center text-sm text-ink-soft">
          Couldn’t load stats.
          <button onClick={load} className={`ml-3 rounded-lg border border-brand bg-brand-wash px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-wash/70 ${focusRing}`}>Retry</button>
        </div>
      </Shell>
    );
  if (!stats) return <Shell><div className="card p-10 text-center text-sm text-ink-faint">…</div></Shell>;

  const k = stats.kpis;
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
      {/* Transient refresh failure: keep last-good data on screen, offer retry inline. */}
      {state === "error" && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span>Refresh failed — showing the last loaded numbers.</span>
          <button onClick={load} className={`rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 ${focusRing}`}>Retry</button>
        </div>
      )}

      {/* Cold-start setup hero (2A) — disappears once the funnel sees its first event. */}
      {coldStart && (
        <div className="mb-6 rounded-2xl border border-brand/25 bg-brand-wash/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-brand-ink">{setupDone} of {setupSteps.length} live</div>
              <div className="mt-0.5 text-xs text-ink-soft">Finish setup to start the campus funnel.</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={copyDirectoryLink} className={`btn-primary min-h-10 px-4 text-sm ${focusRing}`}>
                {copied ? "✓ Copied" : "Copy directory link"}
              </button>
              <span className="text-xs text-ink-faint">/eat — post it, print it, send it to vendors</span>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {setupSteps.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden className={`grid h-5 w-5 flex-none place-items-center rounded-full text-xs font-bold ${s.done ? "bg-brand text-white" : "border border-slate-300 bg-white text-transparent"}`}>✓</span>
                <span className={s.done ? "text-ink-soft" : "font-medium text-ink"}>{s.label}</span>
              </li>
            ))}
          </ul>
          {stats.eventsTableExists === false && (
            <p className="mt-3 text-xs text-ink-soft">Run <code className="rounded bg-white px-1.5 py-0.5">supabase/events.sql</code> in the SQL editor to create the events table.</p>
          )}
        </div>
      )}

      {/* KPI row (1A): Orders is the hero — one number wins the first glance. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card col-span-2 p-4 lg:col-span-1">
          <div className="text-xs text-ink-faint">Orders — last {win} days</div>
          <div className="mt-1 text-4xl font-extrabold tabular-nums text-ink">{win === "7" ? k.orders7 : k.orders30}</div>
          {win === "7" && (
            <div className="mt-1 text-xs font-semibold tabular-nums text-ink-soft">
              {prev7 > 0 ? (
                <span className={last7 >= prev7 ? "text-brand-ink" : "text-amber-700"}>
                  {last7 >= prev7 ? "▲" : "▼"} {Math.abs(Math.round(((last7 - prev7) / prev7) * 100))}% vs prior 7d
                </span>
              ) : (
                <span className="text-ink-faint">no prior-week baseline yet</span>
              )}
            </div>
          )}
        </div>
        {[
          { label: "Online GMV (togo·delivery·pickup)", value: money(win === "7" ? k.gmvOnline7 : k.gmvOnline30) },
          { label: "Dine-in revenue (checkouts)", value: money(win === "7" ? k.gmvDine7 : k.gmvDine30) },
          { label: "Tenants · listed on campus", value: `${k.tenants} · ${k.listedVendors}` },
        ].map((x) => (
          <div key={x.label} className="card p-4">
            <div className="text-xs text-ink-faint">{x.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{x.value}</div>
          </div>
        ))}
      </div>

      {/* window toggle */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Funnel</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["7", "30"] as const).map((w) => (
            <button key={w} onClick={() => setWin(w)} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${focusRing} ${win === w ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}>
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* funnel — ghost bars until the first event arrives (2A) */}
      <div className="card space-y-3 p-5">
        {FUNNEL_ROWS.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink-soft">{r.label}</span>
              <span className="font-semibold tabular-nums text-ink">
                {coldStart ? "—" : r.value}
                {!coldStart && r.hint ? <span className="ml-1.5 font-normal text-ink-faint">({r.hint})</span> : null}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              {coldStart ? (
                <div className="h-full w-2/5 animate-pulse rounded-full bg-slate-200" />
              ) : (
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / maxFunnel) * 100)}%` }} />
              )}
            </div>
          </div>
        ))}
        <p className="pt-1 text-xs text-ink-faint">
          {coldStart
            ? stats.eventsTableExists === false
              ? "Collecting starts once the events table is live."
              : "Collecting — first numbers appear with the first visit."
            : "Views come from the events beacon; orders/GMV come from the database and include full history for the window."}
        </p>
      </div>

      {/* daily series — tap/keyboard-select a bar; caption replaces hover tooltips (6-1A) */}
      <h2 className="mt-6 mb-3 text-sm font-bold text-ink">Daily orders — last 30 days</h2>
      <div className="card p-5">
        <div className="flex h-28 items-end gap-[3px]">
          {daily.map((d, i) => {
            const total = d.orders + d.dineSessions;
            const active = (selDay ?? daily.length - 1) === i;
            return (
              <button
                key={d.date}
                onClick={() => setSelDay(i)}
                aria-label={`${d.date}: ${d.orders} online, ${d.dineSessions} dine-in, ${d.menuViews} menu views`}
                aria-pressed={active}
                className={`group flex h-full flex-1 items-end rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${active ? "bg-brand-wash/60" : "hover:bg-slate-50"}`}
              >
                <span className={`w-full rounded-t ${active ? "bg-brand" : "bg-brand/50"}`} style={{ height: `${(total / maxDaily) * 100}%`, minHeight: total > 0 ? 3 : 1 }} />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-ink-faint">
          <span>{daily[0]?.date}</span>
          <span>{daily[daily.length - 1]?.date}</span>
        </div>
        {sel && (
          <div className="mt-3 border-t border-slate-100 pt-3 text-sm tabular-nums text-ink-soft" aria-live="polite">
            <span className="font-semibold text-ink">{sel.date}</span> · {sel.orders} online · {sel.dineSessions} dine-in · {sel.menuViews} menu views
          </div>
        )}
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
                <td className="px-4 py-3 font-semibold tabular-nums text-ink">{v.orders7}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">{v.orders30}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">{v.dine30}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">{v.menuViews7}</td>
                <td className="px-4 py-3 text-xs tabular-nums text-ink-faint">{v.lastOrderAt ? v.lastOrderAt.slice(0, 16).replace("T", " ") : "—"}</td>
                <td className="px-4 py-3">{v.listed ? <span className="pill bg-brand-wash text-brand-ink">listed</span> : <span className="text-xs text-ink-faint">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">Generated {stats.generatedAt.slice(0, 19).replace("T", " ")} UTC · internal — do not share</p>
    </Shell>
  );
}
