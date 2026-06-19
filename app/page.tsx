"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

type Lang = "zh" | "en";

const T = {
  nav: { login: { zh: "登录", en: "Log in" } },
  badge: { zh: "现已上线 · bentoos.io", en: "Now live · bentoos.io" },
  slogan: {
    lead: { zh: "一个后台，管好", en: "One dashboard for your " },
    hi: { zh: "整间店", en: "whole shop" },
  },
  sub: {
    zh: "勾选你需要的功能，我们为你生成专属管理系统——备货、订单、对账、会员，一处搞定。",
    en: "Pick the features you need; we generate a back-office built for you — prep, orders, reconciliation, members, all in one place.",
  },
  ctaStart: { zh: "免费开始", en: "Get started" },
  ctaEnter: { zh: "进入后台", en: "Enter dashboard" },
  ctaDemo: { zh: "看看怎么用", en: "How it works" },
  quote: {
    zh: "以前账目乱，现在每天收入、毛利一眼就清楚。",
    en: "Used to be a mess. Now I see revenue and margin at a glance, every day.",
  },
  quoteName: { zh: "张老板", en: "Mr. Zhang" },
  quoteRole: { zh: "张记小吃 · 店主", en: "Owner · Zhang's Kitchen" },
  photoCaption: { zh: "多伦多 · CN 塔天际线", en: "Toronto skyline · CN Tower" },
  panel: {
    title: { zh: "概览", en: "Overview" },
    today: { zh: "今日营收", en: "Revenue today" },
    orders: { zh: "订单", en: "Orders" },
    margin: { zh: "毛利", en: "Margin" },
    members: { zh: "会员", en: "Members" },
    trend: { zh: "近 7 天", en: "Last 7 days" },
  },
  points: [
    {
      title: { zh: "勾选即生成", en: "Check & generate" },
      body: {
        zh: "像填清单一样选功能，系统自动搭好录入与报表。",
        en: "Tick a checklist; the system builds the forms and reports.",
      },
    },
    {
      title: { zh: "主账号 + 员工", en: "Owner + staff" },
      body: {
        zh: "一个主账号管全店，按岗位给员工分配权限。",
        en: "One owner account, role-based access for every staff member.",
      },
    },
    {
      title: { zh: "数据看得清", en: "Clear numbers" },
      body: {
        zh: "收入、损耗、毛利、会员，关键数字一眼看到。",
        en: "Revenue, waste, margin, members — the numbers that matter, at a glance.",
      },
    },
  ],
  footer: {
    zh: "为华人商家打造的轻量管理系统",
    en: "A lightweight back-office built for local merchants",
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
  check: (
    <path d="M4 12.5l5 5 11-11" />
  ),
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
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name]}
    </svg>
  );
}

const FEATURE_ICONS: (keyof typeof ICONS)[] = ["check", "staff", "chart"];

/** Faux dashboard panel shown floating over the Toronto photo. */
function DashboardCard({ t, lang }: { t: (b: { zh: string; en: string }) => string; lang: Lang }) {
  const p = T.panel;
  const metrics = [
    { label: t(p.today), value: lang === "zh" ? "¥18,820" : "$18,820", up: "+12%" },
    { label: t(p.orders), value: "156", up: "+8%" },
    { label: t(p.margin), value: "32.6%", up: "+1.4%" },
    { label: t(p.members), value: "1,248", up: "+23" },
  ];
  return (
    <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500 text-xs">🍱</span>
          <span className="text-sm font-semibold text-slate-800">{t(p.title)}</span>
        </div>
        <span className="text-[10px] text-slate-400">{t(p.trend)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl bg-slate-50 p-2.5">
            <div className="text-[10px] text-slate-400">{m.label}</div>
            <div className="mt-0.5 text-base font-bold tracking-tight text-slate-800">{m.value}</div>
            <div className="text-[10px] font-medium text-emerald-600">{m.up}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 p-3">
        <svg viewBox="0 0 220 56" className="h-14 w-full" preserveAspectRatio="none">
          <polyline
            points="0,44 30,38 60,42 90,28 120,32 150,18 180,22 220,8"
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("zh");
  const { session } = useAuth();
  const t = (b: { zh: string; en: string }) => b[lang];

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
          <button
            onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="switch language"
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
          <Link
            href={session ? "/app" : "/login"}
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            {session ? t(T.ctaEnter) : t(T.nav.login)}
          </Link>
        </div>
      </header>

      {/* hero — asymmetric, text left / visuals right */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:gap-8 lg:pt-16">
        {/* left column */}
        <div className="text-center lg:text-left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {t(T.badge)}
          </div>

          <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            {t(T.slogan.lead)}
            <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
              {t(T.slogan.hi)}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg lg:mx-0">
            {t(T.sub)}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={session ? "/app" : "/login"}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
            >
              {session ? t(T.ctaEnter) : t(T.ctaStart)}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/login"
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

        {/* right column — Toronto photo with floating dashboard card */}
        <div className="relative mx-auto w-full max-w-lg">
          <div className="overflow-hidden rounded-3xl border border-white/60 shadow-2xl shadow-slate-900/15">
            <img
              src="/toronto.jpg"
              alt={t(T.photoCaption)}
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/55 to-transparent px-4 py-3">
              <span className="text-xs font-medium text-white/90">📍 {t(T.photoCaption)}</span>
            </div>
          </div>
          <div className="absolute -bottom-8 -left-6 sm:-left-10">
            <DashboardCard t={t} lang={lang} />
          </div>
        </div>
      </section>

      {/* three feature cards */}
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 pt-10 sm:grid-cols-3">
        {T.points.map((p, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-100 bg-white/70 p-6 text-left shadow-sm backdrop-blur transition hover:shadow-md"
          >
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
