"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { useLang, LangToggle } from "@/app/i18n";
import HeroDemo from "@/components/HeroDemo";
import { BentoMark } from "@/components/BentoMark";

// ─────────────────────────────────────────────────────────────────────────
//  BentoOS landing — fancy·interactive·trustworthy rebuild (2026-07-06).
//  Trust = real product: a live merchant menu is embedded (not a mockup),
//  anonymized via ?embed=1 until we hold written authorization to name the shop.
//  the interactive HeroDemo is the real dashboard, and every stat is true.
//  No pricing anywhere (hidden during beta). EN/FR/中 throughout.
// ─────────────────────────────────────────────────────────────────────────

const T = {
  nav: { login: { zh: "登录", en: "Log in", fr: "Connexion" }, how: { zh: "怎么用", en: "How it works", fr: "Fonctionnement" }, pricing: { zh: "价格", en: "Pricing", fr: "Tarifs" }, campus: { zh: "校园版", en: "For campus", fr: "Pour le campus" } },
  badge: { zh: "从 Spadina 到 Yonge 拓展中", en: "Growing from Spadina to Yonge", fr: "En croissance, de Spadina à Yonge" },
  promo: { zh: "开业优惠 · 免费配置 + 首月免费", en: "Launch offer · free setup + first month free", fr: "Offre de lancement · installation gratuite + 1er mois offert" },
  slogan: {
    lead: { zh: "一个后台，管好", en: "One dashboard for your ", fr: "Un tableau de bord pour " },
    hi: { zh: "整间店", en: "whole shop", fr: "tout le commerce" },
  },
  sub: {
    zh: "扫码点餐、库存管理、销售税务、员工权限。为小微商户、餐厅和零售店而做。勾选你需要的功能,用你现有的设备就能跑,不绑定 POS。",
    en: "QR ordering, inventory, sales & tax, staff roles. Built for small businesses, restaurants, and retail. Pick what you need; it runs on the devices you already have, no bundled POS.",
    fr: "Commande QR, inventaire, ventes et taxes, rôles du personnel. Conçu pour les petites entreprises, les restaurants et le commerce de détail. Choisissez vos fonctions; ça tourne sur vos appareils, sans caisse imposée.",
  },
  diff: {
    title: { zh: "不锁你的设备", en: "We don't lock you to hardware", fr: "Aucun matériel imposé" },
    body: {
      zh: "那些捆绑式 POS 系统要你买他们的机器、把你锁死。BentoOS 用你现有的手机、平板、电脑就能跑——想要打印机等硬件，按成本价，不加价。",
      en: "The big bundled POS systems make you buy their machines and lock you in. BentoOS runs on the phones, tablets, and computers you already have — want a printer or other hardware? At cost, no markup.",
      fr: "Les gros systèmes de caisse tout-en-un vous obligent à acheter leurs machines et vous enferment. BentoOS tourne sur vos appareils actuels — du matériel comme une imprimante ? Au prix coûtant, sans marge.",
    },
  },
  ctaStart: { zh: "免费开始", en: "Get started", fr: "Commencer" },
  ctaEnter: { zh: "进入后台", en: "Enter dashboard", fr: "Tableau de bord" },
  ctaDemo: { zh: "看看怎么用", en: "How it works", fr: "Comment ça marche" },
  liveTag: { zh: "真实在营业", en: "LIVE now", fr: "EN SERVICE" },
  liveCase: {
    kicker: { zh: "不是演示 —— 是正在营业的店", en: "Not a demo — a restaurant that's open right now", fr: "Pas une démo — un resto ouvert en ce moment" },
    title: { zh: "多伦多唐人街的一家海鲜酒楼", en: "A seafood house in Toronto's Chinatown", fr: "Un resto de fruits de mer du quartier chinois de Toronto" },
    body: {
      zh: "桌上贴的二维码、后厨打出的每一张单、每天的销售和税，都跑在 BentoOS 上。左边就是他们的真菜单——你现在就可以滑一滑。",
      en: "The QR codes on their tables, every kitchen ticket, daily sales and HST — all run on BentoOS. That's their real menu on the left. Scroll it.",
      fr: "Les codes QR sur les tables, chaque ticket de cuisine, les ventes et taxes quotidiennes — tout tourne sur BentoOS. Voici leur vrai menu, à gauche. Faites-le défiler.",
    },
    facts: [
      { zh: "300+ 道菜 · 中英双语", en: "300+ dishes · bilingual", fr: "300+ plats · bilingue" },
      { zh: "多规格（全/半 · 位/小/中/大）", en: "Sizes (whole/half · S→XL)", fr: "Formats (entier/demi · S→XL)" },
      { zh: "时价海鲜 · 每日改价", en: "Market-price seafood, daily", fr: "Prix du marché, quotidien" },
      { zh: "下单直达后厨打印机", en: "Orders print in the kitchen", fr: "Impression directe en cuisine" },
    ],
  },
  bentoKicker: { zh: "像便当盒一样，把店装进格子里", en: "Your shop, packed like a bento box", fr: "Votre commerce, rangé comme un bentō" },
  bentoTitle: { zh: "每个格子，管一件事", en: "Every box does one job, well", fr: "Chaque case fait une chose, bien" },
  bento: {
    qr: {
      t: { zh: "扫码点餐", en: "QR ordering", fr: "Commande QR" },
      b: { zh: "每桌一码，下单直达厨房。改菜改价即时同步，永不重印。", en: "One code per table, orders straight to the kitchen. Edit dishes anytime — never reprint.", fr: "Un code par table, commandes直 en cuisine. Modifiez sans jamais réimprimer." },
    },
    print: {
      t: { zh: "厨房云出票", en: "Cloud kitchen tickets", fr: "Tickets cuisine cloud" },
      b: { zh: "大字号小票，老师傅一眼看清。打印机插网线就能用。", en: "Big-type tickets any chef can read. The printer just plugs into the router.", fr: "Tickets en gros caractères. L'imprimante se branche au routeur, c'est tout." },
    },
    tax: {
      t: { zh: "销售与税务", en: "Sales & tax", fr: "Ventes et taxes" },
      b: { zh: "每笔订单自动算 GST/PST，报税数字随时能看。", en: "GST/PST computed per order; remittance numbers always ready.", fr: "TPS/TVP calculées par commande; chiffres de remise toujours prêts." },
    },
    market: {
      t: { zh: "时价菜", en: "Market price", fr: "Prix du marché" },
      b: { zh: "海鲜每天开市定价，没定价照样能点，结账时录入。", en: "Price seafood daily; unpriced dishes still orderable, priced at checkout.", fr: "Prix quotidien; les plats sans prix restent commandables." },
    },
    sizes: {
      t: { zh: "多规格", en: "Sizes & portions", fr: "Formats" },
      b: { zh: "全/半、位/小/中/大/特大，一道菜多个价。", en: "Whole/half, single to XL — one dish, many prices.", fr: "Entier/demi, S à XL — un plat, plusieurs prix." },
    },
    staff: {
      t: { zh: "员工权限", en: "Staff roles", fr: "Rôles du personnel" },
      b: { zh: "邮箱邀请员工，按岗位分配可见模块。", en: "Invite staff by email; each role sees only its modules.", fr: "Invitez par courriel; chaque rôle voit ses modules." },
    },
    lang: {
      t: { zh: "三语", en: "Trilingual", fr: "Trilingue" },
      b: { zh: "EN / FR / 中，顾客与后台都能切换。", en: "EN / FR / 中 — for diners and the back-office.", fr: "EN / FR / 中 — clients et back-office." },
    },
    safe: {
      t: { zh: "数据安全", en: "Your data, safe", fr: "Données en sécurité" },
      b: { zh: "企业级数据库 + 行级权限隔离，每家店只看得到自己的数据。", en: "Enterprise Postgres with row-level security — every shop sees only its own data.", fr: "Postgres avec sécurité par ligne — chaque commerce ne voit que ses données." },
    },
  },
  stats: [
    { n: 300, suffix: "+", label: { zh: "在管菜品", en: "dishes managed", fr: "plats gérés" } },
    { n: 15, suffix: "", label: { zh: "张桌台二维码", en: "table QR codes", fr: "codes QR de table" } },
    { n: 13, suffix: "%", label: { zh: "HST 自动计算", en: "HST auto-computed", fr: "TVH auto-calculée" } },
    { n: 3, suffix: "", label: { zh: "种语言", en: "languages", fr: "langues" } },
  ],
  trust: {
    title: { zh: "为什么可以放心", en: "Why you can trust it", fr: "Pourquoi s'y fier" },
    items: [
      { icon: "🇨🇦", t: { zh: "多伦多本地打造", en: "Built in Toronto", fr: "Conçu à Toronto" }, b: { zh: "我们就在这座城市，和你用同样的税率、同样的打印机。", en: "We're in your city — same tax rules, same printers, same streets.", fr: "Nous sommes dans votre ville — mêmes taxes, mêmes imprimantes." } },
      { icon: "📌", t: { zh: "二维码永久有效", en: "QR codes never break", fr: "Codes QR permanents" }, b: { zh: "桌码做成牌子就不会失效——这是我们写进产品的承诺。", en: "Print your table signs once; the links never change. It's a product guarantee.", fr: "Imprimez vos codes une fois; les liens ne changent jamais." } },
      { icon: "🔒", t: { zh: "数据只属于你", en: "Your data is yours", fr: "Vos données à vous" }, b: { zh: "行级权限隔离，随时可导出 CSV 带走。", en: "Row-level isolation, CSV export anytime — no lock-in.", fr: "Isolation par ligne, export CSV en tout temps." } },
      { icon: "🤝", t: { zh: "白手套上门", en: "White-glove setup", fr: "Installation clé en main" }, b: { zh: "菜单录入、打印机、桌码，我们帮你弄好再走。", en: "We enter your menu, set the printer, mount the codes — then hand you the keys.", fr: "Menu, imprimante, codes — nous installons tout." } },
    ],
  },
  ctaBand: {
    title: { zh: "把你的店也装进 BentoOS", en: "Put your shop on BentoOS", fr: "Mettez votre commerce sur BentoOS" },
    body: { zh: "每家店的需求不一样，我们按你的店量身配置，并给出专属报价。开业优惠：免费配置 + 首月免费。联系我们聊聊。", en: "Every shop is different — we tailor your OS to how you run, with pricing to match. Launch offer: free setup + first month free. Talk to us.", fr: "Chaque commerce est différent — nous configurons votre OS sur mesure, avec un tarif adapté. Offre de lancement : installation gratuite + 1er mois offert. Parlons-en." },
  },
  footer: { zh: "为中小商家打造的轻量管理系统", en: "A lightweight back-office for small businesses", fr: "Un back-office léger pour les petits commerces" },
  utLink: { zh: "BentoOS · 多大校园 ↗", en: "BentoOS at UofT ↗", fr: "BentoOS à UofT ↗" },
};

/** Reveal-on-scroll: adds `.on` when the element enters the viewport. */
function useReveal<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("on");
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("on");
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`rv ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/** Count-up number that animates when scrolled into view. */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = `${to}${suffix}`;
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1100;
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = `${Math.round(to * eased)}${suffix}`;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

/** The real, live customer menu inside a phone frame. Loads lazily. */
function LivePhone({ liveTag, menuLang }: { liveTag: string; menuLang: "zh" | "en" }) {
  const [load, setLoad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative mx-auto w-[300px] flex-none">
      <span className="absolute -right-3 -top-3 z-20 flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white shadow-lg shadow-emerald-500/40">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        {liveTag}
      </span>
      <div className="rounded-[38px] bg-slate-900 p-[10px] shadow-2xl shadow-slate-900/30">
        <div className="h-[560px] overflow-hidden rounded-[29px] bg-[#FAF7F2]">
          {load ? (
            <iframe
              src={`/menu/fulai?embed=1&lang=${menuLang}`}
              title="live restaurant menu"
              className="h-full w-full border-0"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm text-slate-400">…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useLang();
  const { session } = useAuth();

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-white text-slate-900"
      style={{ fontFamily: '"Plus Jakarta Sans","Noto Sans SC",system-ui,-apple-system,"PingFang SC",sans-serif' }}
    >
      {/* landing motion styles (fonts load in the root layout <head>) */}
      <style>{`
        .rv { opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1); }
        .rv.on { opacity: 1; transform: none; }
        @keyframes blob { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(24px,-18px) scale(1.06); } 66% { transform: translate(-16px,14px) scale(.97); } }
        .blob { animation: blob 14s ease-in-out infinite; }
        .blob2 { animation: blob 18s ease-in-out infinite reverse; }
        @media (prefers-reduced-motion: reduce) { .blob, .blob2 { animation: none; } }
        .cell { transition: transform .25s ease, box-shadow .25s ease; }
        .cell:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(15, 118, 87, .12); }
      `}</style>

      {/* soft animated background washes */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="blob absolute -top-48 -left-32 h-[34rem] w-[34rem] rounded-full bg-emerald-100/70 blur-3xl" />
        <div className="blob2 absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/70 blur-3xl" />
        <div className="blob absolute top-[42rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-amber-100/40 blur-3xl" />
      </div>

      {/* nav — /pricing shows the personalized-quote story, no dollar amounts */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <BentoMark className="h-8 w-8 shadow-sm" />
          <span className="text-lg font-extrabold tracking-tight">BentoOS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/how-it-works" className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block">
            {t(T.nav.how)}
          </Link>
          <Link href="/pricing" className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:block">
            {t(T.nav.pricing)}
          </Link>
          <Link href="/campus" className="hidden text-sm font-semibold text-brand-ink transition hover:text-brand sm:block">
            {t(T.nav.campus)}
          </Link>
          <LangToggle />
          <Link href={session ? "/app" : "/login"} className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {session ? t(T.ctaEnter) : t(T.nav.login)}
          </Link>
        </div>
      </header>

      {/* hero — asymmetric, text left / real dashboard right */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-5 lg:gap-10 lg:pt-14">
        <div className="min-w-0 text-center lg:col-span-2 lg:text-left">
          <Reveal>
            <div className="mb-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-700 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {t(T.badge)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                🎁 {t(T.promo)}
              </span>
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {t(T.slogan.lead)}
              <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">{t(T.slogan.hi)}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-slate-600 sm:text-lg lg:mx-0">{t(T.sub)}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href={session ? "/app" : "/get-started"}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
              >
                {session ? t(T.ctaEnter) : t(T.ctaStart)}
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t(T.ctaDemo)}
              </Link>
            </div>
          </Reveal>

          {/* live stats — all real numbers from the flagship shop */}
          <Reveal delay={150}>
            <div className="mx-auto mt-10 grid max-w-md grid-cols-4 gap-2 lg:mx-0">
              {T.stats.map((s, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-white/80 px-2 py-3 text-center backdrop-blur">
                  <div className="text-xl font-extrabold text-emerald-600 tabular-nums">
                    <Counter to={s.n} suffix={s.suffix} />
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{t(s.label)}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="relative mx-auto w-full min-w-0 max-w-2xl lg:col-span-3">
          <div className="absolute -right-4 -top-9 z-20 hidden w-44 rotate-3 overflow-hidden rounded-xl border-4 border-white shadow-2xl shadow-slate-900/20 sm:block">
            <img src="/toronto.jpg" alt="Toronto · CN Tower" className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/60 to-transparent px-2 py-1">
              <span className="text-[10px] font-medium text-white/90">📍 Toronto</span>
            </div>
          </div>
          <Reveal delay={100} className="relative z-10">
            <HeroDemo />
          </Reveal>
        </div>
      </section>

      {/* ── the live shop — trust by showing, not telling ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-[32px] border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/60 p-6 sm:p-10">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-14">
            <Reveal className="order-2 lg:order-1">
              <LivePhone liveTag={t(T.liveTag)} menuLang={lang === "zh" ? "zh" : "en"} />
            </Reveal>
            <div className="order-1 max-w-xl lg:order-2">
              <Reveal>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">{t(T.liveCase.kicker)}</div>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t(T.liveCase.title)}</h2>
                <p className="mt-4 text-pretty text-slate-600">{t(T.liveCase.body)}</p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {T.liveCase.facts.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 grid h-4.5 w-4.5 flex-none place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">✓</span>
                      {t(f)}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── bento grid — the product, in boxes ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">{t(T.bentoKicker)}</div>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{t(T.bentoTitle)}</h2>
          </div>
        </Reveal>
        <div className="mt-10 grid auto-rows-[minmax(120px,auto)] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* QR ordering — hero cell */}
          <Reveal className="col-span-2 row-span-2">
            <div className="cell flex h-full flex-col justify-between rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white sm:p-7">
              <div>
                <div className="text-3xl">📱</div>
                <div className="mt-3 text-xl font-extrabold sm:text-2xl">{t(T.bento.qr.t)}</div>
                <p className="mt-2 max-w-sm text-sm text-emerald-50/90">{t(T.bento.qr.b)}</p>
              </div>
              {/* mini flow */}
              <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold">
                {[
                  { zh: "扫码", en: "Scan", fr: "Scanner" },
                  { zh: "下单", en: "Order", fr: "Commander" },
                  { zh: "出票", en: "Print", fr: "Imprimer" },
                  { zh: "入账", en: "Books", fr: "Comptes" },
                ].map((s, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-3 py-1.5 backdrop-blur">{t(s)}</span>
                    {i < arr.length - 1 && <span className="text-white/60">→</span>}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* kitchen ticket */}
          <Reveal delay={60} className="row-span-2">
            <div className="cell flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-5">
              <div className="text-2xl">🖨️</div>
              <div className="mt-2 font-extrabold">{t(T.bento.print.t)}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(T.bento.print.b)}</p>
              {/* mini ticket */}
              <div className="mt-4 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-700">
                <div className="text-center font-bold">唐人街小馆</div>
                <div className="my-1 border-t border-dashed border-slate-300" />
                <div className="text-center text-sm font-extrabold">堂食 · 桌 8A</div>
                <div className="my-1 border-t border-dashed border-slate-300" />
                <div className="text-[13px] font-bold">×2 游水青斑火锅</div>
                <div className="text-[13px] font-bold">×1 走地鸡窝（半）</div>
                <div className="mt-1 border border-slate-400 px-1 py-0.5 font-bold">⚠ 不要辣</div>
              </div>
            </div>
          </Reveal>

          {/* sales & tax */}
          <Reveal delay={120}>
            <div className="cell h-full rounded-3xl border border-slate-100 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl">🧾</div>
                  <div className="mt-2 font-extrabold">{t(T.bento.tax.t)}</div>
                  <p className="mt-1 text-xs text-slate-500">{t(T.bento.tax.b)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-[10px] font-bold">
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">GST 5%</span>
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">PST 8%</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* market price */}
          <Reveal delay={160}>
            <div className="cell h-full rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <span className="rounded border border-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">时价</span>
              </div>
              <div className="mt-2 font-extrabold">{t(T.bento.market.t)}</div>
              <p className="mt-1 text-xs text-slate-600">{t(T.bento.market.b)}</p>
            </div>
          </Reveal>

          {/* sizes */}
          <Reveal delay={80}>
            <div className="cell h-full rounded-3xl border border-slate-100 bg-white p-5">
              <div className="text-2xl">🍲</div>
              <div className="mt-2 font-extrabold">{t(T.bento.sizes.t)}</div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                {["全", "半", "位", "中", "特大"].map((s) => (
                  <span key={s} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">{s}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">{t(T.bento.sizes.b)}</p>
            </div>
          </Reveal>

          {/* staff */}
          <Reveal delay={120}>
            <div className="cell h-full rounded-3xl border border-slate-100 bg-white p-5">
              <div className="text-2xl">👥</div>
              <div className="mt-2 font-extrabold">{t(T.bento.staff.t)}</div>
              <p className="mt-1 text-xs text-slate-500">{t(T.bento.staff.b)}</p>
            </div>
          </Reveal>

          {/* trilingual */}
          <Reveal delay={160}>
            <div className="cell h-full rounded-3xl border border-slate-100 bg-gradient-to-br from-sky-50 to-white p-5">
              <div className="flex gap-1 text-[11px] font-extrabold">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">EN</span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">FR</span>
                <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-white">中</span>
              </div>
              <div className="mt-2 font-extrabold">{t(T.bento.lang.t)}</div>
              <p className="mt-1 text-xs text-slate-500">{t(T.bento.lang.b)}</p>
            </div>
          </Reveal>

          {/* data safety */}
          <Reveal delay={200} className="col-span-2 lg:col-span-2">
            <div className="cell flex h-full items-center gap-4 rounded-3xl border border-slate-100 bg-slate-900 p-5 text-white">
              <div className="text-3xl">🔒</div>
              <div>
                <div className="font-extrabold">{t(T.bento.safe.t)}</div>
                <p className="mt-1 text-xs text-slate-300">{t(T.bento.safe.b)}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── differentiator: no bundled POS / hardware at cost ── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <Reveal>
          <div className="flex flex-col items-start gap-4 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6 sm:flex-row sm:items-center sm:gap-6">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white text-2xl shadow-sm">🔓</span>
            <div>
              <div className="text-lg font-extrabold tracking-tight">{t(T.diff.title)}</div>
              <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600">{t(T.diff.body)}</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── trust strip ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="text-center text-3xl font-extrabold tracking-tight">{t(T.trust.title)}</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {T.trust.items.map((item, i) => (
            <Reveal key={i} delay={i * 70}>
              <div className="cell h-full rounded-3xl border border-slate-100 bg-white/80 p-6 backdrop-blur">
                <div className="text-2xl">{item.icon}</div>
                <div className="mt-3 font-bold">{t(item.t)}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(item.b)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA band — beta, no prices ── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-r from-emerald-600 to-sky-600 px-8 py-14 text-center text-white sm:px-14">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t(T.ctaBand.title)}</h2>
            <p className="mx-auto mt-3 max-w-xl text-emerald-50/90">{t(T.ctaBand.body)}</p>
            <Link
              href="/get-started"
              className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-white px-8 py-3.5 text-base font-bold text-emerald-700 shadow-xl transition hover:bg-emerald-50"
            >
              {t(T.ctaStart)} <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>
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
