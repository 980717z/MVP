"use client";

import { useEffect, useState } from "react";
import type { TableSpot } from "@/lib/store";
import { reprintOrder, cancelOrderItem, deleteOrder, setOrderStatus, updateOrderItems, type Order, type OrderItem } from "@/lib/orders";
import { listMenuItems } from "@/lib/menu";
import { tableOccupancy, listTableCheckouts, type TableState, type TableCheckout } from "@/lib/tableSessions";
import { price as fmtPrice, displayTable } from "@/lib/format";
import CheckoutModal from "@/components/CheckoutModal";
import StaffOrderPicker from "@/components/StaffOrderPicker";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  empty: { zh: "空桌", en: "Empty table", fr: "Table libre" },
  noOrder: { zh: "还没有订单", en: "No orders yet", fr: "Aucune commande" },
  emptyHint: { zh: "点单即可开台", en: "Take an order to open the table", fr: "Commander pour ouvrir la table" },
  round: { zh: "第 {n} 单", en: "Round {n}", fr: "Tournée {n}" },
  reprint: { zh: "重打厨房单", en: "Reprint kitchen", fr: "Réimprimer" },
  checkout: { zh: "结账", en: "Checkout", fr: "Encaisser" },
  m_cash: { zh: "现金", en: "Cash", fr: "Comptant" },
  m_card: { zh: "刷卡", en: "Card", fr: "Carte" },
  m_emt: { zh: "EMT", en: "EMT", fr: "Virement" },
  m_other: { zh: "其他", en: "Other", fr: "Autre" },
  m_split: { zh: "分单", en: "Split", fr: "Partagé" },
  order: { zh: "点单", en: "Take order", fr: "Commander" },
  addRound: { zh: "加单", en: "Add round", fr: "Ajouter" },
  paidHistory: { zh: "今日已结", en: "Paid today", fr: "Payé aujourd'hui" },
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
  onChanged,
}: {
  slug: string;
  orders: Order[]; // all orders (component filters to unpaid dine-in)
  tables: string[];
  layout: TableSpot[];
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useLang();
  const occ = tableOccupancy(orders);
  const [sel, setSel] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [history, setHistory] = useState<TableCheckout[]>([]);
  const now = Date.now();

  const byLabel = new Map(layout.map((l) => [l.label, l]));
  // Show every configured table; fall back to auto-grid for any without a layout entry.
  const spots = tables.map((label, i) => byLabel.get(label) ?? { label, ...autoGrid(i, tables.length), shape: "square" as const });

  useEffect(() => {
    if (sel) listTableCheckouts(slug, sel).then(setHistory).catch(() => setHistory([]));
    else setHistory([]);
  }, [sel, slug, orders]);

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
    s?.hasOrder
      ? "border-brand bg-brand-wash text-brand-ink"
      : "border-slate-200 bg-white text-ink-faint";

  return (
    <>
      {/* legend */}
      <div className="mb-3 flex items-center gap-4 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-200 bg-white" />{t(T.legendEmpty)}</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-brand bg-brand-wash" />{t(T.legendBusy)}</span>
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
              {s?.hasOrder && <span className="mt-1 text-xs font-semibold leading-none">{fmtPrice(s.total)} · {s.orders.length}单</span>}
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
              <span className="text-sm">{s?.hasOrder ? `${fmtPrice(s.total)} · ${s.orders.length}单` : t(T.empty)}</span>
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
                <span className={`text-xs ${state(sel)?.hasOrder ? "font-medium text-brand-ink" : "text-ink-faint"}`}>
                  {state(sel)?.hasOrder ? `${t(T.legendBusy)} · ${state(sel)!.orders.length}单` : t(T.legendEmpty)}
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
                        <button onClick={async () => { await reprintOrder(o.id); onChanged(); }} className="text-brand hover:underline">🖨️ {t(T.reprint)}</button>
                        <button onClick={async () => { if (confirm(t(T.confirmCancelOrder))) { await setOrderStatus(o.id, "cancelled"); onChanged(); } }} className="hover:text-red-600">{t(T.cancelOrder)}</button>
                        <button onClick={async () => { if (confirm(t(T.confirmDel))) { await deleteOrder(o.id); onChanged(); } }} className="hover:text-red-600">{t(T.del)}</button>
                      </span>
                    </div>
                    {(o.items ?? []).map((it: OrderItem & { cancelled?: boolean }, i: number) => (
                      <div key={i} className={`flex items-center justify-between py-0.5 text-sm ${it.cancelled ? "opacity-40" : ""}`}>
                        <span className={it.cancelled ? "text-ink-faint line-through" : "text-ink"}>{it.name_zh} <span className="text-ink-faint">×{it.qty}</span></span>
                        <span className="flex items-center gap-2">
                          {it.market && !(Number(it.price) > 0) ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">{t(T.marketPending)}</span>
                          ) : (
                            <span className="text-ink-soft">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                          )}
                          {!it.cancelled && (
                            <button onClick={async () => { await cancelOrderItem(o.id, i); onChanged(); }} className="text-xs text-ink-faint hover:text-red-600">{t(T.cancelItem)}</button>
                          )}
                        </span>
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

              {history.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{t(T.paidHistory)}</div>
                  {history.map((h) => (
                    <div key={h.id} className="flex justify-between py-0.5 text-xs text-ink-faint">
                      <span>{new Date(h.closed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {t(T[`m_${h.payment_method}`] ?? T.m_other)}</span>
                      <span>{fmtPrice(h.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Occupied → 加单 + 结账 in the footer. Empty → the CTA lives in the
                centered empty state above, so no footer (no marooned bottom button). */}
            {state(sel)?.hasOrder && (
              <div className="flex gap-2 border-t border-slate-100 p-4">
                <button onClick={() => setOrdering(true)} className="min-h-11 rounded-lg border border-brand px-4 font-medium text-brand-ink transition hover:bg-brand-wash">
                  {t(T.addRound)}
                </button>
                <button onClick={() => beginCheckout(state(sel)!)} className="btn-primary flex-1">{t(T.checkout)} · {fmtPrice(state(sel)!.total)}</button>
              </div>
            )}
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
          onClose={() => setCheckout(false)}
          onDone={() => { setCheckout(false); setSel(null); onChanged(); }}
        />
      )}
    </>
  );
}
