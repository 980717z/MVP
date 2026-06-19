"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle, type Dict } from "@/app/i18n";

type Period = "monthly" | "annual";

const T = {
  nav: {
    pricing: { zh: "价格", en: "Pricing", fr: "Tarifs" },
    login: { zh: "登录", en: "Log in", fr: "Connexion" },
    enter: { zh: "进入后台", en: "Dashboard", fr: "Tableau de bord" },
  },
  badge: { zh: "简单透明 · 无合同", en: "Simple & transparent · no contract", fr: "Simple et transparent · sans contrat" },
  title: {
    lead: { zh: "定价简单，", en: "Simple pricing. ", fr: "Tarifs simples. " },
    hi: { zh: "收入全归你", en: "Keep 100% of your revenue", fr: "Gardez 100% de vos revenus" },
  },
  sub: {
    zh: "零抽成、无合同、无需专用设备。每一单收入都归你自己。",
    en: "No commission, no contract, no hardware. Every order's revenue is yours.",
    fr: "Aucune commission, aucun contrat, aucun matériel. Chaque dollar de vos commandes vous revient.",
  },
  monthly: { zh: "按月", en: "Monthly", fr: "Mensuel" },
  annual: { zh: "按年", en: "Annual", fr: "Annuel" },
  save: { zh: "省 2 个月", en: "Save 2 months", fr: "2 mois offerts" },
  perMo: { zh: "/月", en: "/mo", fr: "/mois" },
  billedAnnually: { zh: "按年结算", en: "billed annually", fr: "facturé annuellement" },
  founder: {
    zh: "🎉 创始价：前 50 家门店锁定「标准版」$29/月，永久不涨。",
    en: "🎉 Founder pricing: first 50 shops lock Standard at $29/mo, forever.",
    fr: "🎉 Tarif fondateur : les 50 premiers commerces gardent Standard à 29 $/mois, à vie.",
  },
  comingSoon: { zh: "即将推出", en: "Coming soon", fr: "Bientôt" },
  payTitle: {
    zh: "直接收款：支付宝 · 微信支付 · Apple Pay",
    en: "Accept Alipay, WeChat Pay & Apple Pay directly",
    fr: "Acceptez Alipay, WeChat Pay et Apple Pay directement",
  },
  payBody: {
    zh: "用顾客习惯的方式收款，无需额外终端或第三方平台抽成。即将上线。",
    en: "Take payments your customers already use — no extra terminal, no platform cut. Rolling out soon.",
    fr: "Encaissez avec les moyens que vos clients utilisent déjà — sans terminal supplémentaire ni commission de plateforme. Bientôt disponible.",
  },
  faqTitle: { zh: "常见问题", en: "Questions", fr: "Questions" },
  faq: [
    {
      q: { zh: "需要签合同吗？", en: "Is there a contract?", fr: "Y a-t-il un contrat ?" },
      a: {
        zh: "不需要。随时升级、降级或取消。",
        en: "No. Upgrade, downgrade, or cancel anytime.",
        fr: "Non. Changez ou annulez à tout moment.",
      },
    },
    {
      q: { zh: "「零抽成」是什么意思？", en: "What does commission-free mean?", fr: "Que signifie « sans commission » ?" },
      a: {
        zh: "每一单收入 100% 归你，我们不像外卖平台那样按比例抽成。",
        en: "You keep 100% of every order — we don't take a percentage like the delivery apps.",
        fr: "Vous gardez 100% de chaque commande — nous ne prenons pas de pourcentage comme les applis de livraison.",
      },
    },
    {
      q: { zh: "需要专用设备吗？", en: "Do I need special hardware?", fr: "Faut-il du matériel spécial ?" },
      a: {
        zh: "不需要。手机、平板、电脑都能用。",
        en: "No. It runs on any phone, tablet, or computer.",
        fr: "Non. Ça fonctionne sur tout téléphone, tablette ou ordinateur.",
      },
    },
  ],
  footer: {
    zh: "为中小商家打造的轻量管理系统",
    en: "A lightweight back-office for small businesses",
    fr: "Un back-office léger pour les petits commerces",
  },
};

const TIERS: {
  id: string;
  name: Dict;
  tagline: Dict;
  monthly: number;
  annual: number;
  featured?: boolean;
  features: Dict[];
  cta: Dict;
}[] = [
  {
    id: "free",
    name: { zh: "免费版", en: "Free", fr: "Gratuit" },
    tagline: { zh: "刚起步的小店", en: "Just getting started", fr: "Pour bien démarrer" },
    monthly: 0,
    annual: 0,
    features: [
      { zh: "1 间门店", en: "1 location", fr: "1 site" },
      { zh: "二维码菜单", en: "QR code menu", fr: "Menu par code QR" },
      { zh: "基础后台（订单、菜单）", en: "Basic back-office (orders, menu)", fr: "Back-office de base (commandes, menu)" },
      { zh: "每月最多 50 单", en: "Up to 50 orders / mo", fr: "Jusqu'à 50 commandes / mois" },
      { zh: "邮件支持", en: "Email support", fr: "Soutien par courriel" },
    ],
    cta: { zh: "免费开始", en: "Get started free", fr: "Commencer gratuitement" },
  },
  {
    id: "standard",
    name: { zh: "标准版", en: "Standard", fr: "Standard" },
    tagline: { zh: "大多数商家的选择", en: "For most shops", fr: "Pour la plupart des commerces" },
    monthly: 49,
    annual: 41,
    featured: true,
    features: [
      { zh: "无限量订单 · 零抽成", en: "Unlimited orders · 0% commission", fr: "Commandes illimitées · 0% commission" },
      { zh: "全部模块：备货 · 对账 · 会员 · 报表", en: "All modules: prep · reconciliation · members · reports", fr: "Tous les modules : prépa · rapprochement · membres · rapports" },
      { zh: "在线 + 二维码点餐", en: "Online + QR ordering", fr: "Commande en ligne + QR" },
      { zh: "员工账号与权限", en: "Staff accounts & roles", fr: "Comptes et rôles employés" },
      { zh: "数据导出", en: "Data export", fr: "Export de données" },
    ],
    cta: { zh: "开始使用", en: "Get started", fr: "Commencer" },
  },
  {
    id: "multi",
    name: { zh: "多店版", en: "Multi", fr: "Multi" },
    tagline: { zh: "连锁与多门店", en: "Chains & multi-location", fr: "Chaînes et multi-sites" },
    monthly: 99,
    annual: 83,
    features: [
      { zh: "包含标准版全部功能", en: "Everything in Standard", fr: "Tout ce qui est dans Standard" },
      { zh: "多家门店统一管理", en: "Manage multiple locations", fr: "Gérez plusieurs sites" },
      { zh: "高级报表与门店对比", en: "Advanced reports & comparisons", fr: "Rapports avancés et comparaisons" },
      { zh: "优先支持", en: "Priority support", fr: "Soutien prioritaire" },
    ],
    cta: { zh: "开始使用", en: "Get started", fr: "Commencer" },
  },
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default function Pricing() {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("monthly");
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
          <Link href="/pricing" className="text-sm font-medium text-slate-900">
            {t(T.nav.pricing)}
          </Link>
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

        {/* billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm">
          <button
            onClick={() => setPeriod("monthly")}
            className={`rounded-full px-4 py-1.5 font-medium transition ${period === "monthly" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t(T.monthly)}
          </button>
          <button
            onClick={() => setPeriod("annual")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition ${period === "annual" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t(T.annual)}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${period === "annual" ? "bg-emerald-400 text-emerald-950" : "bg-emerald-100 text-emerald-700"}`}>
              {t(T.save)}
            </span>
          </button>
        </div>
      </section>

      {/* pricing cards */}
      <section className="mx-auto mt-12 grid max-w-5xl gap-5 px-6 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const price = period === "annual" ? tier.annual : tier.monthly;
          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-3xl border p-6 backdrop-blur transition ${
                tier.featured
                  ? "border-emerald-300 bg-white shadow-2xl shadow-emerald-500/10 sm:-mt-4 sm:mb-4"
                  : "border-slate-200 bg-white/70 shadow-sm"
              }`}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-3 py-1 text-[11px] font-semibold text-white shadow">
                  {t({ zh: "最受欢迎", en: "Most popular", fr: "Le plus populaire" })}
                </span>
              )}
              <div className="text-sm font-semibold text-slate-900">{t(tier.name)}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t(tier.tagline)}</div>

              <div className="mt-4 flex items-end gap-1">
                <span className="text-4xl font-bold tracking-tight text-slate-900">${price}</span>
                <span className="mb-1 text-sm text-slate-500">{t(T.perMo)}</span>
              </div>
              <div className="h-4 text-[11px] text-slate-400">
                {price > 0 ? (period === "annual" ? `CAD · ${t(T.billedAnnually)}` : "CAD") : ""}
              </div>

              <Link
                href={href}
                className={`mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition ${
                  tier.featured
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t(tier.cta)}
              </Link>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((f) => (
                  <li key={f.en} className="flex gap-2 text-sm text-slate-600">
                    <Check />
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {/* founder pricing */}
      <section className="mx-auto mt-8 max-w-5xl px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-3 text-center text-sm font-medium text-amber-800">
          {t(T.founder)}
        </div>
      </section>

      {/* payments coming soon */}
      <section className="mx-auto mt-6 max-w-5xl px-6">
        <div className="flex flex-col items-start gap-3 rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-emerald-50 p-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-4">
            <img src="/logos/alipay.svg" alt="Alipay" className="h-7 w-auto" />
            <img src="/logos/wechat.svg" alt="WeChat Pay" className="h-7 w-auto" />
            <img src="/logos/applepay.svg" alt="Apple Pay" className="h-7 w-auto" />
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
              {t(T.comingSoon)}
            </span>
            <div className="mt-1.5 font-semibold text-slate-900">{t(T.payTitle)}</div>
            <p className="mt-1 text-sm text-slate-600">{t(T.payBody)}</p>
          </div>
        </div>
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
