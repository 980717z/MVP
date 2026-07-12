"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { getTrackPayments } from "@/lib/store";
import { listSessionsInRange } from "@/lib/tableSessions";
import { aggregateSales, torontoToday, shiftDate, METHODS, type SessionRow, type Method } from "@/lib/salesStats";
import { money } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

type RangeKey = "today" | "7" | "30" | "custom";

const RANGES: { k: RangeKey; label: Dict }[] = [
  { k: "today", label: { zh: "今日", en: "Today", fr: "Aujourd'hui" } },
  { k: "7", label: { zh: "近 7 天", en: "7 days", fr: "7 jours" } },
  { k: "30", label: { zh: "近 30 天", en: "30 days", fr: "30 jours" } },
  { k: "custom", label: { zh: "自定义", en: "Custom", fr: "Personnalisé" } },
];

const METHOD_META: Record<Method, { label: Dict; dot: string }> = {
  cash: { label: { zh: "现金", en: "Cash", fr: "Comptant" }, dot: "#D97706" },
  emt: { label: { zh: "EMT", en: "EMT", fr: "Virement" }, dot: "#0891B2" },
  card: { label: { zh: "刷卡", en: "Card", fr: "Carte" }, dot: "#7C3AED" },
  other: { label: { zh: "其他", en: "Other", fr: "Autre" }, dot: "#64748B" },
};

const methodLabelKey = (m: string): Method => (m === "cash" || m === "card" || m === "emt" ? m : "other");

export default function SalesStatsPortal({ slug }: { slug: string; mod: ModuleDef }) {
  const { t, lang } = useLang();
  const today = torontoToday(new Date());

  const [rangeKey, setRangeKey] = useState<RangeKey>("today");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [togoCount, setTogoCount] = useState<number | null>(null);
  const [filter, setFilter] = useState<Method | "all">("all");
  const [loading, setLoading] = useState(true);
  const [trackPay, setTrackPay] = useState(true); // off → hide method breakdown, everything as sales
  useEffect(() => { getTrackPayments(slug).then(setTrackPay).catch(() => {}); }, [slug]);

  // range preset → concrete [from, to] business dates
  const [f, to2] = useMemo<[string, string]>(() => {
    if (rangeKey === "today") return [today, today];
    if (rangeKey === "7") return [shiftDate(today, -6), today];
    if (rangeKey === "30") return [shiftDate(today, -29), today];
    return [from <= to ? from : to, from <= to ? to : from]; // custom, normalized
  }, [rangeKey, today, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    const sessions = await listSessionsInRange(slug, f, to2);
    setRows(sessions);
    // togo/delivery are settled offline — show a count only (decision: dine-in core now)
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("tenant_slug", slug)
      .in("order_type", ["togo", "delivery"])
      .gte("created_at", f)
      .lt("created_at", shiftDate(to2, 1));
    setTogoCount(count ?? 0);
    setLoading(false);
  }, [slug, f, to2]);
  useEffect(() => { load(); }, [load]);

  const agg = useMemo(() => aggregateSales(rows), [rows]);

  // per-row display: sales(pre-tax), tax, tip, collected, method label(s)
  const txnRows = useMemo(() => {
    const list = rows.map((r) => {
      const methodsInRow: Method[] = r.payment_method === "split" && Array.isArray(r.splits)
        ? [...new Set(r.splits.map((s) => methodLabelKey(String(s.method))))]
        : [methodLabelKey(r.payment_method)];
      return {
        at: r.closed_at,
        split: r.payment_method === "split",
        methods: methodsInRow,
        sales: Number(r.subtotal) || 0,
        tax: (Number(r.gst) || 0) + (Number(r.pst) || 0),
        tip: Number(r.tip) || 0,
        collected: (Number(r.total) || 0) + (Number(r.tip) || 0),
      };
    });
    const filtered = !trackPay || filter === "all" ? list : list.filter((x) => x.methods.includes(filter));
    return filtered.sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [rows, filter, trackPay]);

  const bi = (d: Dict) => t(d);
  const fmtTime = (iso: string) => new Date(iso).toLocaleString(lang === "zh" ? "zh-CN" : lang === "fr" ? "fr-CA" : "en-CA", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const headline = rangeKey === "today" ? t({ zh: "今日营收（税前）", en: "Today's revenue (pre-tax)", fr: "Revenu du jour (avant taxes)" }) : t({ zh: "营业额（税前）", en: "Revenue (pre-tax)", fr: "Chiffre d'affaires (avant taxes)" });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← {t({ zh: "总览", en: "Overview", fr: "Aperçu" })}</Link>
      <div className="mt-3 mb-5">
        <h1 className="text-2xl font-bold text-ink">📈 {t({ zh: "销售统计", en: "Sales Stats", fr: "Statistiques de ventes" })}</h1>
        <p className="mt-1 text-sm text-ink-faint">{t({ zh: "营业额、现金/EMT/刷卡拆分、小费与税额", en: "Revenue, cash/EMT/card split, tips and tax", fr: "Chiffre d'affaires, répartition, pourboires et taxes" })}</p>
      </div>

      {/* range picker */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button key={r.k} onClick={() => setRangeKey(r.k)}
            className={`min-h-9 rounded-full px-3.5 text-sm font-medium transition ${rangeKey === r.k ? "bg-brand text-white" : "border border-slate-200 text-ink-soft hover:bg-slate-50"}`}>
            {bi(r.label)}
          </button>
        ))}
        {rangeKey === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="input min-h-9 text-sm" />
            <span className="text-ink-faint">–</span>
            <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="input min-h-9 text-sm" />
          </div>
        )}
        <span className="ml-auto text-xs text-ink-faint">{f === to2 ? f : `${f} – ${to2}`}</span>
      </div>

      {/* headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={headline} value={money(agg.sales)} sub={`${agg.txns} ${t({ zh: "笔", en: "txns", fr: "trans." })}`} big />
        <Kpi label={t({ zh: "客单价", en: "Avg ticket", fr: "Panier moyen" })} value={money(agg.avgTicket)} />
        <Kpi label={t({ zh: "小费（归员工）", en: "Tips (to staff)", fr: "Pourboires (au personnel)" })} value={money(agg.tips)} accent="jade" />
        <Kpi label={t({ zh: "实收（含税+小费）", en: "Collected (tax + tips)", fr: "Encaissé (taxes + pourboires)" })} value={money(agg.collected)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="HST 13%" value={money(agg.hst)} sub={t({ zh: "应申报", en: "to remit", fr: "à remettre" })} muted />
        <Kpi label={t({ zh: "GST 5%", en: "GST 5%", fr: "TPS 5%" })} value={money(agg.gst)} muted />
        <Kpi label={t({ zh: "PST 8%", en: "PST 8%", fr: "TVP 8%" })} value={money(agg.pst)} muted />
        <Kpi label={t({ zh: "自取 / 外送单", en: "Togo / delivery", fr: "À emporter / livraison" })} value={togoCount == null ? "—" : String(togoCount)} sub={t({ zh: "线下结算", en: "settled offline", fr: "réglé hors ligne" })} muted />
      </div>

      {/* payment method breakdown — hidden when method tracking is off */}
      {trackPay && (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">{t({ zh: "按付款方式", en: "By payment method", fr: "Par mode de paiement" })}</h2>
        <div className="space-y-2.5">
          {METHODS.map((m) => {
            const mm = agg.byMethod[m];
            const pct = agg.collected > 0 ? Math.round((mm.collected / agg.collected) * 100) : 0;
            return (
              <div key={m}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: METHOD_META[m].dot }} />
                    <span className="font-medium text-ink">{bi(METHOD_META[m].label)}</span>
                    <span className="text-xs text-ink-faint">{mm.txns} {t({ zh: "笔", en: "txns", fr: "trans." })}{mm.tips > 0 ? ` · ${t({ zh: "小费", en: "tips", fr: "pourb." })} ${money(mm.tips)}` : ""}</span>
                  </span>
                  <span className="font-bold tabular-nums text-ink">{money(mm.collected)} <span className="text-xs font-normal text-ink-faint">{pct}%</span></span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: METHOD_META[m].dot }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* transactions */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">{t({ zh: "交易明细", en: "Transactions", fr: "Transactions" })}</h2>
          {trackPay && (
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...METHODS] as const).map((m) => (
                <button key={m} onClick={() => setFilter(m)}
                  className={`min-h-8 rounded-full px-2.5 text-xs font-medium transition ${filter === m ? "bg-brand text-white" : "border border-slate-200 text-ink-soft hover:bg-slate-50"}`}>
                  {m === "all" ? t({ zh: "全部", en: "All", fr: "Tout" }) : bi(METHOD_META[m].label)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-ink-faint">
                <th className="py-2 pr-2 font-medium">{t({ zh: "时间", en: "Time", fr: "Heure" })}</th>
                {trackPay && <th className="py-2 px-2 font-medium">{t({ zh: "方式", en: "Method", fr: "Mode" })}</th>}
                <th className="py-2 px-2 text-right font-medium">{t({ zh: "营业额", en: "Sales", fr: "Ventes" })}</th>
                <th className="py-2 px-2 text-right font-medium">HST</th>
                <th className="py-2 px-2 text-right font-medium">{t({ zh: "小费", en: "Tip", fr: "Pourb." })}</th>
                <th className="py-2 pl-2 text-right font-medium">{t({ zh: "实收", en: "Collected", fr: "Encaissé" })}</th>
              </tr>
            </thead>
            <tbody>
              {txnRows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="whitespace-nowrap py-2 pr-2 text-ink-soft">{fmtTime(r.at)}</td>
                  {trackPay && (
                    <td className="py-2 px-2">
                      <span className="flex flex-wrap items-center gap-1">
                        {r.split && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-ink-soft">{t({ zh: "分单", en: "Split", fr: "Partagé" })}</span>}
                        {r.methods.map((m) => <span key={m} className="h-2 w-2 rounded-full" style={{ background: METHOD_META[m].dot }} title={bi(METHOD_META[m].label)} />)}
                      </span>
                    </td>
                  )}
                  <td className="py-2 px-2 text-right tabular-nums text-ink">{money(r.sales)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink-faint">{money(r.tax)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-jade">{r.tip > 0 ? money(r.tip) : "—"}</td>
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">{money(r.collected)}</td>
                </tr>
              ))}
              {txnRows.length === 0 && (
                <tr><td colSpan={trackPay ? 6 : 5} className="py-10 text-center text-sm text-ink-faint">{loading ? t({ zh: "加载中…", en: "Loading…", fr: "Chargement…" }) : t({ zh: "该区间还没有结账记录", en: "No checkouts in this range yet", fr: "Aucun encaissement sur cette période" })}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, big, muted, accent }: { label: string; value: string; sub?: string; big?: boolean; muted?: boolean; accent?: "jade" }) {
  return (
    <div className={`rounded-2xl border p-4 ${muted ? "border-slate-100 bg-slate-50/50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${big ? "text-3xl" : "text-xl"} ${accent === "jade" ? "text-jade" : "text-ink"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-faint">{sub}</div>}
    </div>
  );
}
