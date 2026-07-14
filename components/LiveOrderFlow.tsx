"use client";

// utoronto landing "See it work": a REAL scannable QR of the Campus Eats pickup
// menu, and a looping mock of the truck's dashboard receiving the order live —
// scan → order lands with a ping. Brand: DESIGN-PLATFORM (emerald, warm neutrals).
import { useEffect, useState } from "react";
import { useLang, type Dict } from "@/app/i18n";

const DEMO_URL = "https://bentoos.io/menu/demo-truck?m=pickup";

const T = {
  eyebrow: { zh: "看它跑起来", en: "See it work", fr: "Voyez-le fonctionner" },
  title: { zh: "扫码下单,后台秒收", en: "Scan to order — the truck gets it instantly", fr: "Commandez en scannant — le camion reçoit aussitôt" },
  sub: {
    zh: "学生扫码提前下单,订单实时弹进餐车后台。这个码是真的——用手机扫扫看。",
    en: "A student scans, orders ahead, and it pops into the truck's dashboard in real time. This QR is live — scan it with your phone.",
    fr: "Un étudiant scanne, commande à l'avance, et ça apparaît dans le tableau de bord en temps réel. Ce code est réel — scannez-le.",
  },
  scanCaption: { zh: "扫码点单", en: "Scan to order", fr: "Scannez pour commander" },
  demoTag: { zh: "Campus Eats · 演示菜单", en: "Campus Eats · demo menu", fr: "Campus Eats · menu démo" },
  dashTitle: { zh: "取餐订单", en: "Pickup orders", fr: "Commandes à retirer" },
  live: { zh: "实时", en: "Live", fr: "En direct" },
  newOrder: { zh: "新订单", en: "New order", fr: "Nouvelle commande" },
  justNow: { zh: "刚刚", en: "just now", fr: "à l'instant" },
  code: { zh: "取餐号", en: "Pickup code", fr: "Code" },
  item1: { zh: "招牌鸡肉饭 ×1", en: "Chicken Rice Bowl ×1", fr: "Bol de poulet ×1" },
  item2: { zh: "珍珠奶茶(大)×1", en: "Bubble Milk Tea (L) ×1", fr: "Thé au lait perlé (G) ×1" },
  total: { zh: "合计", en: "Total", fr: "Total" },
  preparing: { zh: "制作中", en: "Preparing", fr: "En préparation" },
  prevItems: { zh: "红烧牛肉面 ×1 · 煎饺 ×1", en: "Beef Noodle ×1 · Dumplings ×1", fr: "Nouilles bœuf ×1 · Raviolis ×1" },
  minsAgo: { zh: "3 分钟前", en: "3 min ago", fr: "il y a 3 min" },
} satisfies Record<string, Dict>;

export default function LiveOrderFlow() {
  const { t } = useLang();
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((m) => {
        const QRCode = (m as { default?: unknown }).default ?? m;
        return (QRCode as { toDataURL: (u: string, o: object) => Promise<string> }).toDataURL(DEMO_URL, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#1A1D1B", light: "#ffffff" },
        });
      })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="rise text-xs font-bold uppercase tracking-[0.15em] text-brand-ink">{t(T.eyebrow)}</div>
        <h2 className="rise mt-2 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl" style={{ animationDelay: "60ms" }}>{t(T.title)}</h2>
        <p className="rise mx-auto mt-3 max-w-xl text-balance text-ink-soft" style={{ animationDelay: "120ms" }}>{t(T.sub)}</p>
      </div>

      <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
        {/* QR card */}
        <div className="rise flex flex-col items-center rounded-2xl border border-[#EBEAE5] bg-white p-5 shadow-sm sm:w-64" style={{ animationDelay: "160ms" }}>
          <div className="grid h-40 w-40 place-items-center overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
            {qr ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qr} alt={t(T.scanCaption)} className="h-full w-full" />
            ) : (
              <span className="text-xs text-ink-faint">…</span>
            )}
          </div>
          <div className="mt-3 text-sm font-bold text-ink">📷 {t(T.scanCaption)}</div>
          <div className="mt-0.5 text-xs text-ink-faint">{t(T.demoTag)}</div>
        </div>

        {/* connector (desktop): a dashed line with a travelling dot */}
        <div className="relative hidden h-px w-24 flex-none self-center sm:block" aria-hidden="true">
          <div className="absolute inset-0 border-t-2 border-dashed border-brand/30" />
          <div className="anim-dot absolute -top-[5px] left-0 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_3px_rgba(14,159,110,0.15)]" />
        </div>

        {/* merchant dashboard receiving the order */}
        <div className="rise w-full rounded-2xl border border-[#EBEAE5] bg-white p-4 shadow-sm sm:w-80" style={{ animationDelay: "220ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-bold text-ink">🚚 {t(T.dashTitle)}</div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold text-brand-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {t(T.live)}
            </span>
          </div>

          {/* the arriving order card */}
          <div className="anim-order relative rounded-xl border border-[#EBEAE5] bg-[#FBFAF8] p-3">
            {/* notification ping */}
            <span className="anim-ping pointer-events-none absolute -right-1 -top-1 h-6 w-6 rounded-full border-2 border-amber-400" />
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                <span className="anim-bell inline-block">🔔</span> {t(T.newOrder)}
              </span>
              <span className="pill bg-emerald-50 text-[13px] font-bold tracking-wider text-emerald-700">🎫 A47</span>
            </div>
            <div className="mt-2 space-y-0.5 text-sm text-ink">
              <div>{t(T.item1)}</div>
              <div>{t(T.item2)}</div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-[#ECE7DF] pt-2 text-xs">
              <span className="text-ink-faint">{t(T.justNow)}</span>
              <span className="font-semibold text-ink">{t(T.total)} $19.49</span>
            </div>
          </div>

          {/* a persistent older order so the board is never empty between loops */}
          <div className="mt-2 rounded-xl border border-[#EBEAE5] bg-white p-3 opacity-80">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                🍳 {t(T.preparing)}
              </span>
              <span className="pill bg-emerald-50 text-[13px] font-bold tracking-wider text-emerald-700">🎫 B12</span>
            </div>
            <div className="mt-1.5 text-sm text-ink">{t(T.prevItems)}</div>
            <div className="mt-1 text-xs text-ink-faint">{t(T.minsAgo)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
