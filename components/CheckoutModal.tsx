"use client";

import { useMemo, useState } from "react";
import { computeTax } from "@/lib/tax";
import { checkoutTable, evenPartition, reconcileShares, itemizePartitions, type PaymentMethod, type SplitPayload, type ShareLine } from "@/lib/tableSessions";
import { requestBill, type Order, type OrderItem } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { zh: "结账", en: "Checkout", fr: "Encaisser" },
  table: { zh: "桌", en: "Table", fr: "Table" },
  round: { zh: "第 {n} 单", en: "Round {n}", fr: "Tournée {n}" },
  subtotal: { zh: "小计", en: "Subtotal", fr: "Sous-total" },
  total: { zh: "合计", en: "Total", fr: "Total" },
  cash: { zh: "现金", en: "Cash", fr: "Comptant" },
  card: { zh: "刷卡", en: "Card", fr: "Carte" },
  emt: { zh: "EMT", en: "EMT", fr: "Virement" },
  other: { zh: "其他", en: "Other", fr: "Autre" },
  tendered: { zh: "收款", en: "Tendered", fr: "Reçu" },
  change: { zh: "找零", en: "Change", fr: "Monnaie" },
  tip: { zh: "小费", en: "Tip", fr: "Pourboire" },
  short: { zh: "还差 {amt}", en: "Short {amt}", fr: "Manque {amt}" },
  oneBill: { zh: "一张单", en: "One bill", fr: "Une addition" },
  split: { zh: "分单", en: "Split", fr: "Partager" },
  even: { zh: "平均分", en: "Even", fr: "Égal" },
  byItem: { zh: "按菜分", en: "By dish", fr: "Par plat" },
  people: { zh: "人数", en: "People", fr: "Personnes" },
  person: { zh: "人 {n}", en: "Guest {n}", fr: "Client {n}" },
  share: { zh: "第 {n} 份", en: "Share {n}", fr: "Part {n}" },
  shared: { zh: "共享均摊", en: "Shared", fr: "Partagé" },
  tapAssign: { zh: "点菜品分配给客人 · 再点进入共享", en: "Tap a dish to assign; tap again for shared", fr: "Touchez un plat pour l'attribuer ; encore pour partagé" },
  unassigned: { zh: "还有 {n} 样未分配", en: "{n} unassigned", fr: "{n} non attribué(s)" },
  balanced: { zh: "已配平 ✓", en: "Balanced ✓", fr: "Équilibré ✓" },
  offBy: { zh: "对不上 {amt}", en: "Off by {amt}", fr: "Écart {amt}" },
  confirm: { zh: "确认结账 · 打印总单", en: "Confirm · print bill", fr: "Confirmer · imprimer" },
  confirmSplit: { zh: "确认分单 · 打印 {n} 单 + 总单", en: "Confirm split · print {n} + full", fr: "Confirmer · imprimer {n} + total" },
  busy: { zh: "结账中…", en: "Checking out…", fr: "Encaissement…" },
  needPrice: { zh: "有时价菜品未录入价格，请先在订单里录入。", en: "A market-price item has no price yet — enter it on the order first.", fr: "Un article à prix du jour n'a pas de prix — saisissez-le d'abord." },
  failed: { zh: "结账失败：", en: "Checkout failed: ", fr: "Échec : " },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

const METHODS: PaymentMethod[] = ["cash", "card", "emt", "other"];
const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const activeItems = (o: Order) => (o.items ?? []).filter((it) => !(it as OrderItem & { cancelled?: boolean }).cancelled);
// a stable per-person color so a dish's owner is readable at a glance
const DOT = ["#0E9F6E", "#2563EB", "#D97706", "#DB2777", "#7C3AED", "#0891B2", "#65A30D", "#DC2626", "#475569", "#CA8A04"];

type Unit = { key: string; name_zh: string; name_en?: string; price: number };
type Person = { id: string; method: PaymentMethod; tendered: string; tip: string };

export default function CheckoutModal({
  slug,
  tableNo,
  orders,
  onClose,
  onDone,
}: {
  slug: string;
  tableNo: string;
  orders: Order[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<"single" | "split">("single");
  const [splitMode, setSplitMode] = useState<"even" | "item">("even");

  // single-bill
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [tipInput, setTipInput] = useState(""); // whole-bill tip (single)

  // even-split
  const [evenN, setEvenN] = useState(2);
  const [evenPay, setEvenPay] = useState<{ method: PaymentMethod; tendered: string; tip: string }[]>(
    Array.from({ length: 12 }, () => ({ method: "cash" as PaymentMethod, tendered: "", tip: "" })),
  );

  // itemized-split
  const [people, setPeople] = useState<Person[]>([
    { id: "p0", method: "cash", tendered: "", tip: "" },
    { id: "p1", method: "cash", tendered: "", tip: "" },
  ]);
  const [assign, setAssign] = useState<Record<string, string>>({}); // unit.key → personId | "shared" | ""

  // ── table totals (single HST line, matches the server) ─────────────────────
  const { subtotal, hst, total, hasUnpriced } = useMemo(() => {
    let sub = 0, unpriced = false;
    for (const o of orders)
      for (const it of activeItems(o)) {
        if (it.market && !(Number(it.price) > 0)) unpriced = true;
        sub += (Number(it.price) || 0) * (Number(it.qty) || 0);
      }
    const tax = computeTax(money(sub), false);
    return { subtotal: tax.subtotal, hst: money(tax.gst + tax.pst), total: tax.total, hasUnpriced: unpriced };
  }, [orders]);

  // every active dish expanded to one unit per qty (for itemized assignment)
  const units = useMemo<Unit[]>(() => {
    const out: Unit[] = [];
    orders.forEach((o) =>
      activeItems(o).forEach((it, i) => {
        const q = Number(it.qty) || 1;
        for (let u = 0; u < q; u++) out.push({ key: `${o.id}:${i}:${u}`, name_zh: it.name_zh, name_en: it.name_en, price: money(Number(it.price) || 0) });
      }),
    );
    return out;
  }, [orders]);

  // ── single-bill cash math ──────────────────────────────────────────────────
  const tNum = tendered === "" ? null : money(parseFloat(tendered));
  const change = method === "cash" && tNum != null ? money(tNum - total) : null;
  const shortBy = method === "cash" && tNum != null && tNum < total ? money(total - tNum) : 0;
  const chips = Array.from(new Set([total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100])).map(money).filter((v) => v >= total).slice(0, 4);

  // ── even split ─────────────────────────────────────────────────────────────
  const evenShares = useMemo(() => reconcileShares(subtotal, evenPartition(subtotal, evenN)), [subtotal, evenN]);

  // ── itemized split (pure math in lib/billSplit, unit-tested) ────────────────
  const itemize = useMemo(() => itemizePartitions(units, assign, people.map((p) => p.id), subtotal), [units, assign, people, subtotal]);
  const unassignedCount = itemize.unassigned;
  const itemBalanced = itemize.balanced;
  const offBy = Math.abs(itemize.personSubtotals.reduce((a, b) => a + b, 0) - subtotal);
  const itemShares = useMemo(() => reconcileShares(subtotal, itemize.personSubtotals), [subtotal, itemize]);
  const itemLinesFor = (personId: string): ShareLine[] => {
    const map = new Map<string, ShareLine>();
    units.filter((u) => assign[u.key] === personId).forEach((u) => {
      const e = map.get(u.name_zh) ?? { name_zh: u.name_zh, name_en: u.name_en, qty: 0, price: u.price };
      e.qty += 1;
      map.set(u.name_zh, e);
    });
    return [...map.values()];
  };

  // cycle a unit: unassigned → p0 → p1 … → shared → unassigned
  const cycle = (key: string) => {
    const order = [...people.map((p) => p.id), "shared", ""];
    const cur = assign[key] ?? "";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setAssign((a) => ({ ...a, [key]: next }));
  };
  const personOf = (key: string) => {
    const v = assign[key] ?? "";
    if (v === "" || v === "shared") return v;
    return v;
  };

  // ── build split payload ────────────────────────────────────────────────────
  function buildSplit(): SplitPayload | null {
    if (mode !== "split") return null;
    if (splitMode === "even") {
      return {
        mode: "even",
        shares: evenShares.map((sh, i) => ({
          label: t(T.share).replace("{n}", String(i + 1)),
          method: evenPay[i].method,
          subtotal: sh.subtotal,
          tendered: evenPay[i].method === "cash" && evenPay[i].tendered !== "" ? money(parseFloat(evenPay[i].tendered)) : null,
          tip: evenPay[i].tip !== "" ? money(parseFloat(evenPay[i].tip)) : 0,
          evenOfN: evenN,
        })),
      };
    }
    return {
      mode: "item",
      shares: people.map((p, i) => ({
        label: t(T.person).replace("{n}", String(i + 1)),
        method: p.method,
        subtotal: itemShares[i].subtotal,
        tendered: p.method === "cash" && p.tendered !== "" ? money(parseFloat(p.tendered)) : null,
        tip: p.tip !== "" ? money(parseFloat(p.tip)) : 0,
        lines: itemLinesFor(p.id),
      })),
    };
  }

  // ── validity ───────────────────────────────────────────────────────────────
  const evenValid =
    evenN >= 2 &&
    evenShares.every((sh, i) => !(evenPay[i].method === "cash" && evenPay[i].tendered !== "" && money(parseFloat(evenPay[i].tendered)) < sh.total));
  const itemValid =
    people.length >= 2 &&
    unassignedCount === 0 &&
    itemBalanced &&
    itemize.personSubtotals.every((s) => s > 0) &&
    people.every((p, i) => !(p.method === "cash" && p.tendered !== "" && money(parseFloat(p.tendered)) < itemShares[i].total));

  const canConfirm =
    !busy && !hasUnpriced &&
    (mode === "single"
      ? method !== "cash" || tNum == null || tNum >= total
      : splitMode === "even" ? evenValid : itemValid);

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setErr(null);
    const split = buildSplit();
    const topMethod = mode === "single" ? method : "other";
    const topTendered = mode === "single" && method === "cash" ? tNum : null;
    const topTip = mode === "single" && tipInput !== "" ? money(parseFloat(tipInput)) : null;
    const res = await checkoutTable(slug, tableNo, topMethod, topTendered, split, topTip);
    if (!res.ok) {
      setErr(res.needsPricing ? t(T.needPrice) : t(T.failed) + (res.error ?? ""));
      setBusy(false);
      return;
    }
    // single bill: queue the merged 账单 here (split bills are queued server-side).
    if (mode === "single") await requestBill(orders.map((o) => o.id)).catch(() => {});
    onDone();
  };

  // ── small building blocks ──────────────────────────────────────────────────
  const seg = (active: boolean) =>
    `min-h-11 flex-1 rounded-lg border text-sm font-medium transition ${active ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`;
  const methodSelect = (val: PaymentMethod, onChange: (m: PaymentMethod) => void) => (
    <select value={val} onChange={(e) => onChange(e.target.value as PaymentMethod)} className="input min-h-10 !w-24 flex-none text-sm">
      {METHODS.map((m) => <option key={m} value={m}>{t(T[m])}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${t(T.title)} ${tableNo}`}>
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-base font-bold text-ink">{t(T.title)} · {t(T.table)} {tableNo}</span>
          <button onClick={onClose} disabled={busy} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-slate-50">✕</button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* bill */}
          <div className="max-h-40 overflow-auto border-b border-slate-100 px-4 py-3 text-sm">
            {orders.map((o, ri) => (
              <div key={o.id} className={ri > 0 ? "mt-3" : ""}>
                <div className="mb-1 text-[11px] text-ink-faint">{t(T.round).replace("{n}", String(ri + 1))}</div>
                {activeItems(o).map((it, i) => (
                  <div key={i} className="flex justify-between py-0.5">
                    <span className="text-ink">{it.name_zh} <span className="text-ink-faint">×{it.qty}</span></span>
                    <span className="text-ink-soft">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* totals */}
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm">
            <div className="flex justify-between py-0.5 text-ink-soft"><span>{t(T.subtotal)}</span><span>{fmtPrice(subtotal)}</span></div>
            <div className="flex justify-between py-0.5 text-ink-soft"><span>HST 13%</span><span>{fmtPrice(hst)}</span></div>
            <div className="mt-1 flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t(T.total)}</span><span>{fmtPrice(total)}</span></div>
          </div>

          {/* one bill / split */}
          <div className="px-4 py-3">
            <div className="mb-3 grid grid-cols-2 gap-1.5">
              <button onClick={() => setMode("single")} className={seg(mode === "single")}>{t(T.oneBill)}</button>
              <button onClick={() => setMode("split")} className={seg(mode === "split")}>{t(T.split)}</button>
            </div>

            {/* ── SINGLE ─────────────────────────────────────────────── */}
            {mode === "single" && (
              <>
                <div className="mb-2.5 grid grid-cols-4 gap-1.5">
                  {METHODS.map((m) => (
                    <button key={m} onClick={() => setMethod(m)} className={seg(method === m)}>{t(T[m])}</button>
                  ))}
                </div>
                <div className="mb-2.5 flex items-center gap-2">
                  <label className="flex-none text-sm text-ink-soft">{t(T.tip)}</label>
                  <input type="number" inputMode="decimal" value={tipInput} onChange={(e) => setTipInput(e.target.value)} className="input min-h-11 flex-1" placeholder="0.00" />
                </div>
                {method === "cash" && (
                  <>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {chips.map((v, i) => (
                        <button key={v} onClick={() => setTendered(String(v))} className="min-h-11 flex-1 rounded-lg border border-slate-200 px-2 text-sm font-medium text-ink-soft hover:bg-slate-50">
                          {i === 0 ? fmtPrice(v) : `$${v}`}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-ink-soft">{t(T.tendered)}</label>
                      <input type="number" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} className="input min-h-11 flex-1" placeholder={String(total)} />
                      <span className="text-sm text-ink-soft">{t(T.change)}</span>
                      <span className={`min-w-16 text-right text-lg font-bold ${shortBy > 0 ? "text-red-600" : "text-ink"}`}>
                        {shortBy > 0 ? t(T.short).replace("{amt}", fmtPrice(shortBy)) : fmtPrice(change ?? 0)}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── SPLIT ──────────────────────────────────────────────── */}
            {mode === "split" && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-1.5">
                  <button onClick={() => setSplitMode("even")} className={seg(splitMode === "even")}>{t(T.even)}</button>
                  <button onClick={() => setSplitMode("item")} className={seg(splitMode === "item")}>{t(T.byItem)}</button>
                </div>

                {/* EVEN */}
                {splitMode === "even" && (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-soft">{t(T.people)}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setEvenN((n) => Math.max(2, n - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-ink">−</button>
                        <span className="w-6 text-center text-lg font-bold text-ink">{evenN}</span>
                        <button onClick={() => setEvenN((n) => Math.min(12, n + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-ink">＋</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {evenShares.map((sh, i) => {
                        const tv = evenPay[i].tendered === "" ? null : money(parseFloat(evenPay[i].tendered));
                        const chg = evenPay[i].method === "cash" && tv != null ? money(tv - sh.total) : null;
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                            <span className="flex-none text-sm font-medium text-ink">{t(T.share).replace("{n}", String(i + 1))}</span>
                            <span className="flex-1 text-sm font-bold tabular-nums text-ink">{fmtPrice(sh.total)}</span>
                            {methodSelect(evenPay[i].method, (m) => setEvenPay((a) => a.map((x, k) => (k === i ? { ...x, method: m } : x))))}
                            <input type="number" inputMode="decimal" placeholder={t(T.tip)} value={evenPay[i].tip}
                              onChange={(e) => setEvenPay((a) => a.map((x, k) => (k === i ? { ...x, tip: e.target.value } : x)))}
                              className="input min-h-10 !w-16 flex-none text-sm" />
                            {evenPay[i].method === "cash" && (
                              <input type="number" inputMode="decimal" placeholder={t(T.tendered)} value={evenPay[i].tendered}
                                onChange={(e) => setEvenPay((a) => a.map((x, k) => (k === i ? { ...x, tendered: e.target.value } : x)))}
                                className="input min-h-10 !w-20 flex-none text-sm" />
                            )}
                            {chg != null && <span className={`flex-none text-xs font-semibold ${chg < 0 ? "text-red-600" : "text-jade"}`}>{fmtPrice(chg)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ITEMIZED */}
                {splitMode === "item" && (
                  <>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-soft">{t(T.people)}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setPeople((ps) => (ps.length > 2 ? ps.slice(0, -1) : ps))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-ink">−</button>
                        <span className="w-6 text-center text-lg font-bold text-ink">{people.length}</span>
                        <button onClick={() => setPeople((ps) => (ps.length < 10 ? [...ps, { id: `p${ps.length}${Date.now() % 1000}`, method: "cash", tendered: "", tip: "" }] : ps))} className="grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-ink">＋</button>
                      </div>
                    </div>
                    <p className="mb-2 text-[11px] text-ink-faint">{t(T.tapAssign)}</p>
                    {/* dish units */}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {units.map((u) => {
                        const who = personOf(u.key);
                        const pIdx = people.findIndex((p) => p.id === who);
                        const color = who === "shared" ? "#64748B" : pIdx >= 0 ? DOT[pIdx % DOT.length] : undefined;
                        return (
                          <button key={u.key} onClick={() => cycle(u.key)}
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs ${who === "" ? "border-dashed border-slate-300 text-ink-faint" : "border-slate-200 text-ink"}`}>
                            {color && <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color }} />}
                            <span>{u.name_zh}</span>
                            <span className="text-ink-faint">{who === "shared" ? t(T.shared) : who === "" ? "?" : `#${pIdx + 1}`}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* per-person summary */}
                    <div className="space-y-2">
                      {people.map((p, i) => {
                        const tv = p.tendered === "" ? null : money(parseFloat(p.tendered));
                        const chg = p.method === "cash" && tv != null ? money(tv - itemShares[i].total) : null;
                        return (
                          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
                            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: DOT[i % DOT.length] }} />
                            <span className="flex-none text-sm font-medium text-ink">#{i + 1}</span>
                            <span className="flex-1 text-sm font-bold tabular-nums text-ink">{fmtPrice(itemShares[i].total)}</span>
                            {methodSelect(p.method, (m) => setPeople((ps) => ps.map((x, k) => (k === i ? { ...x, method: m } : x))))}
                            <input type="number" inputMode="decimal" placeholder={t(T.tip)} value={p.tip}
                              onChange={(e) => setPeople((ps) => ps.map((x, k) => (k === i ? { ...x, tip: e.target.value } : x)))}
                              className="input min-h-10 !w-16 flex-none text-sm" />
                            {p.method === "cash" && (
                              <input type="number" inputMode="decimal" placeholder={t(T.tendered)} value={p.tendered}
                                onChange={(e) => setPeople((ps) => ps.map((x, k) => (k === i ? { ...x, tendered: e.target.value } : x)))}
                                className="input min-h-10 !w-20 flex-none text-sm" />
                            )}
                            {chg != null && <span className={`flex-none text-xs font-semibold ${chg < 0 ? "text-red-600" : "text-jade"}`}>{fmtPrice(chg)}</span>}
                          </div>
                        );
                      })}
                    </div>
                    {/* reconciliation strip */}
                    <div className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-semibold ${unassignedCount > 0 ? "bg-amber-50 text-amber-700" : itemBalanced ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {unassignedCount > 0
                        ? t(T.unassigned).replace("{n}", String(unassignedCount))
                        : itemBalanced ? t(T.balanced) : t(T.offBy).replace("{amt}", fmtPrice(offBy))}
                    </div>
                  </>
                )}
              </>
            )}

            {hasUnpriced && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t(T.needPrice)}</div>}
            {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}
          </div>
        </div>

        {/* confirm */}
        <div className="border-t border-slate-100 px-4 py-3">
          <button onClick={confirm} disabled={!canConfirm} className="btn-primary w-full disabled:opacity-50">
            {busy ? t(T.busy) : mode === "single" ? t(T.confirm) : t(T.confirmSplit).replace("{n}", String(splitMode === "even" ? evenN : people.length))}
          </button>
        </div>
      </div>
    </div>
  );
}
