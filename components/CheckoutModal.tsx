"use client";

import { useMemo, useState } from "react";
import { computeTax } from "@/lib/tax";
import { checkoutTable, type PaymentMethod } from "@/lib/tableSessions";
import { requestBill, type Order, type OrderItem } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

// Order-only mode (fulai launch): no payment anywhere. This modal becomes a
// payment-free "print the bill + clear the table" action. Flip PAYMENTS_LIVE=1
// to restore the cash/card checkout.
const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "1";

const T: Record<string, Dict> = {
  title: { zh: "结账", en: "Checkout", fr: "Encaisser" },
  clearTitle: { zh: "清台", en: "Clear table", fr: "Libérer" },
  clearNote: { zh: "无需收款 · 打印账单后清台", en: "No payment — prints the bill, then clears the table", fr: "Sans paiement — imprime l'addition puis libère la table" },
  clearConfirm: { zh: "打印账单 · 清台", en: "Print bill · clear table", fr: "Imprimer · libérer" },
  table: { zh: "桌", en: "Table", fr: "Table" },
  round: { zh: "第 {n} 单", en: "Round {n}", fr: "Tournée {n}" },
  subtotal: { zh: "小计", en: "Subtotal", fr: "Sous-total" },
  total: { zh: "合计", en: "Total", fr: "Total" },
  cash: { zh: "现金", en: "Cash", fr: "Comptant" },
  card: { zh: "刷卡", en: "Card", fr: "Carte" },
  other: { zh: "其他", en: "Other", fr: "Autre" },
  tendered: { zh: "收款", en: "Tendered", fr: "Reçu" },
  change: { zh: "找零", en: "Change", fr: "Monnaie" },
  exact: { zh: "刚好", en: "Exact", fr: "Exact" },
  short: { zh: "还差 {amt}", en: "Short {amt}", fr: "Manque {amt}" },
  confirm: { zh: "确认结账 · 打印总单", en: "Confirm · print bill", fr: "Confirmer · imprimer" },
  busy: { zh: "结账中…", en: "Checking out…", fr: "Encaissement…" },
  needPrice: { zh: "有时价菜品未录入价格，请先在订单里录入。", en: "A market-price item has no price yet — enter it on the order first.", fr: "Un article à prix du jour n'a pas de prix — saisissez-le d'abord." },
  failed: { zh: "结账失败：", en: "Checkout failed: ", fr: "Échec : " },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const activeItems = (o: Order) => (o.items ?? []).filter((it) => !(it as OrderItem & { cancelled?: boolean }).cancelled);

export default function CheckoutModal({
  slug,
  tableNo,
  orders,
  onClose,
  onDone,
}: {
  slug: string;
  tableNo: string;
  orders: Order[]; // the table's unpaid dine-in rounds
  onClose: () => void;
  onDone: () => void; // parent refreshes + closes
}) {
  const { t } = useLang();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { subtotal, hst, total, hasUnpriced } = useMemo(() => {
    let sub = 0;
    let unpriced = false;
    for (const o of orders)
      for (const it of activeItems(o)) {
        if (it.market && !(Number(it.price) > 0)) unpriced = true;
        sub += (Number(it.price) || 0) * (Number(it.qty) || 0);
      }
    const tax = computeTax(money(sub), false);
    return { subtotal: tax.subtotal, hst: money(tax.gst + tax.pst), total: tax.total, hasUnpriced: unpriced };
  }, [orders]);

  const tenderedNum = tendered === "" ? null : money(parseFloat(tendered));
  const change = method === "cash" && tenderedNum != null ? money(tenderedNum - total) : null;
  const shortBy = method === "cash" && tenderedNum != null && tenderedNum < total ? money(total - tenderedNum) : 0;

  const chips = Array.from(new Set([total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]))
    .map(money)
    .filter((v) => v >= total)
    .slice(0, 4);

  const canConfirm = !busy && !hasUnpriced && (!PAYMENTS_LIVE || method !== "cash" || (tenderedNum != null && tenderedNum >= total));

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setErr(null);
    // Order-only: settle as "other" with no tendered amount — the row still clears
    // the table + posts the day-book, it just carries no payment method/change.
    const res = PAYMENTS_LIVE
      ? await checkoutTable(slug, tableNo, method, method === "cash" ? tenderedNum : null)
      : await checkoutTable(slug, tableNo, "other", null);
    if (!res.ok) {
      setErr(res.needsPricing ? t(T.needPrice) : t(T.failed) + (res.error ?? ""));
      setBusy(false);
      return;
    }
    // print the merged table bill (queues for the Epson poll)
    await requestBill(orders.map((o) => o.id)).catch(() => {});
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`${t(T.title)} ${tableNo}`}>
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-base font-bold text-ink">{PAYMENTS_LIVE ? t(T.title) : t(T.clearTitle)} · {t(T.table)} {tableNo}</span>
          <button onClick={onClose} disabled={busy} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint hover:bg-slate-50">✕</button>
        </div>

        {/* bill */}
        <div className="max-h-52 overflow-auto px-4 py-3 text-sm">
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
        <div className="border-t border-slate-100 px-4 py-2.5 text-sm">
          <div className="flex justify-between py-0.5 text-ink-soft"><span>{t(T.subtotal)}</span><span>{fmtPrice(subtotal)}</span></div>
          <div className="flex justify-between py-0.5 text-ink-soft"><span>HST 13%</span><span>{fmtPrice(hst)}</span></div>
          <div className="mt-1 flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t(T.total)}</span><span>{fmtPrice(total)}</span></div>
        </div>

        {/* payment (hidden in order-only mode) */}
        <div className="border-t border-slate-100 px-4 py-3">
          {!PAYMENTS_LIVE && (
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-ink-soft">{t(T.clearNote)}</div>
          )}
          {PAYMENTS_LIVE && (<>
          <div className="mb-2.5 grid grid-cols-3 gap-1.5">
            {(["cash", "card", "other"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`min-h-11 rounded-lg border text-sm font-medium transition ${method === m ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`}
              >
                {t(T[m])}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {chips.map((v, i) => (
                  <button
                    key={v}
                    onClick={() => setTendered(String(v))}
                    className="min-h-11 flex-1 rounded-lg border border-slate-200 px-2 text-sm font-medium text-ink-soft hover:bg-slate-50"
                  >
                    {i === 0 ? t(T.exact) : `$${v}`}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-ink-soft">{t(T.tendered)}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  className="input min-h-11 flex-1"
                  placeholder={String(total)}
                />
                <span className="text-sm text-ink-soft">{t(T.change)}</span>
                <span className={`min-w-16 text-right text-lg font-bold ${shortBy > 0 ? "text-red-600" : "text-ink"}`}>
                  {shortBy > 0 ? t(T.short).replace("{amt}", fmtPrice(shortBy)) : fmtPrice(change ?? 0)}
                </span>
              </div>
            </>
          )}
          </>)}

          {hasUnpriced && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t(T.needPrice)}</div>}
          {err && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</div>}

          <button onClick={confirm} disabled={!canConfirm} className="btn-primary mt-3 w-full disabled:opacity-50">
            {busy ? t(T.busy) : PAYMENTS_LIVE ? t(T.confirm) : t(T.clearConfirm)}
          </button>
        </div>
      </div>
    </div>
  );
}
