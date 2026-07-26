"use client";

// ─────────────────────────────────────────────────────────────────────────
//  "See it in action" — the student flow as 4 phone frames:
//    ① choose a truck (directory) → ② see its menu → ③ order ahead → ④ skip line
//  Faithful reproductions of the real diner screens (app/eat directory idea +
//  app/menu/[tenant] + app/order/[id]) with SYNTHETIC data for made-up vendors.
//  Every screen string renders SINGLE-language (native); the campus menu omits FR
//  so the SCREENS fall back to EN when the landing is French, while the section
//  chrome follows the landing language (keeps FR). Diner brand jade/paper
//  (DESIGN.md), framed in phone mocks. No real shop shown (fulai anonymized).
// ─────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useLang, type Dict, type Lang } from "@/app/i18n";

const JADE = "#117A65";
const PAPER = "#FAF7F2";
const HAIR = "#ECE7DF";

type Tri = { zh: string; en: string; fr?: string };
const pick = (b: Tri, lang: Lang) => (lang === "zh" ? b.zh : lang === "fr" ? b.fr ?? b.en : b.en);

const T = {
  eyebrow: { zh: "顾客扫码后看到的界面", en: "What your customers see", fr: "Ce que vos clients voient" },
  title: { zh: "挑一家,提前下单,到店即取", en: "Pick a truck. Order ahead. Skip the line.", fr: "Choisissez un camion. Commandez à l'avance. Passez devant la file." },
  sub: {
    zh: "一处浏览全部餐车,从手机下单,做好推送通知你,凭取餐号拿了就走,无需排队。",
    en: "Browse every campus truck in one place, order from your phone, get a ping when it's ready, show your pickup code and go. No lineup.",
    fr: "Parcourez tous les camions du campus, commandez depuis votre téléphone, recevez une alerte quand c'est prêt, montrez votre code et repartez.",
  },
  viewLive: { zh: "去看看真实页面 →", en: "See it live →", fr: "Voir en direct →" },
  cap1: { zh: "① 一处浏览全部餐车", en: "① Browse every truck in one place", fr: "① Parcourez tous les camions" },
  cap2: { zh: "② 点开一家看菜单", en: "② Tap a truck, see the menu", fr: "② Ouvrez un camion, voyez le menu" },
  cap3: { zh: "③ 提前下单,做好通知你", en: "③ Order ahead, get notified", fr: "③ Commandez à l'avance, soyez averti" },
  cap4: { zh: "④ 凭码取餐,免排队", en: "④ Show your code, skip the line", fr: "④ Montrez votre code, sautez la file" },
  disclaimer: {
    zh: "示意界面 · 合成数据(示例餐车)",
    en: "Illustrative screens · synthetic data (sample vendors)",
    fr: "Vues illustratives · données synthétiques (exemples)",
  },

  // ── in-screen strings ──
  vendor: { zh: "校园餐车", en: "Campus Eats", fr: "Campus Eats" },
  banner: { zh: "🚚 到餐车取餐 · 做好后通知你", en: "🚚 Pick up at the truck · we'll ping you when it's ready", fr: "🚚 Ramassage au camion · on vous prévient" },
  search: { zh: "搜索菜品", en: "Search the menu", fr: "Rechercher au menu" },
  category: { zh: "招牌饭", en: "Rice bowls", fr: "Bols de riz" },
  order: { zh: "下单", en: "Order", fr: "Commander" },
  codeLabel: { zh: "取餐号", en: "Your pickup code", fr: "Votre code de ramassage" },
  preparing: { zh: "制作中 · 约 4 分钟", en: "Preparing · ~4 min", fr: "En préparation · ~4 min" },
  ready: { zh: "✅ 可以取餐啦!", en: "✅ Ready, come pick up!", fr: "✅ Prêt, venez chercher!" },
  notify: { zh: "🔔 做好通知我", en: "🔔 Notify me when it's ready", fr: "🔔 Prévenez-moi quand c'est prêt" },
  footer: { zh: "🚚 到餐车取餐", en: "🚚 Pick up at the truck", fr: "🚚 Ramassage au camion" },
} satisfies Record<string, Dict>;

// directory-screen strings (zh/en — campus menu omits FR, so fr never used here)
const S = {
  dirTitle: { zh: "今天吃什么", en: "What to eat today" },
  dirLoc: { zh: "圣乔治校区 · 11:45 · 6 家营业中", en: "St. George · 11:45 · 6 open now" },
  fOpen: { zh: "营业中", en: "Open now" },
  fUnder: { zh: "$10 以下", en: "Under $10" },
  fVeg: { zh: "素食", en: "Veg" },
  open: { zh: "营业中", en: "Open" },
  soldout: { zh: "已售完", en: "Sold out" },
  week: { zh: "本周校园 1,240 单", en: "1,240 orders on campus this week" },
} satisfies Record<string, Tri>;

const ITEMS: (Tri & { price: string })[] = [
  { zh: "招牌鸡肉饭", en: "Signature Chicken Rice Bowl", fr: "Bol de riz au poulet signature", price: "12.99" },
  { zh: "红烧牛肉饭", en: "Braised Beef Rice Bowl", fr: "Bol de riz au bœuf braisé", price: "13.99" },
  { zh: "麻婆豆腐饭", en: "Mapo Tofu Rice Bowl", fr: "Bol de riz mapo tofu", price: "11.49" },
];
const CODE = "A47";
const STEPS: Tri[] = [
  { zh: "已接单", en: "Received", fr: "Reçu" },
  { zh: "制作中", en: "Preparing", fr: "En prép." },
  { zh: "可取餐", en: "Ready", fr: "Prêt" },
  { zh: "已取餐", en: "Picked up", fr: "Récupéré" },
];
type Truck = { emoji: string; name: string; cuisine: Tri; price: string; eta?: string; sold?: boolean; tag?: Tri; orders?: number };
const TRUCKS: Truck[] = [
  { emoji: "🍱", name: "Campus Eats", cuisine: { zh: "招牌饭", en: "Rice bowls" }, price: "$", eta: "4", orders: 142 },
  { emoji: "🌮", name: "Taco Stand", cuisine: { zh: "墨西哥", en: "Mexican" }, price: "$", eta: "3", tag: { zh: "清真", en: "Halal" } },
  { emoji: "🍜", name: "Seoul Bowl", cuisine: { zh: "韩式", en: "Korean" }, price: "$$", eta: "6" },
  { emoji: "🍛", name: "Curry Cart", cuisine: { zh: "印度", en: "Indian" }, price: "$$", sold: true },
];
const itemsCount = (n: number, lang: "zh" | "en") => (lang === "zh" ? `${n} 件` : `${n} item${n !== 1 ? "s" : ""}`);

export default function StudentFlowFrames() {
  const { t, lang } = useLang();
  // Campus diner menu omits FR, so the SCREENS render zh/en only (fr → en). The
  // section chrome around them still follows the real landing language (keeps FR).
  const ml: "zh" | "en" = lang === "zh" ? "zh" : "en";
  const L = (b: Tri) => pick(b, ml);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="rise text-xs font-bold uppercase tracking-[0.15em] text-brand-ink">{t(T.eyebrow)}</div>
        <h2 className="rise mt-2 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl" style={{ animationDelay: "60ms" }}>{t(T.title)}</h2>
        <p className="rise mx-auto mt-3 max-w-xl text-balance text-ink-soft" style={{ animationDelay: "120ms" }}>{t(T.sub)}</p>
        <div className="rise mt-6" style={{ animationDelay: "180ms" }}>
          <Link
            href="/eat"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            {t(T.viewLive)}
          </Link>
        </div>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {[
          { cap: T.cap1, screen: <DirectoryScreen ml={ml} /> },
          { cap: T.cap2, screen: <BrowseScreen L={L} lang={ml} /> },
          { cap: T.cap3, screen: <TrackScreen step={2} L={L} lang={ml} /> },
          { cap: T.cap4, screen: <TrackScreen step={3} L={L} lang={ml} /> },
        ].map((c, i) => (
          <figure key={i} className="rise flex flex-col items-center" style={{ animationDelay: `${i * 80}ms` }}>
            <Phone>{c.screen}</Phone>
            <figcaption className="mt-4 text-center text-sm font-semibold text-ink">{t(c.cap)}</figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-ink-faint">{t(T.disclaimer)}</p>
    </section>
  );
}

function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[236px] rounded-[2rem] border-[7px] border-[#1c1e1d] bg-[#1c1e1d] shadow-[0_18px_40px_-18px_rgba(20,30,25,0.45)]">
      <div className="relative h-[452px] overflow-hidden rounded-[1.5rem]" style={{ background: PAPER, fontFamily: '"Noto Sans SC", system-ui, sans-serif' }}>
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-4 w-24 -translate-x-1/2 rounded-b-xl bg-[#1c1e1d]" />
        {children}
      </div>
    </div>
  );
}

// ── Screen ①: the directory — choose a truck (idea of app/eat) ──────────────
function DirectoryScreen({ ml }: { ml: "zh" | "en" }) {
  const L = (b: Tri) => pick(b, ml);
  const eta = (n: string) => (ml === "zh" ? `约 ${n} 分钟` : `~${n} min`);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-1.5 pt-6">
        <div className="text-[17px] font-extrabold tracking-tight text-ink">{L(S.dirTitle)}</div>
        <div className="mt-0.5 text-[10px] text-ink-faint">{L(S.dirLoc)}</div>
      </div>
      <div className="flex gap-1.5 px-4 pb-2 text-[9.5px]">
        <span className="rounded-full px-2 py-0.5 font-semibold text-white" style={{ background: JADE }}>{L(S.fOpen)}</span>
        <span className="rounded-full border px-2 py-0.5 text-ink-soft" style={{ borderColor: HAIR, background: "#fff" }}>{L(S.fUnder)}</span>
        <span className="rounded-full border px-2 py-0.5 text-ink-soft" style={{ borderColor: HAIR, background: "#fff" }}>{L(S.fVeg)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-3">
        {TRUCKS.filter((tr) => tr.orders).map((tr) => (
          <div key={tr.name} className="mb-1.5 flex items-center gap-2 rounded-xl border bg-white p-2 shadow-sm" style={{ borderColor: "#117A6533" }}>
            <div className="grid h-9 w-9 flex-none place-items-center rounded-lg text-lg" style={{ background: "#E7F1ED" }}>{tr.emoji}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-ink">{tr.name}</div>
              <div className="text-[10px] text-ink-faint">{L(tr.cuisine)} · {tr.price} · 🟢 {L(S.open)} · {eta(tr.eta!)}</div>
              <div className="text-[9.5px] font-semibold" style={{ color: JADE }}>🔥 {ml === "zh" ? `今日 ${tr.orders} 单` : `${tr.orders} orders today`}</div>
            </div>
          </div>
        ))}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: HAIR }}>
          {TRUCKS.filter((tr) => !tr.orders).map((tr, i, arr) => (
            <div key={tr.name} className={`flex items-center gap-2 px-2 py-2 ${i < arr.length - 1 ? "border-b" : ""} ${tr.sold ? "opacity-50" : ""}`} style={{ borderColor: "#F2EFE9" }}>
              <div className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[15px]" style={{ background: "#F3F0EA" }}>{tr.emoji}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-ink">{tr.name}</div>
                <div className="text-[9.5px] text-ink-faint">{L(tr.cuisine)} · {tr.price}{tr.tag ? ` · ${L(tr.tag)}` : ""}</div>
              </div>
              <div className="flex-none text-right text-[9.5px] font-semibold leading-tight" style={{ color: tr.sold ? "#b23b3b" : JADE }}>
                {tr.sold ? `🔴 ${L(S.soldout)}` : <>🟢 {L(S.open)}<br />{eta(tr.eta!)}</>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="m-3 rounded-lg px-3 py-2 text-center text-[10.5px] font-semibold text-white" style={{ background: JADE }}>{L(S.week)}</div>
    </div>
  );
}

// ── Screen ②: browse the menu (reproduces app/menu/[tenant]) ────────────────
function BrowseScreen({ L, lang }: { L: (b: Tri) => string; lang: "zh" | "en" }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-6 text-center">
        <div className="text-lg font-extrabold tracking-tight text-ink">{L(T.vendor)}</div>
      </div>
      <div className="px-4 py-2 text-center text-[11px] font-medium" style={{ background: "#E7F1ED", color: JADE }}>{L(T.banner)}</div>
      <div className="px-4 pt-3">
        <div className="rounded-lg border px-3 py-2 text-[11px] text-ink-faint" style={{ borderColor: HAIR, background: "#fff" }}>🔍 {L(T.search)}</div>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-hidden px-4">
        <div className="border-b pb-1 text-[13px] font-bold text-ink" style={{ borderColor: HAIR }}>{L(T.category)}</div>
        <div className="divide-y" style={{ borderColor: HAIR }}>
          {ITEMS.map((it) => (
            <div key={it.en} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold leading-tight text-ink">{L(it)}</div>
                <div className="mt-0.5 text-[12px] font-bold" style={{ color: JADE }}>${it.price}</div>
              </div>
              <div className="grid h-7 w-7 flex-none place-items-center rounded-full text-[15px] font-semibold text-white" style={{ background: JADE }}>+</div>
            </div>
          ))}
        </div>
      </div>
      <div className="m-3 flex items-center justify-between rounded-xl px-4 py-2.5 text-white" style={{ background: JADE }}>
        <span className="text-[12px] font-semibold">{itemsCount(2, lang)} · $26.98</span>
        <span className="text-[12px] font-bold">{L(T.order)} →</span>
      </div>
    </div>
  );
}

// ── Screen ③/④: pickup tracking (reproduces app/order/[id]) ─────────────────
function TrackScreen({ step, L, lang }: { step: 2 | 3; L: (b: Tri) => string; lang: "zh" | "en" }) {
  const ready = step >= 3;
  return (
    <div className="flex h-full flex-col px-3 pt-7">
      <div className="rounded-2xl border bg-white" style={{ borderColor: HAIR }}>
        <div className="border-b px-4 pb-4 pt-4 text-center" style={{ borderColor: HAIR }}>
          <div className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: JADE }}>{L(T.codeLabel)}</div>
          <div className="mt-0.5 text-5xl font-bold leading-none" style={{ color: JADE, fontVariantNumeric: "tabular-nums" }}>{CODE}</div>

          <div className="mt-4 flex items-start justify-between px-0.5">
            {STEPS.map((s, i) => {
              const n = i + 1;
              const on = n === step;
              const passed = n < step;
              return (
                <div key={s.en} className="flex flex-1 flex-col items-center gap-1">
                  <span className="grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold" style={on || passed ? { borderColor: JADE, background: JADE, color: "#fff" } : { borderColor: "#cbd5d1", color: "#8E948F" }}>
                    {passed ? "✓" : n}
                  </span>
                  <span className="px-0.5 text-center text-[8.5px] leading-tight" style={on ? { color: JADE, fontWeight: 600 } : { color: "#8E948F" }}>{L(s)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full" style={{ background: "#E7F1ED" }}>
            <div className="h-full rounded-full" style={{ width: `${((step - 1) / 3) * 100}%`, background: JADE }} />
          </div>

          <div className="mt-3">
            {ready ? (
              <p className="text-[13px] font-bold" style={{ color: JADE }}>{L(T.ready)}</p>
            ) : (
              <p className="text-[11px] font-medium text-ink-soft">{L(T.preparing)}</p>
            )}
          </div>

          {!ready && (
            <div className="mt-3 w-full rounded-xl border py-2 text-[11px] font-semibold" style={{ borderColor: "#117A6533", background: "#117A650d", color: JADE }}>{L(T.notify)}</div>
          )}
        </div>

        <div className="px-4 py-2.5">
          <div className="mb-1 text-[9px] font-semibold text-ink-faint">{itemsCount(2, lang)}</div>
          <div className="space-y-1">
            {ITEMS.slice(0, 2).map((it) => (
              <div key={it.en} className="truncate text-[11px] text-ink">{L(it)}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[9px] text-ink-soft" style={{ background: PAPER }}>{L(T.footer)}</div>
    </div>
  );
}
