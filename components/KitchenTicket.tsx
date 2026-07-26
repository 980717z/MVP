"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/orders";
import { displayTable } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

// Trilingual copy for the SURROUNDING CHROME only (control bar: font-size dial,
// print, close). The ticket BODY (店名/后厨备餐单/badges/备注/份 …) mirrors the
// physical Chinese thermal printout and is deliberately left untranslated.
const T: Record<string, Dict> = {
  fontSize: { en: "Size", zh: "字号", fr: "Taille" },
  scaleL: { en: "L", zh: "大", fr: "G" },
  scaleXL: { en: "XL", zh: "特大", fr: "TG" },
  scaleXXL: { en: "XXL", zh: "超大", fr: "TTG" },
  print: { en: "🖨️ Print", zh: "🖨️ 打印", fr: "🖨️ Imprimer" },
  close: { en: "Close", zh: "关闭", fr: "Fermer" },
};

// Big-font kitchen ticket preview, sized to 80mm thermal paper (Epson TM-T88VI).
// Large type by default so an older chef reads it at a glance; the 字号 dial
// bumps it further. Also print-friendly: 打印 fires the browser print dialog
// scoped to just the ticket (a fallback until Epson Server Direct Print is wired).

const SCALES = [
  { k: "大", labelKey: "scaleL", mul: 1 },
  { k: "特大", labelKey: "scaleXL", mul: 1.18 },
  { k: "超大", labelKey: "scaleXXL", mul: 1.36 },
] as const;

function orderTypeLine(o: Order): { badge: string; sub?: string } {
  const t = (o as any).order_type ?? "dine_in";
  if (t === "delivery") return { badge: "🛵 配送 DELIVERY", sub: addr(o) };
  if (t === "togo") return { badge: "🛍️ 自取 TAKEOUT" };
  if (t === "pickup") {
    const at = (o as any).requested_pickup_at as string | null | undefined;
    return {
      badge: `🚚 取餐 PICKUP${o.pickup_code ? ` · ${o.pickup_code}` : ""}`,
      // the line the cook plans around: when the customer said they'll arrive
      sub: at ? `🕐 ${new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 来取 PICKUP TIME` : undefined,
    };
  }
  return { badge: o.table_no ? `堂食 · 桌 ${displayTable(o.table_no)}` : "堂食 DINE-IN" };
}

function addr(o: Order): string | undefined {
  const a = (o as any).address;
  if (!a) return undefined;
  return [a.street, a.unit, a.city, a.postal].filter(Boolean).join(" ");
}

function fmtPhone(p: string) {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

function ago(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function KitchenTicket({ order, shopName, onClose }: { order: Order; shopName: string; onClose: () => void }) {
  const { t } = useLang();
  const [scaleIdx, setScaleIdx] = useState(0);

  useEffect(() => {
    try {
      const s = Number(localStorage.getItem("bento_ticket_scale"));
      if (s >= 0 && s < SCALES.length) setScaleIdx(s);
    } catch {
      /* ignore */
    }
  }, []);

  const setScale = (i: number) => {
    setScaleIdx(i);
    try {
      localStorage.setItem("bento_ticket_scale", String(i));
    } catch {
      /* ignore */
    }
  };

  const mul = SCALES[scaleIdx].mul;
  const type = orderTypeLine(order);
  const isDelivery = (order as any).order_type === "delivery";
  // cancelled items never show on the ticket
  const items = order.items.filter((it: any) => !it.cancelled);
  const count = items.reduce((a, it) => a + (Number(it.qty) || 0), 0);

  // px sizes scale with the dial. 80mm ≈ 302px @96dpi; we render a touch wider for on-screen legibility.
  const s = (base: number) => Math.round(base * mul);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-auto bg-black/50 p-4" onClick={onClose}>
      {/* print-only stylesheet: show just the ticket, at 80mm */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .kt-print, .kt-print * { visibility: visible !important; }
        .kt-print { position: absolute; left: 0; top: 0; width: 80mm; box-shadow: none !important; }
        .kt-noprint { display: none !important; }
      }`}</style>

      {/* controls */}
      <div className="kt-noprint mb-3 flex items-center gap-2 rounded-full bg-white/95 px-2 py-1.5 shadow" onClick={(e) => e.stopPropagation()}>
        <span className="pl-2 text-xs font-medium text-ink-soft">{t(T.fontSize)}</span>
        <div className="flex rounded-full bg-slate-100 p-0.5">
          {SCALES.map((sc, i) => (
            <button
              key={sc.k}
              onClick={() => setScale(i)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${scaleIdx === i ? "bg-jade text-white" : "text-ink-soft"}`}
            >
              {t(T[sc.labelKey])}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()} className="rounded-full bg-jade px-4 py-1.5 text-sm font-bold text-white">{t(T.print)}</button>
        <button onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-ink-soft hover:bg-slate-100">{t(T.close)}</button>
      </div>

      {/* the ticket */}
      <div
        className="kt-print w-[320px] flex-none rounded-sm bg-white p-4 text-black shadow-2xl"
        style={{ fontFamily: '"Noto Sans SC", ui-monospace, monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center font-bold" style={{ fontSize: s(20) }}>{shopName}</div>
        <div className="text-center font-semibold" style={{ fontSize: s(14) }}>后厨备餐单</div>

        {/* order type — the biggest, first thing the chef sees */}
        <div className="my-2 border-y-2 border-dashed border-black py-2 text-center font-extrabold" style={{ fontSize: s(26) }}>
          {type.badge}
        </div>

        <div className="flex items-center justify-between font-semibold" style={{ fontSize: s(13) }}>
          <span>#{order.id.slice(0, 5).toUpperCase()}</span>
          <span>{ago(order.created_at)}</span>
        </div>

        {/* delivery: phone + address, large */}
        {isDelivery && (
          <div className="mt-1 border-t border-black pt-1" style={{ fontSize: s(15) }}>
            <div className="font-bold">📞 {fmtPhone(order.phone)}</div>
            {type.sub && <div className="font-semibold leading-tight">📍 {type.sub}</div>}
          </div>
        )}
        {(order as any).order_type === "togo" && order.phone && (
          <div className="mt-1 font-bold" style={{ fontSize: s(15) }}>📞 {fmtPhone(order.phone)}</div>
        )}

        {/* items — qty is huge and unmissable */}
        <div className="my-2 border-t-2 border-black pt-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-start gap-2 border-b border-dotted border-slate-300 py-2 last:border-0">
              <span className="flex-none font-extrabold leading-none" style={{ fontSize: s(30), minWidth: s(40) }}>
                ×{it.qty}
              </span>
              <span className="flex-1 font-bold leading-tight" style={{ fontSize: s(22) }}>
                {it.name_zh}
                {it.name_en && <span className="block font-normal leading-tight" style={{ fontSize: s(13) }}>{it.name_en}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* note — boxed so it can't be missed */}
        {order.note && (
          <div className="my-2 border-2 border-black p-2 font-bold leading-tight" style={{ fontSize: s(18) }}>
            ⚠ 备注：{order.note}
          </div>
        )}

        <div className="mt-2 border-t-2 border-dashed border-black pt-2 text-center font-bold" style={{ fontSize: s(15) }}>
          共 {count} 份
        </div>
      </div>
    </div>
  );
}
