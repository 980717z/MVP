"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";

type Lang = "zh" | "en";

const T = {
  nav: { product: { zh: "产品", en: "Product" }, login: { zh: "登录", en: "Log in" } },
  slogan: {
    zh: "一个后台，管好整间店",
    en: "One dashboard for your whole shop",
  },
  sub: {
    zh: "勾选你需要的功能，我们为你生成专属管理系统——备货、订单、对账、会员，一处搞定。",
    en: "Pick the features you need; we generate a back-office built for you — prep, orders, reconciliation, members, all in one place.",
  },
  ctaStart: { zh: "免费开始", en: "Get started" },
  ctaEnter: { zh: "进入后台", en: "Enter dashboard" },
  ctaDemo: { zh: "看看怎么用", en: "How it works" },
  points: [
    {
      icon: "✅",
      title: { zh: "勾选即生成", en: "Check & generate" },
      body: { zh: "像填清单一样选功能，系统自动搭好录入与报表。", en: "Tick a checklist; the system builds the forms and reports." },
    },
    {
      icon: "👥",
      title: { zh: "主账号 + 员工", en: "Owner + staff" },
      body: { zh: "一个主账号管全店，按岗位给员工分配权限。", en: "One owner account, role-based access for every staff member." },
    },
    {
      icon: "📊",
      title: { zh: "数据看得清", en: "Clear numbers" },
      body: { zh: "收入、损耗、毛利、会员，关键数字一眼看到。", en: "Revenue, waste, margin, members — the numbers that matter, at a glance." },
    },
  ],
  footer: {
    zh: "为华人商家打造的轻量管理系统",
    en: "A lightweight back-office built for local merchants",
  },
};

export default function Landing() {
  const [lang, setLang] = useState<Lang>("zh");
  const { session } = useAuth();
  const t = (b: { zh: string; en: string }) => b[lang];

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* soft background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-wash blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-amber-50 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍱</span>
          <span className="text-lg font-bold tracking-tight text-ink">BentoOS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-slate-300"
            aria-label="switch language"
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
          <Link href={session ? "/app" : "/login"} className="text-sm font-medium text-ink-soft hover:text-ink">
            {session ? t(T.ctaEnter) : t(T.nav.login)}
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-ink-faint backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {lang === "zh" ? "现已上线 · bentoos.io" : "Now live · bentoos.io"}
        </div>

        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-ink sm:text-6xl">
          {t(T.slogan)}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-ink-soft sm:text-lg">
          {t(T.sub)}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={session ? "/app" : "/login"}
            className="btn-primary px-6 py-3 text-base shadow-sm"
          >
            {session ? t(T.ctaEnter) : t(T.ctaStart)}
          </Link>
          <Link
            href="/login"
            className="btn-ghost border border-slate-200 px-6 py-3 text-base"
          >
            {t(T.ctaDemo)}
          </Link>
        </div>
      </section>

      {/* three points */}
      <section className="mx-auto grid max-w-4xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {T.points.map((p, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white/60 p-5 text-left backdrop-blur">
            <div className="text-2xl">{p.icon}</div>
            <div className="mt-3 font-semibold text-ink">{t(p.title)}</div>
            <p className="mt-1 text-sm text-ink-soft">{t(p.body)}</p>
          </div>
        ))}
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-ink-faint sm:flex-row">
          <span>🍱 BentoOS · {t(T.footer)}</span>
          <span>© 2026 BentoOS</span>
        </div>
      </footer>
    </main>
  );
}
