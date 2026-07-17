"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth, signOut } from "@/lib/useAuth";
import { useLang, type Dict } from "@/app/i18n";
import { BentoMark } from "@/components/BentoMark";
import { moneyExact } from "@/lib/format";

interface DailyRow {
  tenant_slug: string;
  tenant_name: string | null;
  business_day: string;
  order_count: number;
  gross_sales: number;
}

// 扫码菜单转化漏斗的固定顺序 — 别的 event 值（若以后加了）不在这个列表里就不会显示。
const FUNNEL_STEPS: { event: string; label: Dict }[] = [
  { event: "menu_view", label: { zh: "浏览菜单", en: "Viewed menu", fr: "Menu consulté" } },
  { event: "menu_item_added", label: { zh: "加入购物车", en: "Added to cart", fr: "Ajouté au panier" } },
  { event: "checkout_opened", label: { zh: "打开结账", en: "Opened checkout", fr: "Commande ouverte" } },
  { event: "order_placed", label: { zh: "下单成功", en: "Order placed", fr: "Commande passée" } },
];

type RangeKey = "today" | "7" | "30" | "all";

const RANGES: { k: RangeKey; label: Dict }[] = [
  { k: "today", label: { zh: "今日", en: "Today", fr: "Aujourd'hui" } },
  { k: "7", label: { zh: "近 7 天", en: "7 days", fr: "7 jours" } },
  { k: "30", label: { zh: "近 30 天", en: "30 days", fr: "30 jours" } },
  { k: "all", label: { zh: "全部", en: "All time", fr: "Tout" } },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export default function PlatformAdmin() {
  const router = useRouter();
  const { t } = useLang();
  const { session, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("30");
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [funnelCounts, setFunnelCounts] = useState<Record<string, number>>({});

  // gate: not logged in → login; logged in but not a platform admin → blocked
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .then(({ data }) => {
        setIsAdmin((data?.length ?? 0) > 0);
        setChecking(false);
      });
  }, [session, loading, router]);

  const today = todayStr();
  const from = rangeKey === "today" ? today : rangeKey === "7" ? shiftDate(today, -6) : rangeKey === "30" ? shiftDate(today, -29) : "2000-01-01";

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setDataLoading(true);
    const { data, error } = await supabase
      .from("admin_daily_sales")
      .select("*")
      .gte("business_day", from)
      .order("business_day", { ascending: false });
    if (error) console.error("admin_daily_sales", error);
    setRows((data ?? []) as DailyRow[]);

    // funnel: count DISTINCT sessions per step, not raw event rows (one visit
    // can fire menu_item_added multiple times — the funnel cares how many
    // sessions reached each step, not how many items they added).
    const { data: events, error: evErr } = await supabase
      .from("menu_events")
      .select("event, session_id")
      .gte("created_at", `${from}T00:00:00Z`);
    if (evErr) console.error("menu_events", evErr);
    const byEvent = new Map<string, Set<string>>();
    for (const e of events ?? []) {
      const set = byEvent.get(e.event) ?? new Set<string>();
      set.add(e.session_id);
      byEvent.set(e.event, set);
    }
    setFunnelCounts(Object.fromEntries([...byEvent.entries()].map(([k, v]) => [k, v.size])));

    setDataLoading(false);
  }, [isAdmin, from]);
  useEffect(() => { load(); }, [load]);

  // per-tenant totals across the selected range, revenue desc
  const byTenant = useMemo(() => {
    const m = new Map<string, { slug: string; name: string; orders: number; sales: number }>();
    for (const r of rows) {
      const cur = m.get(r.tenant_slug) ?? { slug: r.tenant_slug, name: r.tenant_name || r.tenant_slug, orders: 0, sales: 0 };
      cur.orders += r.order_count;
      cur.sales += Number(r.gross_sales) || 0;
      m.set(r.tenant_slug, cur);
    }
    return [...m.values()].sort((a, b) => b.sales - a.sales);
  }, [rows]);

  const totalSales = byTenant.reduce((s, tn) => s + tn.sales, 0);
  const totalOrders = byTenant.reduce((s, tn) => s + tn.orders, 0);

  const exportCsv = () => {
    const header = ["店铺", "日期", "订单数", "营业额"];
    const body = [...rows]
      .sort((a, b) => a.tenant_slug.localeCompare(b.tenant_slug) || a.business_day.localeCompare(b.business_day))
      .map((r) => [r.tenant_name || r.tenant_slug, r.business_day.slice(0, 10), String(r.order_count), String(r.gross_sales)]);
    const csv = ["﻿" + header.map(escapeCsv).join(","), ...body.map((row) => row.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `平台经营看板_${from}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || checking) {
    return <main className="grid min-h-screen place-items-center text-ink-faint">{t({ zh: "载入中…", en: "Loading…", fr: "Chargement…" })}</main>;
  }

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-lg font-semibold text-ink">{t({ zh: "无权限访问", en: "Not authorized", fr: "Accès refusé" })}</p>
          <p className="mt-1 text-sm text-ink-faint">{t({ zh: "此页面仅限平台管理员", en: "This page is for platform admins only", fr: "Réservé aux administrateurs de la plateforme" })}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BentoMark className="h-6 w-6" />
          <h1 className="text-2xl font-bold text-ink">{t({ zh: "平台经营看板", en: "Platform dashboard", fr: "Tableau de bord plateforme" })}</h1>
        </div>
        <button onClick={() => signOut().then(() => router.replace("/login"))} className="text-sm text-ink-faint hover:text-ink">
          {t({ zh: "退出", en: "Sign out", fr: "Se déconnecter" })}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.k} onClick={() => setRangeKey(r.k)}
            className={`min-h-9 rounded-full px-3.5 text-sm font-medium transition ${rangeKey === r.k ? "bg-brand text-white" : "border border-slate-200 text-ink-soft hover:bg-slate-50"}`}>
            {t(r.label)}
          </button>
        ))}
        <button onClick={exportCsv} disabled={dataLoading || rows.length === 0}
          className="ml-auto min-h-9 rounded-full border border-slate-200 px-3.5 text-sm font-medium text-ink-soft transition hover:bg-slate-50 disabled:opacity-40">
          ⬇️ {t({ zh: "导出 CSV", en: "Export CSV", fr: "Exporter CSV" })}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label={t({ zh: "全平台营业额", en: "Platform revenue", fr: "Revenu plateforme" })} value={moneyExact(totalSales)} big />
        <Kpi label={t({ zh: "订单数", en: "Orders", fr: "Commandes" })} value={String(totalOrders)} />
        <Kpi label={t({ zh: "活跃商家数", en: "Active merchants", fr: "Marchands actifs" })} value={String(byTenant.length)} />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">{t({ zh: "按商家汇总", en: "By merchant", fr: "Par marchand" })}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-ink-faint">
                <th className="py-2 pr-2 font-medium">{t({ zh: "店铺", en: "Shop", fr: "Boutique" })}</th>
                <th className="py-2 px-2 text-right font-medium">{t({ zh: "订单数", en: "Orders", fr: "Commandes" })}</th>
                <th className="py-2 pl-2 text-right font-medium">{t({ zh: "营业额", en: "Revenue", fr: "Revenu" })}</th>
              </tr>
            </thead>
            <tbody>
              {byTenant.map((tn) => (
                <tr key={tn.slug} className="border-b border-slate-50">
                  <td className="py-2 pr-2 font-medium text-ink">{tn.name} <span className="text-xs text-ink-faint">({tn.slug})</span></td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink-soft">{tn.orders}</td>
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">{moneyExact(tn.sales)}</td>
                </tr>
              ))}
              {byTenant.length === 0 && (
                <tr><td colSpan={3} className="py-10 text-center text-sm text-ink-faint">
                  {dataLoading ? t({ zh: "加载中…", en: "Loading…", fr: "Chargement…" }) : t({ zh: "该区间还没有数据", en: "No data in this range yet", fr: "Aucune donnée sur cette période" })}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">{t({ zh: "扫码菜单转化漏斗", en: "QR-menu conversion funnel", fr: "Entonnoir de conversion du menu QR" })}</h2>
        <div className="space-y-2.5">
          {FUNNEL_STEPS.map((step, i) => {
            const n = funnelCounts[step.event] ?? 0;
            const prev = i > 0 ? funnelCounts[FUNNEL_STEPS[i - 1].event] ?? 0 : n;
            const pct = i === 0 ? 100 : prev > 0 ? Math.round((n / prev) * 100) : 0;
            const ofFirst = funnelCounts[FUNNEL_STEPS[0].event] ?? 0;
            const width = ofFirst > 0 ? Math.round((n / ofFirst) * 100) : 0;
            return (
              <div key={step.event}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{t(step.label)}</span>
                  <span className="tabular-nums text-ink-soft">
                    {n} {i > 0 && <span className="text-xs text-ink-faint">({pct}% {t({ zh: "承接自上一步", en: "of previous step", fr: "de l'étape précédente" })})</span>}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
          {(funnelCounts[FUNNEL_STEPS[0].event] ?? 0) === 0 && (
            <p className="py-4 text-center text-sm text-ink-faint">{t({ zh: "该区间还没有埋点数据", en: "No funnel data in this range yet", fr: "Aucune donnée d'entonnoir sur cette période" })}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${big ? "text-3xl" : "text-xl"} text-ink`}>{value}</div>
    </div>
  );
}
