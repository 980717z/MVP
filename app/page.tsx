"use client";

import { type ReactElement } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle, type Lang, type Dict } from "@/app/i18n";

const T = {
  nav: { login: { zh: "登录", en: "Log in", fr: "Connexion" }, pricing: { zh: "价格", en: "Pricing", fr: "Tarifs" } },
  badge: { zh: "现已上线 · bentoos.io", en: "Now live · bentoos.io", fr: "En ligne · bentoos.io" },
  slogan: {
    lead: { zh: "一个后台，管好", en: "One dashboard for your ", fr: "Un tableau de bord pour " },
    hi: { zh: "整间店", en: "whole shop", fr: "tout le commerce" },
  },
  sub: {
    zh: "勾选你需要的功能，我们为你生成专属管理系统——备货、订单、对账、会员，一处搞定。",
    en: "Pick the features you need; we generate a back-office built for you — prep, orders, reconciliation, members, all in one place.",
    fr: "Choisissez les fonctions dont vous avez besoin; nous générons un back-office sur mesure — préparation, commandes, rapprochement, membres, tout au même endroit.",
  },
  ctaStart: { zh: "免费开始", en: "Get started", fr: "Commencer" },
  ctaEnter: { zh: "进入后台", en: "Enter dashboard", fr: "Tableau de bord" },
  ctaDemo: { zh: "看看怎么用", en: "How it works", fr: "Comment ça marche" },
  quote: {
    zh: "以前账目乱，现在每天收入、毛利一眼就清楚。",
    en: "Used to be a mess. Now I see revenue and margin at a glance, every day.",
    fr: "Avant, c'était le chaos. Maintenant je vois mes revenus et ma marge d'un coup d'œil, chaque jour.",
  },
  quoteName: { zh: "张老板", en: "Mr. Zhang", fr: "Mr. Zhang" },
  quoteRole: { zh: "张记小吃 · 店主", en: "Owner · Zhang's Kitchen", fr: "Propriétaire · Zhang's Kitchen" },
  photoCaption: { zh: "多伦多 · CN 塔天际线", en: "Toronto skyline · CN Tower", fr: "Horizon de Toronto · Tour CN" },
  points: [
    {
      title: { zh: "勾选即生成", en: "Check & generate", fr: "Cochez et générez" },
      body: {
        zh: "像填清单一样选功能，系统自动搭好录入与报表。",
        en: "Tick a checklist; the system builds the forms and reports.",
        fr: "Cochez une liste; le système crée les formulaires et les rapports.",
      },
    },
    {
      title: { zh: "主账号 + 员工", en: "Owner + staff", fr: "Propriétaire + employés" },
      body: {
        zh: "一个主账号管全店，按岗位给员工分配权限。",
        en: "One owner account, role-based access for every staff member.",
        fr: "Un compte propriétaire, des accès par rôle pour chaque employé.",
      },
    },
    {
      title: { zh: "数据看得清", en: "Clear numbers", fr: "Des chiffres clairs" },
      body: {
        zh: "收入、损耗、毛利、会员，关键数字一眼看到。",
        en: "Revenue, waste, margin, members — the numbers that matter, at a glance.",
        fr: "Revenus, pertes, marge, membres — les chiffres qui comptent, d'un coup d'œil.",
      },
    },
  ],
  footer: {
    zh: "为中小商家打造的轻量管理系统",
    en: "A lightweight back-office for small businesses",
    fr: "Un back-office léger pour les petits commerces",
  },
};

/** Minimalist flat avatar — single-color head + shoulders, no photo. */
function MiniAvatar() {
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0" aria-hidden>
      <circle cx="24" cy="24" r="24" fill="#d1fae5" />
      <circle cx="24" cy="19" r="7" fill="#059669" />
      <path d="M10 41a14 14 0 0 1 28 0Z" fill="#059669" />
    </svg>
  );
}

/** Small line icons for the feature cards (minimal, single stroke). */
const ICONS: Record<string, ReactElement> = {
  check: <path d="M4 12.5l5 5 11-11" />,
  staff: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="10" r="2.6" />
      <path d="M3.5 19c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5M15 18.5c.4-2.2 2-3.5 3.6-3.5 1.4 0 2.6.9 3.2 2.6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16l4-5 3 3 5-7" />
    </>
  ),
};

function FeatureIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const FEATURE_ICONS: (keyof typeof ICONS)[] = ["check", "staff", "chart"];

const NAV: { icon: string; label: Dict }[] = [
  { icon: "▦", label: { zh: "概览", en: "Overview", fr: "Aperçu" } },
  { icon: "🧾", label: { zh: "订单", en: "Orders", fr: "Commandes" } },
  { icon: "📦", label: { zh: "备货", en: "Prep", fr: "Préparation" } },
  { icon: "💳", label: { zh: "对账", en: "Reconcile", fr: "Rapprochement" } },
  { icon: "👥", label: { zh: "会员", en: "Members", fr: "Membres" } },
  { icon: "📈", label: { zh: "报表", en: "Reports", fr: "Rapports" } },
  { icon: "⚙️", label: { zh: "设置", en: "Settings", fr: "Paramètres" } },
];

/** Complete product dashboard mockup shown in the hero. */
function Dashboard({ t, lang, href }: { t: (b: Dict) => string; lang: Lang; href: string }) {
  const cur = lang === "zh" ? "¥" : "$";
  const kpis = [
    { label: { zh: "本月营收", en: "Revenue", fr: "Revenus" }, value: `${cur}28,540`, up: "+12%" },
    { label: { zh: "订单", en: "Orders", fr: "Commandes" }, value: "1,248", up: "+8%" },
    { label: { zh: "毛利", en: "Gross profit", fr: "Marge brute" }, value: `${cur}8,730`, up: "+5%" },
    { label: { zh: "新会员", en: "New members", fr: "Nouveaux membres" }, value: "86", up: "+23" },
  ];
  const topItems = [
    { name: { zh: "招牌炒饭", en: "Signature fried rice", fr: "Riz frit maison" }, qty: 312 },
    { name: { zh: "椒盐排骨", en: "Salt & pepper ribs", fr: "Côtes sel et poivre" }, qty: 268 },
    { name: { zh: "港式奶茶", en: "HK milk tea", fr: "Thé au lait HK" }, qty: 245 },
  ];
  const orders = [
    { id: "#1042", typ: { zh: "桌台 6", en: "Table 6", fr: "Table 6" }, amt: `${cur}186` },
    { id: "#1041", typ: { zh: "外卖", en: "Takeout", fr: "À emporter" }, amt: `${cur}92` },
    { id: "#1040", typ: { zh: "堂食", en: "Dine-in", fr: "Sur place" }, amt: `${cur}240` },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-900/15">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[10px] text-slate-400">app.bentoos.io</span>
      </div>

      <div className="flex">
        {/* sidebar */}
        <aside className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/40 p-2 sm:block">
          <div className="mb-3 flex items-center gap-1.5 px-1">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-emerald-500 to-sky-500 text-[10px]">🍱</span>
            <span className="text-[11px] font-bold text-slate-800">BentoOS</span>
          </div>
          <nav className="space-y-0.5">
            {NAV.map((n, i) => (
              <Link
                key={n.label.en}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] transition ${
                  i === 0 ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <span>{n.icon}</span>
                <span>{t(n.label)}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{t({ zh: "概览", en: "Overview", fr: "Aperçu" })}</span>
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400">
              {t({ zh: "5月1日 – 5月31日", en: "May 1 – May 31", fr: "1–31 mai" })}
            </span>
          </div>

          {/* KPIs */}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label.en} className="rounded-xl bg-slate-50 p-2.5">
                <div className="truncate text-[10px] text-slate-400">{t(k.label)}</div>
                <div className="mt-0.5 text-sm font-bold tracking-tight text-slate-800">{k.value}</div>
                <div className="text-[10px] font-medium text-emerald-600">{k.up}</div>
              </div>
            ))}
          </div>

          {/* trend chart */}
          <div className="mt-3 rounded-xl border border-slate-100 p-3">
            <div className="text-[11px] font-medium text-slate-500">{t({ zh: "销售趋势", en: "Sales trend", fr: "Tendance des ventes" })}</div>
            <svg viewBox="0 0 300 80" className="mt-1 h-20 w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,60 L25,52 L50,56 L75,40 L100,46 L125,30 L150,36 L175,22 L200,28 L225,16 L250,24 L275,12 L300,18 L300,80 L0,80 Z"
                fill="url(#trendFill)"
              />
              <polyline
                points="0,60 25,52 50,56 75,40 100,46 125,30 150,36 175,22 200,28 225,16 250,24 275,12 300,18"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* two lists */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-3">
              <div className="text-[11px] font-medium text-slate-500">{t({ zh: "热销菜品", en: "Top items", fr: "Meilleures ventes" })}</div>
              <ul className="mt-2 space-y-1.5">
                {topItems.map((it, i) => (
                  <li key={it.name.en} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="grid h-4 w-4 place-items-center rounded bg-emerald-50 text-[9px] font-semibold text-emerald-600">{i + 1}</span>
                      {t(it.name)}
                    </span>
                    <span className="text-slate-400">{it.qty}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">{t({ zh: "最近订单", en: "Recent orders", fr: "Commandes récentes" })}</span>
                <span className="text-[10px] text-emerald-600">{t({ zh: "查看全部", en: "View all", fr: "Voir tout" })}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">
                      <span className="text-slate-400">{o.id}</span> · {t(o.typ)}
                    </span>
                    <span className="font-medium text-slate-700">{o.amt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { lang, t } = useLang();
  const { session } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* soft pastel background washes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 -left-32 h-[34rem] w-[34rem] rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/60 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-violet-100/40 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 text-base shadow-sm">🍱</span>
          <span className="text-lg font-bold tracking-tight text-slate-900">BentoOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {t(T.nav.pricing)}
          </Link>
          <LangToggle />
          <Link href={session ? "/app" : "/login"} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {session ? t(T.ctaEnter) : t(T.nav.login)}
          </Link>
        </div>
      </header>

      {/* hero — asymmetric, text left / visuals right */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-5 lg:gap-10 lg:pt-16">
        {/* left column */}
        <div className="text-center lg:col-span-2 lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t(T.badge)}
          </div>

          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {t(T.slogan.lead)}
            <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">{t(T.slogan.hi)}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg lg:mx-0">{t(T.sub)}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={session ? "/app" : "/get-started"}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
            >
              {session ? t(T.ctaEnter) : t(T.ctaStart)}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {t(T.ctaDemo)}
            </Link>
          </div>

          {/* testimonial with minimalist avatar */}
          <figure className="mx-auto mt-9 flex max-w-md items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 text-left backdrop-blur lg:mx-0">
            <MiniAvatar />
            <div>
              <blockquote className="text-sm text-slate-700">“{t(T.quote)}”</blockquote>
              <figcaption className="mt-1 text-xs text-slate-400">
                <span className="font-medium text-slate-600">{t(T.quoteName)}</span> · {t(T.quoteRole)}
              </figcaption>
            </div>
          </figure>
        </div>

        {/* right column — complete dashboard, Toronto photo as accent */}
        <div className="relative mx-auto w-full max-w-2xl lg:col-span-3">
          {/* Toronto photo polaroid accent */}
          <div className="absolute -right-4 -top-9 z-20 hidden w-44 rotate-3 overflow-hidden rounded-xl border-4 border-white shadow-2xl shadow-slate-900/20 sm:block">
            <img src="/toronto.jpg" alt={t(T.photoCaption)} className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/60 to-transparent px-2 py-1">
              <span className="text-[10px] font-medium text-white/90">📍 {t(T.photoCaption)}</span>
            </div>
          </div>

          <div className="relative z-10">
            <Dashboard t={t} lang={lang} href="/demo" />
          </div>

          {/* mobile-only Toronto photo */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/60 shadow-lg sm:hidden">
            <img src="/toronto.jpg" alt={t(T.photoCaption)} className="aspect-[16/9] w-full object-cover" />
          </div>
        </div>
      </section>

      {/* three feature cards */}
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 pt-10 sm:grid-cols-3">
        {T.points.map((p, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white/70 p-6 text-left shadow-sm backdrop-blur transition hover:shadow-md">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <FeatureIcon name={FEATURE_ICONS[i]} />
            </div>
            <div className="mt-4 font-semibold text-slate-900">{t(p.title)}</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(p.body)}</p>
          </div>
        ))}
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
          <span>🍱 BentoOS · {t(T.footer)}</span>
          <span>© 2026 BentoOS</span>
        </div>
      </footer>
    </main>
  );
}
