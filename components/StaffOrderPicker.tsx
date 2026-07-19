"use client";

import { useEffect } from "react";
import { displayTable } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

// Staff ordering reuses the REAL customer menu (in an iframe) so it's identical
// pixel-for-pixel — no separate picker to keep in sync. `?t=<table>` locks the
// order to the table (dine-in, phone optional); `?staff=1` makes the menu ping
// us when the order lands so we auto-close and refresh the tab.
const T: Record<string, Dict> = {
  title: { zh: "点单 · 桌", en: "Order · Table", fr: "Commander · Table" },
  titleTogo: { zh: "新建订单", en: "New order", fr: "Nouvelle commande" },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

/**
 * Two entry points, one ordering surface (design review D2):
 *   • `tableNo` → dine-in, locked to that table (`?t=`), opened from the floor plan.
 *   • `mode="togo"` → takeout/delivery (`?m=togo`), opened from 新建订单 on the
 *     orders page. The menu shows its own 自取/配送 chooser and address fields.
 * Both run the REAL customer menu, so staff see exactly what the diner sees and
 * there is no second picker to keep in sync.
 */
export default function StaffOrderPicker({
  slug,
  tableNo,
  mode = "dine",
  orderType,
  onClose,
  onPlaced,
}: {
  slug: string;
  tableNo?: string;
  mode?: "dine" | "togo";
  /** Preselects 自取 vs 配送 so staff aren't asked a question the tab they came
   *  from already answered. They can still switch inside the menu. */
  orderType?: "togo" | "delivery";
  onClose: () => void;
  /** `orderType` is what the menu actually created (togo / delivery / dine_in),
   *  so the caller can jump to the matching tab. Optional — the dine-in caller
   *  ignores it. */
  onPlaced: (orderType?: string) => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "bento-staff-order-placed") onPlaced(e.data.orderType);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onPlaced]);

  const src =
    mode === "togo"
      ? `/menu/${encodeURIComponent(slug)}?m=togo&staff=1${orderType ? `&type=${orderType}` : ""}`
      : `/menu/${encodeURIComponent(slug)}?t=${encodeURIComponent(tableNo ?? "")}&staff=1`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-base font-bold text-ink">
          {mode === "togo" ? t(T.titleTogo) : `${t(T.title)} ${displayTable(tableNo ?? "")}`}
        </span>
        <button onClick={onClose} aria-label={t(T.close)} className="grid h-10 w-10 place-items-center rounded-lg text-lg text-ink-faint hover:bg-slate-50">✕</button>
      </div>
      <iframe src={src} title="staff order" className="min-h-0 w-full flex-1 border-0" />
    </div>
  );
}
