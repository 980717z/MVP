"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle, type Dict } from "@/app/i18n";
import { BentoMark } from "@/components/BentoMark";

const T = {
  navPricing: { zh: "价格", en: "Pricing", fr: "Tarifs" },
  navLogin: { zh: "登录", en: "Log in", fr: "Connexion" },
  navEnter: { zh: "进入后台", en: "Dashboard", fr: "Tableau de bord" },
  badge: { zh: "贴身上门服务", en: "White-glove setup", fr: "Service complet sur place" },
  title: { zh: "怎么用", en: "How it works", fr: "Comment ça marche" },
  sub: {
    zh: "BentoOS 提供贴身服务：我们和你一起把后台搭好，而不只是给你一套软件。",
    en: "BentoOS is white-glove to start: we build your back-office with you, not just hand you software.",
    fr: "BentoOS commence en service complet : nous montons votre back-office avec vous, pas seulement un logiciel.",
  },
  setupTitle: { zh: "三步搞定", en: "Set up in 3 steps", fr: "Trois étapes pour démarrer" },
  steps: [
    {
      title: { zh: "告诉我们你的店", en: "Tell us about your shop", fr: "Parlez-nous de votre commerce" },
      body: {
        zh: "留下基本信息——你卖什么、几家店、最想先解决什么。",
        en: "Reach out with a few basics — what you sell, how many locations, what you want to fix first.",
        fr: "Donnez-nous quelques informations — ce que vous vendez, combien de sites, ce que vous voulez régler en premier.",
      },
    },
    {
      title: { zh: "把菜单发给我们", en: "Send us your menu", fr: "Envoyez-nous votre menu" },
      body: {
        zh: "照片、PDF 或链接都行。我们帮你录入，你无需手动输入。",
        en: "A photo, PDF, or link works. We digitize it for you — no data entry on your side.",
        fr: "Une photo, un PDF ou un lien suffit. Nous le numérisons pour vous — aucune saisie de votre côté.",
      },
    },
    {
      title: { zh: "我们上门搭建", en: "We set it up on-site", fr: "Nous l'installons sur place" },
      body: {
        zh: "BentoOS 工程师上门，为你定制二维码菜单和后台，并培训你的团队。",
        en: "A BentoOS engineer comes to your shop, personalizes your QR code menu and dashboard, and trains your team.",
        fr: "Un ingénieur BentoOS se déplace dans votre commerce, personnalise votre menu par code QR et votre tableau de bord, et forme votre équipe.",
      },
    },
  ],
  resultNote: {
    zh: "你的二维码菜单和在线点餐随即上线——通常几天内完成。",
    en: "Your QR menu and online ordering go live — usually within days.",
    fr: "Votre menu QR et la commande en ligne sont en ligne — généralement en quelques jours.",
  },
  modulesTitle: { zh: "套件包含什么", en: "What's in the suite", fr: "Ce que comprend la suite" },
  modulesSub: {
    zh: "扫码点餐已上线，其余功能正在陆续推出。",
    en: "QR ordering is live today. The rest are rolling out.",
    fr: "La commande QR est déjà en ligne. Le reste arrive bientôt.",
  },
  live: { zh: "已上线", en: "Live", fr: "En ligne" },
  soon: { zh: "即将推出", en: "Coming soon", fr: "Bientôt" },
  howLabel: { zh: "原理", en: "How it works", fr: "Comment" },
  ctaTitle: { zh: "准备好搭建你的店了吗？", en: "Ready to set up your shop?", fr: "Prêt à configurer votre commerce ?" },
  ctaStart: { zh: "免费开始", en: "Get started", fr: "Commencer" },
  ctaPricing: { zh: "联系我们", en: "Talk to us", fr: "Contactez-nous" },
  footer: {
    zh: "为中小商家打造的轻量管理系统",
    en: "A lightweight back-office for small businesses",
    fr: "Un back-office léger pour les petits commerces",
  },
};

const MODULES: { icon: string; status: "live" | "soon"; name: Dict; desc: Dict; how: Dict }[] = [
  {
    icon: "📱",
    status: "live",
    name: { zh: "扫码菜单与点餐", en: "QR menu & ordering", fr: "Menu QR et commande" },
    desc: {
      zh: "为每桌或整店生成专属二维码。顾客扫码浏览菜单并下单——每一单都进入你的后台。",
      en: "Personalized QR codes for each table or the whole shop. Guests scan, browse your menu, and order — every order lands in your dashboard.",
      fr: "Des codes QR personnalisés par table ou pour tout le commerce. Les clients scannent, consultent le menu et commandent — chaque commande arrive dans votre tableau de bord.",
    },
    how: {
      zh: "我们生成与菜单关联的二维码；订单实时进入后台，无需安装 App。",
      en: "We generate QR codes linked to your live menu; orders post to your back-office in real time, no app to install.",
      fr: "Nous générons des codes QR liés à votre menu; les commandes arrivent en temps réel, sans application à installer.",
    },
  },
  {
    icon: "🕒",
    status: "soon",
    name: { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" },
    desc: {
      zh: "排好每周班次，记录上下班打卡，查看工时、人力成本及其占营收比例。",
      en: "Build the weekly schedule, track clock-in/out, and see hours, labor cost, and labor as a % of sales.",
      fr: "Créez l'horaire de la semaine, suivez les pointages, et voyez les heures, le coût de main-d'œuvre et son pourcentage des ventes.",
    },
    how: {
      zh: "员工名册加考勤打卡；薪酬合计与人力比例自动计算。",
      en: "A staff roster plus time tracking; payroll totals and labor ratios are computed automatically.",
      fr: "Une liste du personnel et le pointage; les totaux de paie et les ratios sont calculés automatiquement.",
    },
  },
  {
    icon: "🚚",
    status: "soon",
    name: { zh: "供应商管理", en: "Supplier management", fr: "Gestion des fournisseurs" },
    desc: {
      zh: "把供应商、采购单和到货集中管理，含准时率与未结款。",
      en: "Keep your vendors, purchase orders, and deliveries in one place, with on-time performance and outstanding balances.",
      fr: "Regroupez vos fournisseurs, bons de commande et livraisons, avec ponctualité et soldes dus.",
    },
    how: {
      zh: "每个供应商有档案和下单记录；采购单追踪已下单与待付金额。",
      en: "Each vendor has a profile and order history; purchase orders track what's committed and what's due.",
      fr: "Chaque fournisseur a un profil et un historique; les bons suivent les montants engagés et dus.",
    },
  },
  {
    icon: "📦",
    status: "soon",
    name: { zh: "智能库存 + 自动补货", en: "Smart inventory + auto-reorder", fr: "Inventaire intelligent + recommande auto" },
    desc: {
      zh: "按安全库存追踪存货。当某项偏低时，BentoOS 自动生成采购单，并通过邮件或短信发给供应商。",
      en: "Track stock against par levels. When an item runs low, BentoOS automatically drafts a purchase order and emails or texts it to the supplier.",
      fr: "Suivez le stock par rapport aux seuils. Quand un article baisse, BentoOS prépare un bon de commande et l'envoie au fournisseur par courriel ou texto.",
    },
    how: {
      zh: "为每项设定安全库存，销售自动扣减。到达阈值后，BentoOS 通过邮件/短信向该供应商发送可一键确认的订单——你只需批准。",
      en: "Set a par level per item; sales draw it down. Cross the threshold and BentoOS sends a ready-to-confirm order to that supplier by email/SMS — you just approve.",
      fr: "Définissez un seuil par article; les ventes le diminuent. Au seuil, BentoOS envoie une commande prête à confirmer au fournisseur par courriel/SMS — vous n'avez qu'à approuver.",
    },
  },
  {
    icon: "📊",
    status: "soon",
    name: { zh: "对账、会员与报表", en: "Reconciliation, members & reports", fr: "Rapprochement, membres et rapports" },
    desc: {
      zh: "每日现金/刷卡对账、会员积分计划，以及营收、毛利与税务报表。",
      en: "Daily cash/card reconciliation, a member loyalty program, and revenue, margin, and tax reports.",
      fr: "Rapprochement quotidien encaisse/cartes, programme de fidélité, et rapports de revenus, marge et taxes.",
    },
    how: {
      zh: "订单自动汇入对账与报表；会员每次到店累计积分。",
      en: "Orders feed reconciliation and reports automatically; members earn points on each visit.",
      fr: "Les commandes alimentent le rapprochement et les rapports; les membres cumulent des points à chaque visite.",
    },
  },
];

export default function HowItWorks() {
  const { t } = useLang();
  const { session } = useAuth();

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 -left-32 h-[34rem] w-[34rem] rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <BentoMark className="h-8 w-8 shadow-sm" />
          <span className="text-lg font-bold tracking-tight text-slate-900">BentoOS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {t(T.navPricing)}
          </Link>
          <LangToggle />
          <Link href={session ? "/app" : "/login"} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {session ? t(T.navEnter) : t(T.navLogin)}
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-6 pt-10 text-center sm:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t(T.badge)}
        </div>
        <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">{t(T.title)}</h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg">{t(T.sub)}</p>
      </section>

      {/* setup steps */}
      <section className="mx-auto max-w-4xl px-6 pt-14">
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">{t(T.setupTitle)}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {T.steps.map((s, i) => (
            <li key={s.title.en} className="relative rounded-2xl border border-slate-100 bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-sm font-bold text-white">
                {i + 1}
              </div>
              <div className="mt-4 font-semibold text-slate-900">{t(s.title)}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{t(s.body)}</p>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-6 max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-3 text-center text-sm font-medium text-emerald-800">
          ✅ {t(T.resultNote)}
        </p>
      </section>

      {/* modules */}
      <section className="mx-auto max-w-4xl px-6 pt-16">
        <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">{t(T.modulesTitle)}</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">{t(T.modulesSub)}</p>

        <div className="mt-8 space-y-4">
          {MODULES.map((m) => (
            <div key={m.name.en} className="rounded-2xl border border-slate-100 bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-lg">{m.icon}</span>
                <span className="font-semibold text-slate-900">{t(m.name)}</span>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    m.status === "live" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {m.status === "live" ? t(T.live) : t(T.soon)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{t(m.desc)}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                <span className="font-medium text-slate-600">{t(T.howLabel)}: </span>
                {t(m.how)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t(T.ctaTitle)}</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={session ? "/app" : "/get-started"}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
          >
            {t(T.ctaStart)}
            <span aria-hidden>→</span>
          </Link>
          <a
            href="mailto:support@bentoos.io"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t(T.ctaPricing)}
          </a>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-400 sm:flex-row">
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
