"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle } from "@/app/i18n";
import { PRICING_FAQ } from "./faq";
import { BentoMark } from "@/components/BentoMark";

// ─────────────────────────────────────────────────────────────────────────
//  Public pricing is intentionally HIDDEN: BentoOS sells personalized
//  solutions, quoted per shop. This page shows NO dollar amounts — it explains
//  the personalized model, the differentiators (no bundled POS, hardware at
//  cost, commission-free), the launch offer, and routes people to email or
//  /get-started. The only comparative claim lives on the websites line, kept
//  generic ("~half the cost of a hosted store platform") — no competitor names.
// ─────────────────────────────────────────────────────────────────────────

const T = {
  nav: {
    login: { zh: "登录", en: "Log in", fr: "Connexion" },
    enter: { zh: "进入后台", en: "Dashboard", fr: "Tableau de bord" },
  },
  promo: { zh: "🎁 开业优惠：免费上门配置 + 首月免费", en: "🎁 Launch offer: free setup + first month free", fr: "🎁 Offre de lancement : installation gratuite + premier mois offert" },
  badge: { zh: "量身定制 · 按店报价", en: "Personalized · quoted per shop", fr: "Sur mesure · tarif par commerce" },
  title: {
    lead: { zh: "你的店独一无二，", en: "Your shop is one of a kind. ", fr: "Votre commerce est unique. " },
    hi: { zh: "你的系统也是", en: "So is your system", fr: "Votre système aussi" },
  },
  sub: {
    zh: "BentoOS 不卖千篇一律的套餐，也不逼你买一整套 POS 或专用机器。我们按你的店拼装模块——扫码点餐、厨房出票、对账、会员——用你现有的设备就能跑，再给出匹配你规模的报价。零抽成、无合同。",
    en: "BentoOS doesn't sell one-size-fits-all plans — and doesn't make you buy a bundled POS or proprietary hardware. We assemble your system from the modules you need — QR ordering, kitchen tickets, reconciliation, members — running on the devices you already have, then quote a price that fits your size. No commission, no contract, no lock-in.",
    fr: "BentoOS ne vend pas de forfaits uniformes — et ne vous oblige pas à acheter une caisse ou du matériel propriétaire. Nous assemblons votre système à partir des modules dont vous avez besoin — commande QR, tickets cuisine, rapprochement, membres — sur les appareils que vous avez déjà, avec un tarif adapté à votre taille. Sans commission, sans contrat, sans enfermement.",
  },
  points: [
    {
      icon: "🍱",
      title: { zh: "按需拼装", en: "Built from modules", fr: "Assemblé sur mesure" },
      body: {
        zh: "只为你用得上的模块付费——一家奶茶店和一家海鲜酒楼，不该是同一个价。",
        en: "Pay only for the modules you use — a bubble-tea stand and a seafood house shouldn't cost the same.",
        fr: "Payez seulement les modules que vous utilisez — un comptoir à thé et un restaurant de fruits de mer ne devraient pas coûter pareil.",
      },
    },
    {
      icon: "🔓",
      title: { zh: "不绑定 POS 或硬件", en: "No bundled POS or hardware", fr: "Sans caisse ni matériel imposé" },
      body: {
        zh: "不像那些捆绑式 POS 系统把你锁在他们的机器上。想要打印机等硬件？按成本价采购市面最好的，不加价。",
        en: "Unlike the big bundled POS systems, we don't lock you to their machines. Want hardware like a printer? We source the best on the market at cost — no markup.",
        fr: "Contrairement aux gros systèmes de caisse tout-en-un, nous ne vous enfermons pas dans leurs machines. Besoin de matériel ? Au prix coûtant, sans marge.",
      },
    },
    {
      icon: "🔒",
      title: { zh: "零抽成承诺", en: "Commission-free promise", fr: "Promesse sans commission" },
      body: {
        zh: "我们永远不按订单抽成——每一单收入 100% 归你。",
        en: "We will never take a cut of your orders — 100% of every order is yours.",
        fr: "Nous ne prendrons jamais de commission — 100% de chaque commande vous revient.",
      },
    },
  ],
  webTitle: { zh: "也做网站和网上下单", en: "Websites & online ordering too", fr: "Sites et commande en ligne aussi" },
  webBody: {
    zh: "想要自己的网站或网上商店？我们按你的店定制，通常只要主流建站平台一半左右的价钱。",
    en: "Want your own website or online store? We build it custom to your shop — typically about half the cost of a hosted store platform.",
    fr: "Vous voulez votre propre site ou boutique en ligne ? Nous le créons sur mesure — généralement environ la moitié du coût d'une plateforme de boutique hébergée.",
  },
  ctaTitle: { zh: "想知道你的店需要多少？", en: "Curious what it'd cost for your shop?", fr: "Curieux du tarif pour votre commerce ?" },
  ctaStart: { zh: "开始使用", en: "Get started", fr: "Commencer" },
  ctaTalk: { zh: "联系我们获取报价", en: "Contact us for pricing", fr: "Contactez-nous pour un tarif" },
  faqTitle: { zh: "常见问题", en: "Questions", fr: "Questions" },
  footer: {
    zh: "为中小商家打造的轻量管理系统",
    en: "A lightweight back-office for small businesses",
    fr: "Un back-office léger pour les petits commerces",
  },
};

export default function Pricing() {
  const { t } = useLang();
  const { session } = useAuth();
  const href = session ? "/app" : "/get-started";

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* soft pastel background washes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 -left-32 h-[34rem] w-[34rem] rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <BentoMark className="h-8 w-8 shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-slate-900">BentoOS</span>
        </Link>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link href={href} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {session ? t(T.nav.enter) : t(T.nav.login)}
          </Link>
        </div>
      </header>

      {/* heading */}
      <section className="mx-auto max-w-3xl px-6 pt-10 text-center sm:pt-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
          {t(T.promo)}
        </div>
        <div className="mb-5 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t(T.badge)}
          </div>
        </div>
        <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          {t(T.title.lead)}
          <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">{t(T.title.hi)}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg">{t(T.sub)}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="mailto:support@bentoos.io?subject=BentoOS%20pricing"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
          >
            {t(T.ctaTalk)}
            <span aria-hidden>→</span>
          </a>
          <Link
            href={href}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t(T.ctaStart)}
          </Link>
        </div>
      </section>

      {/* what's included */}
      <section className="mx-auto mt-14 grid max-w-5xl gap-5 px-6 sm:grid-cols-3">
        {T.points.map((p) => (
          <div key={p.title.en} className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-xl">{p.icon}</span>
            <div className="mt-3 font-semibold text-slate-900">{t(p.title)}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(p.body)}</p>
          </div>
        ))}
      </section>

      {/* websites — generic ~half-cost comparison, no competitor named */}
      <section className="mx-auto mt-6 max-w-5xl px-6">
        <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/70 to-white p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky-100 text-xl">🌐</span>
            <div>
              <div className="font-semibold text-slate-900">{t(T.webTitle)}</div>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">{t(T.webBody)}</p>
            </div>
          </div>
          <span className="flex-none rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">≈ ½ the cost</span>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-14 max-w-3xl px-6 pb-24">
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">{t(T.faqTitle)}</h2>
        <div className="mt-6 space-y-3">
          {PRICING_FAQ.map((item) => (
            <div key={item.q.en} className="rounded-2xl border border-slate-100 bg-white/70 p-5 text-left backdrop-blur">
              <div className="font-semibold text-slate-800">{t(item.q)}</div>
              <p className="mt-1 text-sm text-slate-600">{t(item.a)}</p>
            </div>
          ))}
        </div>

        {/* closing CTA */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-bold tracking-tight text-slate-900">{t(T.ctaTitle)}</h3>
          <a
            href="mailto:support@bentoos.io?subject=BentoOS%20pricing"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
          >
            {t(T.ctaTalk)}
            <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
          <span className="inline-flex items-center gap-1.5"><BentoMark className="h-4 w-4" /> BentoOS · {t(T.footer)}</span>
          <div className="flex items-center gap-4">
            <a href="mailto:support@bentoos.io" className="transition hover:text-slate-600">support@bentoos.io</a>
            <span>© 2026 BentoOS</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
