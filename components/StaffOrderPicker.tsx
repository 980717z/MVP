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
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

export default function StaffOrderPicker({
  slug,
  tableNo,
  onClose,
  onPlaced,
}: {
  slug: string;
  tableNo: string;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e?.data?.type === "bento-staff-order-placed") onPlaced();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onPlaced]);

  const src = `/menu/${encodeURIComponent(slug)}?t=${encodeURIComponent(tableNo)}&staff=1`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-base font-bold text-ink">{t(T.title)} {displayTable(tableNo)}</span>
        <button onClick={onClose} aria-label={t(T.close)} className="grid h-10 w-10 place-items-center rounded-lg text-lg text-ink-faint hover:bg-slate-50">✕</button>
      </div>
      <iframe src={src} title="staff order" className="min-h-0 w-full flex-1 border-0" />
    </div>
  );
}
