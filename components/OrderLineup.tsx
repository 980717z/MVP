"use client";

// The focus-mode right rail: ONE time-ordered queue of every in-progress order,
// oldest at the top, so the answer to "what do we fire next" is the first row.
//
// Deliberately COMPACT (two lines per order, no dish list): the rail's job is
// "who's next", and a full dish list would fit only 3-4 orders — at which point
// it stops being a queue and becomes a second copy of the orders list. Dishes
// are one tap away, and the kitchen ticket already carries them.
//
// Collapsed it becomes a 44px edge strip that still shows the count, so folding
// it away can never mean forgetting there are orders waiting.
import { useState } from "react";
import type { Order } from "@/lib/orders";
import { lineupOrders, lineupDestination } from "@/lib/lineup";
import { waitSince } from "@/lib/elapsed";
import { price as fmtPrice, displayTable } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { zh: "进行中", en: "In progress", fr: "En cours" },
  empty: { zh: "暂时没有待处理的单", en: "Nothing waiting right now", fr: "Rien en attente" },
  emptyHint: { zh: "新订单会自动排到这里,最久的在最上面。", en: "New orders queue here automatically, oldest on top.", fr: "Les nouvelles commandes s'ajoutent ici, la plus ancienne en haut." },
  collapse: { zh: "收起队列", en: "Collapse queue", fr: "Réduire la file" },
  expand: { zh: "展开队列", en: "Expand queue", fr: "Ouvrir la file" },
  table: { zh: "号桌", en: "Table ", fr: "Table " },
  togo: { zh: "自取", en: "Takeout", fr: "À emporter" },
  delivery: { zh: "外送", en: "Delivery", fr: "Livraison" },
  pickup: { zh: "取餐", en: "Pickup", fr: "Retrait" },
  noItems: { zh: "这单没有菜品明细", en: "No item detail", fr: "Aucun détail" },
};

export default function OrderLineup({
  orders,
  now,
  open,
  onToggle,
}: {
  orders: Order[];
  /** Ticking clock from the parent so every wait label advances together. */
  now: number;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState<string | null>(null); // order id whose dishes are open
  const queue = lineupOrders(orders);

  if (!open) {
    return (
      <button
        onClick={() => onToggle(true)}
        aria-label={t(T.expand)}
        aria-expanded={false}
        className="flex w-11 flex-none flex-col items-center gap-3 border-l border-[#EBEAE5] bg-white py-4 transition hover:bg-slate-50"
      >
        <span aria-hidden className="text-ink-faint">‹</span>
        {/* count stays visible while collapsed — folding the rail away must not
            mean losing track of how many orders are still waiting */}
        <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-xs font-bold tabular-nums ${queue.length > 0 ? "bg-warn-wash text-warn" : "bg-slate-100 text-ink-faint"}`}>
          {queue.length}
        </span>
        <span
          className="text-[11px] font-semibold tracking-wider text-ink-soft"
          style={{ writingMode: "vertical-rl" }}
        >
          {t(T.title)}
        </span>
      </button>
    );
  }

  const destLabel = (o: Order) => {
    const d = lineupDestination(o);
    if (d.kind === "dine") {
      const tbl = (o.table_no || "").trim();
      return tbl ? (lang === "zh" ? `${displayTable(tbl)}${t(T.table)}` : `${t(T.table)}${displayTable(tbl)}`) : t(T.togo);
    }
    return t(T[d.kind]);
  };

  return (
    <aside className="flex w-80 flex-none flex-col border-l border-[#EBEAE5] bg-white">
      <div className="flex flex-none items-center justify-between gap-2 border-b border-[#EBEAE5] px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-ink">
          {t(T.title)}
          <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${queue.length > 0 ? "bg-warn-wash text-warn" : "bg-slate-100 text-ink-faint"}`}>
            {queue.length}
          </span>
        </h2>
        <button
          onClick={() => onToggle(false)}
          aria-label={t(T.collapse)}
          aria-expanded
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-faint transition hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="text-sm font-medium text-ink-soft">{t(T.empty)}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{t(T.emptyHint)}</p>
          </div>
        ) : (
          queue.map((o) => {
            const isOpen = expanded === o.id;
            const active = (o.items ?? []).filter((it) => !(it as { cancelled?: boolean }).cancelled);
            const wait = waitSince(new Date(o.created_at).getTime(), now);
            return (
              <div key={o.id} className="border-b border-[#F3F2EE] last:border-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    {o.order_no && (
                      <span className="pill flex-none bg-ink px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">#{o.order_no}</span>
                    )}
                    <span aria-hidden className="flex-none text-sm">{lineupDestination(o).icon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{destLabel(o)}</span>
                    <span className={`flex-none text-xs transition ${isOpen ? "rotate-90" : ""} text-ink-faint`}>›</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 pl-0.5">
                    <span className="text-xs tabular-nums text-ink-soft">{wait}</span>
                    <span className="text-sm font-semibold tabular-nums text-ink">{fmtPrice(o.total)}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-[#FBFAF8] px-4 pb-3 pt-1">
                    {active.length === 0 ? (
                      <p className="py-1 text-xs text-ink-faint">{t(T.noItems)}</p>
                    ) : (
                      active.map((it, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-2 py-0.5 text-xs">
                          <span className="min-w-0 truncate text-ink-soft">
                            {it.name_zh} <span className="text-ink-faint">×{it.qty}</span>
                            {it.note && <span className="ml-1 text-gold">· {it.note}</span>}
                          </span>
                          <span className="flex-none tabular-nums text-ink-faint">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
