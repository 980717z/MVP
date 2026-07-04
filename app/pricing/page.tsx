"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle } from "@/app/i18n";

// ─────────────────────────────────────────────────────────────────────────
//  Beta period: public pricing is intentionally HIDDEN. This page keeps the
//  /pricing URL alive (bookmarks, old links) but shows no dollar amounts —
//  it pitches the beta and routes people to /get-started or email.
// ─────────────────────────────────────────────────────────────────────────

const T = {
  nav: {
    login: { zh: "登录", en: "Log in", fr: "Connexion" },
    enter: { zh: "进入后台", en: "Dashboard", fr: "Tableau de bord" },
  },
  badge: { zh: "创始商家计划 · 名额有限", en: "Founding merchant program · limited spots", fr: "Programme commerçants fondateurs · places limitées" },
  title: {
    lead: { zh: "测试期免费，", en: "Free during beta. ", fr: "Gratuit pendant la bêta. " },
    hi: { zh: "收入全归你", en: "Keep 100% of your revenue", fr: "Gardez 100% de vos revenus" },
  },
  sub: {
    zh: "BentoOS 正在与创始商家一起打磨产品。测试期内全部功能免费使用，零抽成、无合同、无需专用设备。正式定价公布前，创始商家将获得永久优惠。",
    en: "BentoOS is being polished with a small group of founding merchants. Everything is free during beta — no commission, no contract, no hardware. Founding shops lock in preferred terms before public pricing launches.",
    fr: "BentoOS se perfectionne avec un petit groupe de commerçants fondateurs. Tout est gratuit pendant la bêta — sans commission, sans contrat, sans matériel. Les commerces fondateurs obtiennent des conditions préférentielles à vie.",
  },
  points: [
    {
      icon: "🍱",
      title: { zh: "全部模块", en: "Every module", fr: "Tous les modules" },
      body: {
        zh: "扫码点餐、厨房出票、菜单管理、对账、会员 —— 测试期全部开放。",
        en: "QR ordering, kitchen tickets, menu management, reconciliation, members — all open during beta.",
        fr: "Commande QR, tickets cuisine, gestion du menu, rapprochement, membres — tout est ouvert pendant la bêta.",
      },
    },
    {
      icon: "🤝",
      title: { zh: "白手套上线", en: "White-glove setup", fr: "Mise en place accompagnée" },
      body: {
        zh: "我们帮你录菜单、印桌码、接打印机，当天就能用。",
        en: "We enter your menu, print your table QRs, and hook up your printer — live the same day.",
        fr: "Nous saisissons votre menu, imprimons vos QR de table et connectons votre imprimante — en ligne le jour même.",
      },
    },
    {
      icon: "🔒",
      title: { zh: "零抽成承诺", en: "Commission-free promise", fr: "Promesse sans commission" },
      body: {
        zh: "我们永远不按订单抽成 —— 每一单收入 100% 归你。",
        en: "We will never take a cut of your orders — 100% of every order is yours.",
        fr: "Nous ne prendrons jamais de commission — 100% de chaque commande vous revient.",
      },
    },
  ],
  ctaTitle: { zh: "想成为创始商家？", en: "Want to be a founding merchant?", fr: "Envie de devenir commerçant fondateur ?" },
  ctaStart: { zh: "免费开始", en: "Get started free", fr: "Commencer gratuitement" },
  ctaTalk: { zh: "联系我们", en: "Talk to us", fr: "Contactez-nous" },
  faqTitle: { zh: "常见问题", en: "Questions", fr: "Questions" },
  faq: [
    {
      q: { zh: "测试期结束后会收费吗？", en: "Will it cost money after beta?", fr: "Y aura-t-il un coût après la bêta ?" },
      a: {
        zh: "会有一个简单透明的订阅价，公布前会提前通知你。创始商家锁定永久优惠，且永远零抽成。",
        en: "There will be a simple, transparent subscription. You'll be told well before it starts, founding shops keep preferred terms forever, and orders are never charged a commission.",
        fr: "Il y aura un abonnement simple et transparent. Vous serez prévenu à l'avance, les commerces fondateurs gardent leurs conditions à vie, et jamais de commission sur les commandes.",
      },
    },
    {
      q: { zh: "需要签合同吗？", en: "Is there a contract?", fr: "Y a-t-il un contrat ?" },
      a: {
        zh: "不需要。随时可以停用，你的数据随时可以导出带走。",
        en: "No. Leave anytime, and export your data whenever you want.",
        fr: "Non. Partez quand vous voulez, et exportez vos données à tout moment.",
      },
    },
    {
      q: { zh: "需要专用设备吗？", en: "Do I need special hardware?", fr: "Faut-il du matériel spécial ?" },
      a: {
        zh: "不需要。手机、平板、电脑都能用；小票打印机可选。",
        en: "No. It runs on any phone, tablet, or computer; a receipt printer is optional.",
        fr: "Non. Ça fonctionne sur tout téléphone, tablette ou ordinateur ; l'imprimante à reçus est optionnelle.",
      },
    },
  ],
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
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 text-base shadow-sm">🍱</span>
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
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t(T.badge)}
        </div>
        <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
          {t(T.title.lead)}
          <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">{t(T.title.hi)}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg">{t(T.sub)}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
          >
            {t(T.ctaStart)}
            <span aria-hidden>→</span>
          </Link>
          <a
            href="mailto:support@bentoos.io"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t(T.ctaTalk)}
          </a>
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

      {/* FAQ */}
      <section className="mx-auto mt-14 max-w-3xl px-6 pb-24">
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">{t(T.faqTitle)}</h2>
        <div className="mt-6 space-y-3">
          {T.faq.map((item) => (
            <div key={item.q.en} className="rounded-2xl border border-slate-100 bg-white/70 p-5 text-left backdrop-blur">
              <div className="font-semibold text-slate-800">{t(item.q)}</div>
              <p className="mt-1 text-sm text-slate-600">{t(item.a)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
          <span>🍱 BentoOS · {t(T.footer)}</span>
          <div className="flex items-center gap-4">
            <a href="mailto:support@bentoos.io" className="transition hover:text-slate-600">support@bentoos.io</a>
            <span>© 2026 BentoOS</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
