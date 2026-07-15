"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { getTrackPayments } from "@/lib/store";
import { listSessionsInRange, listSessionOrders, listSessionOrderIds, type SessionItem } from "@/lib/tableSessions";
import { requestBill } from "@/lib/orders";
import { aggregateSales, torontoToday, shiftDate, METHODS, type SessionRow, type Method } from "@/lib/salesStats";
import { moneyExact, displayTable } from "@/lib/format";
import { signedMoney } from "@/lib/billFormat";
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
  const [sort, setSort] = useState<{ col: "time" | "table" | "collected"; dir: "asc" | "desc" }>({ col: "time", dir: "desc" });
  const [detail, setDetail] = useState<{ id?: string; table_no: string; at: string; split: boolean; splits: SessionRow["splits"]; methods: Method[]; sales: number; tax: number; tip: number; collected: number } | null>(null);
  const [detailItems, setDetailItems] = useState<SessionItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reprint, setReprint] = useState<"idle" | "busy" | "done" | "error">("idle");
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
        id: r.id,
        table_no: (r.table_no || "").trim(),
        at: r.closed_at,
        split: r.payment_method === "split",
        splits: r.splits ?? [],
        methods: methodsInRow,
        sales: Number(r.subtotal) || 0,
        tax: (Number(r.gst) || 0) + (Number(r.pst) || 0),
        tip: Number(r.tip) || 0,
        collected: (Number(r.total) || 0) + (Number(r.tip) || 0),
      };
    });
    const filtered = !trackPay || filter === "all" ? list : list.filter((x) => x.methods.includes(filter));
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      // 桌号 sorts numerically (2 < 12), falling back to string for labels like "2A".
      if (sort.col === "table") {
        const na = parseInt(a.table_no, 10), nb = parseInt(b.table_no, 10);
        if (Number.isNaN(na) && Number.isNaN(nb)) return a.table_no < b.table_no ? -dir : a.table_no > b.table_no ? dir : 0;
        if (Number.isNaN(na)) return dir; // blank/togo rows sink to the bottom
        if (Number.isNaN(nb)) return -dir;
        return na !== nb ? (na - nb) * dir : (a.table_no < b.table_no ? -dir : dir);
      }
      if (sort.col === "collected") return (a.collected - b.collected) * dir;
      return (a.at < b.at ? -dir : a.at > b.at ? dir : 0); // time
    });
  }, [rows, filter, trackPay, sort]);
  type TxnRow = (typeof txnRows)[number];

  const toggleSort = (col: "time" | "table" | "collected") =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "table" ? "asc" : "desc" }));

  const openDetail = useCallback(async (r: TxnRow) => {
    setDetail(r);
    setDetailItems([]);
    setReprint("idle");
    if (!r.id) return; // pre-feature/togo row — no linked orders; drawer shows empty state
    setDetailLoading(true);
    try {
      setDetailItems(await listSessionOrders(r.id));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Re-queue this settled session's combined bill (总单) to the printer.
  const reprintBill = useCallback(async () => {
    if (!detail?.id || reprint === "busy") return;
    setReprint("busy");
    const ids = await listSessionOrderIds(detail.id);
    if (ids.length === 0) { setReprint("error"); return; }
    const { error } = await requestBill(ids);
    setReprint(error ? "error" : "done");
  }, [detail, reprint]);
  // Esc closes the detail drawer.
  useEffect(() => {
    if (!detail) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [detail]);
  const caret = (col: "time" | "table" | "collected") =>
    sort.col === col ? <span className="text-emerald-600">{sort.dir === "asc" ? "▲" : "▼"}</span> : <span className="text-slate-300">↕</span>;

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
        <Kpi label={headline} value={moneyExact(agg.sales)} sub={`${agg.txns} ${t({ zh: "笔", en: "txns", fr: "trans." })}`} big />
        <Kpi label={t({ zh: "客单价", en: "Avg ticket", fr: "Panier moyen" })} value={moneyExact(agg.avgTicket)} />
        <Kpi label={t({ zh: "小费（归员工）", en: "Tips (to staff)", fr: "Pourboires (au personnel)" })} value={moneyExact(agg.tips)} accent="jade" />
        <Kpi label={t({ zh: "实收（含税+小费）", en: "Collected (tax + tips)", fr: "Encaissé (taxes + pourboires)" })} value={moneyExact(agg.collected)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="HST 13%" value={moneyExact(agg.hst)} sub={t({ zh: "应申报", en: "to remit", fr: "à remettre" })} muted />
        <Kpi label={t({ zh: "GST 5%", en: "GST 5%", fr: "TPS 5%" })} value={moneyExact(agg.gst)} muted />
        <Kpi label={t({ zh: "PST 8%", en: "PST 8%", fr: "TVP 8%" })} value={moneyExact(agg.pst)} muted />
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
                    <span className="text-xs text-ink-faint">{mm.txns} {t({ zh: "笔", en: "txns", fr: "trans." })}{mm.tips > 0 ? ` · ${t({ zh: "小费", en: "tips", fr: "pourb." })} ${moneyExact(mm.tips)}` : ""}</span>
                  </span>
                  <span className="font-bold tabular-nums text-ink">{moneyExact(mm.collected)} <span className="text-xs font-normal text-ink-faint">{pct}%</span></span>
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
                <th className="py-2 pr-2 font-medium">
                  <button onClick={() => toggleSort("time")} className="inline-flex items-center gap-0.5 hover:text-ink">{t({ zh: "时间", en: "Time", fr: "Heure" })}{caret("time")}</button>
                </th>
                <th className="py-2 px-2 font-medium">
                  <button onClick={() => toggleSort("table")} className="inline-flex items-center gap-0.5 hover:text-ink">{t({ zh: "桌号", en: "Table", fr: "Table" })}{caret("table")}</button>
                </th>
                {trackPay && <th className="py-2 px-2 font-medium">{t({ zh: "方式", en: "Method", fr: "Mode" })}</th>}
                <th className="py-2 px-2 text-right font-medium">{t({ zh: "营业额", en: "Sales", fr: "Ventes" })}</th>
                <th className="py-2 px-2 text-right font-medium">HST</th>
                <th className="py-2 px-2 text-right font-medium">{t({ zh: "小费", en: "Tip", fr: "Pourb." })}</th>
                <th className="py-2 pl-2 text-right font-medium">
                  <button onClick={() => toggleSort("collected")} className="inline-flex items-center gap-0.5 hover:text-ink">{t({ zh: "实收", en: "Collected", fr: "Encaissé" })}{caret("collected")}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {txnRows.map((r, i) => (
                <tr key={r.id ?? i} onClick={() => openDetail(r)} className="cursor-pointer border-b border-slate-50 transition hover:bg-emerald-50/50">
                  <td className="whitespace-nowrap py-2 pr-2 text-ink-soft">{fmtTime(r.at)}</td>
                  <td className="whitespace-nowrap py-2 px-2 font-medium text-ink">{r.table_no ? displayTable(r.table_no) : "—"}</td>
                  {trackPay && (
                    <td className="py-2 px-2">
                      <span className="flex flex-wrap items-center gap-1">
                        {r.split && <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-ink-soft">{t({ zh: "分单", en: "Split", fr: "Partagé" })}</span>}
                        {r.methods.map((m) => <span key={m} className="h-2 w-2 rounded-full" style={{ background: METHOD_META[m].dot }} title={bi(METHOD_META[m].label)} />)}
                      </span>
                    </td>
                  )}
                  <td className="py-2 px-2 text-right tabular-nums text-ink">{moneyExact(r.sales)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink-faint">{moneyExact(r.tax)}</td>
                  <td className="py-2 px-2 text-right tabular-nums text-jade">{r.tip > 0 ? moneyExact(r.tip) : "—"}</td>
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">{moneyExact(r.collected)}</td>
                </tr>
              ))}
              {txnRows.length === 0 && (
                <tr><td colSpan={trackPay ? 7 : 6} className="py-10 text-center text-sm text-ink-faint">{loading ? t({ zh: "加载中…", en: "Loading…", fr: "Chargement…" }) : t({ zh: "该区间还没有结账记录", en: "No checkouts in this range yet", fr: "Aucun encaissement sur cette période" })}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* transaction detail — right slide-in drawer: the dishes billed on this
          settled session (orders.table_session_id), split shares + totals. */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setDetail(null)}>
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-none items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-lg font-bold text-ink">
                  {detail.table_no ? `${t({ zh: "桌", en: "Table", fr: "Table" })} ${displayTable(detail.table_no)}` : t({ zh: "外卖 / 配送", en: "Takeout / Delivery", fr: "À emporter / Livraison" })}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                  <span>{fmtTime(detail.at)}</span>
                  {trackPay && <span className="text-slate-300">·</span>}
                  {trackPay && detail.split && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">{t({ zh: "分单", en: "Split", fr: "Partagé" })}</span>}
                  {trackPay && detail.methods.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: METHOD_META[m].dot }} />{bi(METHOD_META[m].label)}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setDetail(null)} aria-label={t({ zh: "关闭", en: "Close", fr: "Fermer" })} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-lg text-ink-faint hover:bg-slate-50">✕</button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <p className="py-10 text-center text-sm text-ink-faint">{t({ zh: "加载中…", en: "Loading…", fr: "Chargement…" })}</p>
              ) : detailItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink-faint">{t({ zh: "此单无逐菜明细（旧单或外卖）", en: "No itemized detail for this order", fr: "Aucun détail par plat pour cette commande" })}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {detailItems.map((it, i) => (
                    <div key={i} className="py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-sm font-medium text-ink">
                          {lang === "zh" ? it.name_zh : it.name_en || it.name_zh}{it.qty > 1 && <span className="ml-1 text-ink-faint">×{it.qty}</span>}
                        </span>
                        <span className="flex-none text-sm tabular-nums text-ink">{it.price == null ? t({ zh: "时价", en: "Market", fr: "Prix du jour" }) : moneyExact((Number(it.price) || 0) * it.qty)}</span>
                      </div>
                      {(it.note || it.adjust) && (
                        <div className="mt-0.5 text-xs text-gold">→ {it.note || t({ zh: "加价", en: "Adjust", fr: "Ajust." })}{it.adjust ? ` ${signedMoney(it.adjust)}` : ""}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {detail.split && (detail.splits?.length ?? 0) > 0 && (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="mb-1.5 text-xs font-semibold text-ink-soft">{t({ zh: "分单付款", en: "Split payments", fr: "Paiements partagés" })}</div>
                  <div className="space-y-1">
                    {detail.splits!.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-ink-soft">{s.label || `${t({ zh: "客", en: "Guest", fr: "Client" })} ${i + 1}`} · {bi(METHOD_META[methodLabelKey(String(s.method))].label)}</span>
                        <span className="tabular-nums text-ink">{moneyExact((Number(s.total) || 0) + (Number(s.tip) || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-none space-y-1 border-t border-slate-100 px-5 py-4 text-sm tabular-nums">
              <div className="flex justify-between text-ink-soft"><span>{t({ zh: "营业额", en: "Sales", fr: "Ventes" })}</span><span>{moneyExact(detail.sales)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>HST</span><span>{moneyExact(detail.tax)}</span></div>
              {detail.tip > 0 && <div className="flex justify-between text-jade"><span>{t({ zh: "小费", en: "Tip", fr: "Pourboire" })}</span><span>{moneyExact(detail.tip)}</span></div>}
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t({ zh: "实收", en: "Collected", fr: "Encaissé" })}</span><span>{moneyExact(detail.collected)}</span></div>

              {detail.id && detail.table_no && (
                <button
                  onClick={reprintBill}
                  disabled={reprint === "busy"}
                  className={`mt-3 w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    reprint === "done" ? "bg-emerald-50 text-emerald-700" : reprint === "error" ? "bg-red-50 text-red-700" : "bg-brand text-white hover:opacity-90"
                  }`}
                >
                  {reprint === "busy"
                    ? t({ zh: "发送到打印机…", en: "Sending to printer…", fr: "Envoi à l'imprimante…" })
                    : reprint === "done"
                    ? t({ zh: "✓ 已发送,打印机将补打总单", en: "✓ Sent — the printer will reprint the bill", fr: "✓ Envoyé — l'imprimante réimprime l'addition" })
                    : reprint === "error"
                    ? t({ zh: "打印失败,点此重试", en: "Print failed — tap to retry", fr: "Échec — toucher pour réessayer" })
                    : t({ zh: "🖨️ 重打总单", en: "🖨️ Reprint bill", fr: "🖨️ Réimprimer l'addition" })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
