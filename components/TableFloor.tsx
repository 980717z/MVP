"use client";

import { useEffect, useState } from "react";
import type { TableSpot } from "@/lib/store";
import { reprintOrder, requestBill, cancelOrderItem, markServed, deleteOrder, setOrderStatus, updateOrderItems, type Order, type OrderItem } from "@/lib/orders";
import { listMenuItems } from "@/lib/menu";
import { tableOccupancy, listTableCheckouts, listSessionOrders, type TableState, type TableCheckout, type SessionItem } from "@/lib/tableSessions";
import { torontoToday } from "@/lib/salesStats";
import { price as fmtPrice, displayTable } from "@/lib/format";
import CheckoutModal from "@/components/CheckoutModal";
import StaffOrderPicker from "@/components/StaffOrderPicker";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  empty: { zh: "空桌", en: "Empty table", fr: "Table libre" },
  noOrder: { zh: "还没有订单", en: "No orders yet", fr: "Aucune commande" },
  emptyHint: { zh: "点单即可开台", en: "Take an order to open the table", fr: "Commander pour ouvrir la table" },
  round: { zh: "第 {n} 单", en: "Round {n}", fr: "Tournée {n}" },
  ordersCount: { zh: "{n}单", en: "{n} orders", fr: "{n} cmd" },
  reprint: { zh: "重打厨房单", en: "Reprint kitchen", fr: "Réimprimer" },
  printBill: { zh: "打印账单", en: "Print bill", fr: "Imprimer l'addition" },
  billSent: { zh: "账单已送打印机", en: "Bill sent to printer", fr: "Addition envoyée à l'imprimante" },
  checkout: { zh: "结账", en: "Checkout", fr: "Encaisser" },
  m_cash: { zh: "现金", en: "Cash", fr: "Comptant" },
  m_card: { zh: "刷卡", en: "Card", fr: "Carte" },
  m_emt: { zh: "EMT", en: "EMT", fr: "Virement" },
  m_other: { zh: "其他", en: "Other", fr: "Autre" },
  m_split: { zh: "分单", en: "Split", fr: "Partagé" },
  order: { zh: "点单", en: "Take order", fr: "Commander" },
  addRound: { zh: "加单", en: "Add round", fr: "Ajouter" },
  paidHistory: { zh: "今日已结", en: "Paid today", fr: "Payé aujourd'hui" },
  paidToday: { zh: "今日已结", en: "Paid today", fr: "Payé aujourd'hui" },
  paidBtn: { zh: "今日已结 · {n} 单", en: "Paid today · {n}", fr: "Payé aujourd'hui · {n}" },
  paidNone: { zh: "今天这桌还没有结账记录", en: "No checkouts for this table today", fr: "Aucun encaissement aujourd'hui" },
  tapForItems: { zh: "点开看菜品", en: "Tap to see items", fr: "Voir les plats" },
  noItems: { zh: "这单没有菜品明细", en: "No item detail on this order", fr: "Aucun détail" },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
  cancelItem: { zh: "取消", en: "Cancel", fr: "Annuler" },
  cancelled: { zh: "已取消", en: "Cancelled", fr: "Annulé" },
  cancelOrder: { zh: "取消整单", en: "Cancel order", fr: "Annuler la commande" },
  del: { zh: "删除", en: "Delete", fr: "Supprimer" },
  marketPending: { zh: "时价", en: "Market", fr: "Prix du jour" },
  marketPrompt: { zh: "「{name}」今日单价 ($)", en: "Today's unit price for “{name}” ($)", fr: "Prix unitaire du jour pour « {name} » ($)" },
  invalidPrice: { zh: "请输入有效价格。", en: "Enter a valid price.", fr: "Saisissez un prix valide." },
  confirmCancelOrder: { zh: "取消这一单？", en: "Cancel this order?", fr: "Annuler cette commande ?" },
  confirmDel: { zh: "删除这一单？", en: "Delete this order?", fr: "Supprimer cette commande ?" },
  legendEmpty: { zh: "空闲", en: "Empty", fr: "Vide" },
  legendBusy: { zh: "用餐中", en: "Occupied", fr: "Occupée" },
  legendServed: { zh: "已出餐", en: "Served", fr: "Servi" },
  serveItem: { zh: "出餐", en: "Serve", fr: "Servir" },
  unserve: { zh: "撤销", en: "Undo", fr: "Annuler" },
  serveOrder: { zh: "整单出餐", en: "Serve round", fr: "Servir la tournée" },
  unserveOrder: { zh: "整单撤销", en: "Unserve round", fr: "Annuler la tournée" },
  serveTable: { zh: "🍽️ 整桌出餐", en: "🍽️ Serve whole table", fr: "🍽️ Servir toute la table" },
  unserveTable: { zh: "🍽️ 整桌取消出餐", en: "🍽️ Unmark whole table", fr: "🍽️ Annuler le service" },
  servedTag: { zh: "已出", en: "Served", fr: "Servi" },
  more: { zh: "更多", en: "More", fr: "Plus" },
  serveAria: { zh: "标记出餐", en: "Mark served", fr: "Marquer servi" },
};

const NEW_MS = 120_000; // "new order" cue window

function autoGrid(i: number, n: number): { x: number; y: number } {
  const cols = Math.ceil(Math.sqrt(n));
  const r = Math.floor(i / cols);
  const c = i % cols;
  const rows = Math.ceil(n / cols);
  return { x: (c + 0.5) / cols, y: (r + 0.5) / Math.max(rows, 1) };
}

export default function TableFloor({
  slug,
  orders,
  tables,
  layout,
  trackPayments = true,
  dayStartHour = 0,
  onChanged,
}: {
  slug: string;
  orders: Order[]; // all orders (component filters to unpaid dine-in)
  tables: string[];
  layout: TableSpot[];
  trackPayments?: boolean;
  dayStartHour?: number; // business-day boundary (fulai = 7 → 7am-7am)
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useLang();
  const nOrders = (n: number) => t(T.ordersCount).replace("{n}", String(n));
  const occ = tableOccupancy(orders);
  const [sel, setSel] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [history, setHistory] = useState<TableCheckout[]>([]);
  const [paidView, setPaidView] = useState(false); // the "paid today" list modal
  const [expanded, setExpanded] = useState<string | null>(null); // session id whose items are open
  const [expandedItems, setExpandedItems] = useState<Record<string, SessionItem[]>>({});
  const [rowMenu, setRowMenu] = useState<string | null>(null); // order id whose ⋯ (destructive) menu is open
  const now = Date.now();
  const paidSum = history.reduce((s, h) => s + Number(h.total || 0), 0);

  const openSession = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedItems[id]) {
      const items = await listSessionOrders(id).catch(() => []);
      setExpandedItems((m) => ({ ...m, [id]: items }));
    }
  };

  const byLabel = new Map(layout.map((l) => [l.label, l]));
  // Show every configured table; fall back to auto-grid for any without a layout entry.
  const spots = tables.map((label, i) => byLabel.get(label) ?? { label, ...autoGrid(i, tables.length), shape: "square" as const });

  // Only THIS business day's checkouts (7am-7am for fulai) — never all history.
  const todayBiz = torontoToday(new Date(), dayStartHour);
  useEffect(() => {
    if (sel) listTableCheckouts(slug, sel, todayBiz).then(setHistory).catch(() => setHistory([]));
    else setHistory([]);
    setPaidView(false); setExpanded(null);
  }, [sel, slug, orders, todayBiz]);

  const state = (label: string): TableState | undefined => occ.get(label);
  const isNew = (s?: TableState) => !!s && now - s.newestAt < NEW_MS;

  // Before opening the bill, price any un-priced 时价 item (weighed live seafood):
  // prefill today's board price, else prompt for the weighed price. Mirrors the
  // old 标记完成 gate so a table can't check out at $0.
  const beginCheckout = async (s: TableState) => {
    const needy = s.orders.filter((o) => (o.items ?? []).some((it) => (it as OrderItem & { cancelled?: boolean }).market && !(Number(it.price) > 0) && !(it as { cancelled?: boolean }).cancelled));
    if (needy.length) {
      const menu = await listMenuItems(slug).catch(() => []);
      const ref = new Map(menu.map((m) => [m.id, m.price]));
      for (const o of needy) {
        const items = [...(o.items ?? [])] as (OrderItem & { cancelled?: boolean })[];
        let changed = false;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (!it.market || Number(it.price) > 0 || it.cancelled) continue;
          const pre = ref.get(it.id);
          const raw = window.prompt(t(T.marketPrompt).replace("{name}", it.name_zh), pre != null && pre > 0 ? String(pre) : "");
          if (raw == null) return; // waiter cancelled → abort checkout
          const p = parseFloat(raw);
          if (!(p > 0)) { alert(t(T.invalidPrice)); return; }
          items[i] = { ...it, price: Math.round(p * 100) / 100 };
          changed = true;
        }
        if (changed) {
          const tot = items.filter((x) => !x.cancelled).reduce((sum, x) => sum + (Number(x.price) || 0) * x.qty, 0);
          await updateOrderItems(o.id, items as OrderItem[], Math.round(tot * 100) / 100);
        }
      }
      await onChanged(); // reload so the modal sees priced items
    }
    setCheckout(true);
  };

  const nodeClasses = (s?: TableState) =>
    !s?.hasOrder
      ? "border-slate-200 bg-white text-ink-faint"
      : s.served
        ? "border-amber-400 bg-amber-50 text-amber-700" // 已出餐: some food is out
        : "border-brand bg-brand-wash text-brand-ink"; // 用餐中: ordered, nothing served yet

  return (
    <>
      {/* legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-200 bg-white" />{t(T.legendEmpty)}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-brand bg-brand-wash" />{t(T.legendBusy)}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-400 bg-amber-50" />{t(T.legendServed)}</span>
      </div>

      {/* DESKTOP: spatial map — bounded, centered "room" canvas (portrait, like
          the real room) so tables sit at comfortable density instead of sprawling. */}
      <div className="relative mx-auto hidden aspect-[4/5] w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-[#FBFAF8] sm:block">
        {spots.map((sp) => {
          const s = state(sp.label);
          return (
            <button
              key={sp.label}
              onClick={() => { setSel(sp.label); setCheckout(false); }}
              aria-label={`${displayTable(sp.label)} · ${s?.hasOrder ? fmtPrice(s.total) : t(T.empty)}`}
              style={{ left: `${(0.05 + sp.x * 0.9) * 100}%`, top: `${(0.06 + sp.y * 0.88) * 100}%` }}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center border-2 p-2 text-center shadow-sm transition hover:scale-105 ${nodeClasses(s)} ${sp.shape === "round" ? "h-20 w-20 rounded-full" : "min-h-16 min-w-24 rounded-2xl"}`}
            >
              {isNew(s) && <span className="absolute -right-1.5 -top-1.5 h-4 w-4 animate-pulse rounded-full bg-amber-500 ring-2 ring-white" />}
              <span className="text-xl font-extrabold leading-none">{displayTable(sp.label)}</span>
              {s?.hasOrder && <span className="mt-1 text-xs font-semibold leading-none">{fmtPrice(s.total)} · {nOrders(s.orders.length)}</span>}
            </button>
          );
        })}
      </div>

      {/* MOBILE: list (has-order first) */}
      <div className="flex flex-col gap-2 sm:hidden">
        {[...spots].sort((a, b) => Number(!!state(b.label)?.hasOrder) - Number(!!state(a.label)?.hasOrder)).map((sp) => {
          const s = state(sp.label);
          return (
            <button
              key={sp.label}
              onClick={() => { setSel(sp.label); setCheckout(false); }}
              className={`flex min-h-14 items-center justify-between rounded-xl border px-4 text-left ${nodeClasses(s)}`}
            >
              <span className="flex items-center gap-2">
                {isNew(s) && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-500" />}
                <span className="text-base font-bold">{displayTable(sp.label)}</span>
              </span>
              <span className="text-sm">{s?.hasOrder ? `${fmtPrice(s.total)} · ${nOrders(s.orders.length)}` : t(T.empty)}</span>
            </button>
          );
        })}
      </div>

      {/* TABLE SHEET */}
      {sel && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSel(null)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-ink">{displayTable(sel)}</span>
                <span className={`text-xs font-medium ${!state(sel)?.hasOrder ? "text-ink-faint" : state(sel)?.served ? "text-amber-600" : "text-brand-ink"}`}>
                  {!state(sel)?.hasOrder ? t(T.legendEmpty) : `${t(state(sel)!.served ? T.legendServed : T.legendBusy)} · ${nOrders(state(sel)!.orders.length)}`}
                </span>
              </div>
              <button onClick={() => setSel(null)} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-slate-50">✕</button>
            </div>

            <div className="flex-1 overflow-auto px-4 py-3">
              {state(sel)?.hasOrder ? (
                state(sel)!.orders.map((o, ri) => (
                  <div key={o.id} className={`${ri > 0 ? "mt-3 border-t border-slate-100 pt-3" : ""}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                      <span>{t(T.round).replace("{n}", String(ri + 1))}</span>
                      <span className="flex items-center gap-3">
                        {(() => {
                          const act = (o.items ?? []).filter((it: OrderItem & { cancelled?: boolean }) => !it.cancelled);
                          const done = act.length > 0 && act.every((it: OrderItem & { served?: boolean }) => it.served);
                          return <button onClick={async () => { await markServed(o.id, !done); onChanged(); }} className="font-medium text-amber-600 hover:underline">{done ? t(T.unserveOrder) : t(T.serveOrder)}</button>;
                        })()}
                        <button onClick={async () => { await reprintOrder(o.id); onChanged(); }} className="text-brand hover:underline">🖨️ {t(T.reprint)}</button>
                        {/* destructive round actions tucked behind ⋯ so a live table can't be fat-fingered */}
                        <div className="relative">
                          <button onClick={() => setRowMenu((m) => (m === o.id ? null : o.id))} aria-label={t(T.more)} aria-expanded={rowMenu === o.id} className="grid h-6 w-6 place-items-center rounded text-base leading-none text-ink-faint hover:bg-slate-100">⋯</button>
                          {rowMenu === o.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
                              <div className="absolute right-0 top-full z-50 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
                                <button onClick={async () => { setRowMenu(null); if (confirm(t(T.confirmCancelOrder))) { await setOrderStatus(o.id, "cancelled"); onChanged(); } }} className="block w-full px-3 py-2.5 text-left text-red-600 hover:bg-red-50">{t(T.cancelOrder)}</button>
                                <button onClick={async () => { setRowMenu(null); if (confirm(t(T.confirmDel))) { await deleteOrder(o.id); onChanged(); } }} className="block w-full px-3 py-2.5 text-left text-red-600 hover:bg-red-50">{t(T.del)}</button>
                              </div>
                            </>
                          )}
                        </div>
                      </span>
                    </div>
                    {(o.items ?? []).map((it: OrderItem & { cancelled?: boolean }, i: number) => (
                      <div key={i} className={`flex items-center gap-2.5 py-1 text-sm ${it.cancelled ? "opacity-40" : ""}`}>
                        {/* serve toggle — routine, big tap target; filled amber ✓ when served */}
                        {it.cancelled ? (
                          <span className="h-6 w-6 flex-none" />
                        ) : (
                          <button
                            onClick={async () => { await markServed(o.id, !it.served, i); onChanged(); }}
                            aria-pressed={!!it.served}
                            aria-label={t(T.serveAria)}
                            className={`grid h-6 w-6 flex-none place-items-center rounded-full border text-xs transition ${it.served ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 text-transparent hover:border-amber-400"}`}
                          >
                            ✓
                          </button>
                        )}
                        <span className={`min-w-0 flex-1 ${it.cancelled ? "text-ink-faint line-through" : it.served ? "text-amber-700" : "text-ink"}`}>
                          {it.name_zh} <span className="text-ink-faint">×{it.qty}</span>{(it.note || it.adjust) && <span className="ml-1 text-xs text-gold">· {it.note || "加价"}{it.adjust ? ` ${it.adjust >= 0 ? "+" : "−"}$${Math.abs(it.adjust).toFixed(2)}` : ""}</span>}
                        </span>
                        {it.market && !(Number(it.price) > 0) ? (
                          <span className="flex-none rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">{t(T.marketPending)}</span>
                        ) : (
                          <span className="flex-none text-ink-soft">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                        )}
                        {/* cancel — destructive, small + muted + far from the serve toggle */}
                        {!it.cancelled && (
                          <button onClick={async () => { await cancelOrderItem(o.id, i); onChanged(); }} aria-label={t(T.cancelItem)} className="flex-none px-1 text-xs text-ink-faint/50 hover:text-red-600">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-wash text-3xl">🍽️</div>
                  <div className="mt-4 text-base font-semibold text-ink">{t(T.empty)}</div>
                  <div className="mt-1 text-sm text-ink-faint">{t(T.emptyHint)}</div>
                  <button onClick={() => setOrdering(true)} className="btn-primary mt-6 px-8">＋ {t(T.order)}</button>
                </div>
              )}

              {/* Today's settled checkouts collapse behind one button (a busy
                  table can settle many times a day; the full list drowned the
                  sheet). Tap → modal with per-order detail. */}
              {history.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setPaidView(true)}
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-slate-200 px-3 text-sm text-ink-soft transition hover:bg-slate-50"
                  >
                    <span className="font-medium">🧾 {t(T.paidBtn).replace("{n}", String(history.length))}</span>
                    <span className="tabular-nums font-semibold text-ink">{fmtPrice(paidSum)} ›</span>
                  </button>
                </div>
              )}
            </div>

            {/* Occupied → 加单 + 结账 in the footer. Empty → the CTA lives in the
                centered empty state above, so no footer (no marooned bottom button). */}
            {state(sel)?.hasOrder && (
              <div className="border-t border-slate-100 p-4">
                {/* 整桌出餐 — toggles both ways: serve all, or (when all served) un-serve all */}
                {(() => {
                  const active = state(sel)!.orders.flatMap((o) => (o.items ?? []).filter((it: OrderItem & { cancelled?: boolean }) => !it.cancelled));
                  const allDone = active.length > 0 && active.every((it: OrderItem & { served?: boolean }) => it.served);
                  return (
                    <button
                      onClick={async () => { await Promise.all(state(sel)!.orders.map((o) => markServed(o.id, !allDone))); onChanged(); }}
                      className="mb-2 min-h-11 w-full rounded-lg border border-amber-400 bg-amber-50 font-medium text-amber-700 transition hover:bg-amber-100"
                    >
                      {allDone ? t(T.unserveTable) : t(T.serveTable)}
                    </button>
                  );
                })()}
                <div className="flex flex-wrap gap-2">
                <button onClick={() => setOrdering(true)} className="min-h-11 rounded-lg border border-brand px-4 font-medium text-brand-ink transition hover:bg-brand-wash">
                  {t(T.addRound)}
                </button>
                <button
                  onClick={async () => { await requestBill(state(sel)!.orders.map((o) => o.id)).catch(() => {}); alert(t(T.billSent)); }}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-ink-soft transition hover:bg-slate-50"
                >
                  🖨️ {t(T.printBill)}
                </button>
                <button onClick={() => beginCheckout(state(sel)!)} className="btn-primary min-w-[8rem] flex-1">{t(T.checkout)} · {fmtPrice(state(sel)!.total)}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paid-today detail modal — this table's settled checkouts for the
          current business day; each row expands to its dishes. */}
      {paidView && sel && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => setPaidView(false)}>
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-ink">{t(T.paidToday)} · {displayTable(sel)}</h3>
                <p className="text-xs text-ink-faint">{history.length} · {fmtPrice(paidSum)}</p>
              </div>
              <button onClick={() => setPaidView(false)} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-lg text-xl leading-none text-ink-faint hover:bg-slate-50">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {history.length === 0 ? (
                <div className="py-12 text-center text-sm text-ink-faint">{t(T.paidNone)}</div>
              ) : (
                history.map((h) => {
                  const open = expanded === h.id;
                  const items = expandedItems[h.id];
                  return (
                    <div key={h.id} className="border-b border-slate-50 last:border-0">
                      <button onClick={() => openSession(h.id)} className="flex w-full items-center justify-between gap-2 px-2 py-3 text-left hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="text-sm font-medium text-ink">{new Date(h.closed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="ml-2 text-xs text-ink-faint">{t(T[`m_${h.payment_method}`] ?? T.m_other)}</span>
                          {!open && <span className="ml-2 text-xs text-ink-faint">· {t(T.tapForItems)}</span>}
                        </span>
                        <span className="flex flex-none items-center gap-2">
                          <span className="tabular-nums font-semibold text-ink">{fmtPrice(h.total)}</span>
                          <span className={`text-ink-faint transition ${open ? "rotate-90" : ""}`}>›</span>
                        </span>
                      </button>
                      {open && (
                        <div className="px-2 pb-3">
                          {items === undefined ? (
                            <div className="py-2 text-center text-xs text-ink-faint">…</div>
                          ) : items.length === 0 ? (
                            <div className="py-2 text-center text-xs text-ink-faint">{t(T.noItems)}</div>
                          ) : (
                            <div className="divide-y divide-slate-50 rounded-lg bg-slate-50/60 px-3">
                              {items.map((it, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                                  <span className="min-w-0 text-ink">{it.name_zh || it.name_en} <span className="text-ink-faint">×{it.qty}</span></span>
                                  <span className="flex-none tabular-nums text-ink-soft">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between py-1.5 text-sm font-semibold text-ink">
                                <span>{t(T.checkout)}</span>
                                <span className="tabular-nums">{fmtPrice(h.total)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {ordering && sel && (
        <StaffOrderPicker slug={slug} tableNo={sel} onClose={() => setOrdering(false)} onPlaced={() => { setOrdering(false); onChanged(); }} />
      )}

      {checkout && sel && state(sel)?.hasOrder && (
        <CheckoutModal
          slug={slug}
          tableNo={sel}
          orders={state(sel)!.orders}
          trackPayments={trackPayments}
          onClose={() => setCheckout(false)}
          onDone={() => { setCheckout(false); setSel(null); onChanged(); }}
        />
      )}
    </>
  );
}
