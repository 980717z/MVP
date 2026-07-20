"use client";

// ─────────────────────────────────────────────────────────────────────────
//  utoronto.bentoos.io — vision/waitlist manifesto for the UofT food-pickup
//  community. Served at /utoronto (next.config host-rewrite maps the subdomain).
//
//  Strategy (see ~/.gstack/projects/980717z-MVP/ceo-plans/2026-07-14-utoronto-
//  food-pickup.md): this page is a CREDIBILITY PROP — the 1:1 selling closes
//  merchants. So it captures BOTH sides to a waitlist and funnels vendors to a
//  conversation. NO public pricing (name the service, ask for a meet). Flagship
//  name stays anonymized until written authorization.
//
//  Brand: BentoOS platform (DESIGN-PLATFORM.md) — emerald accent, warm neutrals.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useLang, LangToggle, type Dict } from "@/app/i18n";
import LiveOrderFlow from "@/components/LiveOrderFlow";
import StudentFlowFrames from "@/components/StudentFlowFrames";
import RequestDemo from "@/components/RequestDemo";
import { BentoMark } from "@/components/BentoMark";
import { track } from "@/lib/track";

type Role = "student" | "vendor";

const T = {
  wordmark: { zh: "BentoOS 校园", en: "BentoOS Campus", fr: "BentoOS Campus" },
  atUofT: { zh: "校园", en: "Campus", fr: "Campus" },
  joinCta: { zh: "加入候补 →", en: "Join waitlist →", fr: "Rejoindre →" },
  hero: {
    zh: "免费的点餐系统,为你带来客人。",
    en: "A free ordering system that brings you customers.",
    fr: "Un système de commande gratuit qui vous amène des clients.",
  },
  sub: {
    zh: "学生提前下单、免去排队。无需采购,用你现有的手机就能跑,款项直接进你的账户。",
    en: "Students order ahead and skip your line. Nothing to buy, runs on the phone you already have, and every payment goes straight to you.",
    fr: "Les étudiants commandent à l'avance et évitent la file. Rien à acheter, fonctionne sur votre téléphone, et chaque paiement vous revient directement.",
  },
  // waitlist card
  join: { zh: "加入候补名单", en: "Join the waitlist", fr: "Rejoindre la liste" },
  student: { zh: "我是学生", en: "I'm a student", fr: "Je suis étudiant·e" },
  vendor: { zh: "我是商家", en: "I run a food truck/kiosk", fr: "J'ai un camion/kiosque" },
  joinVendor: { zh: "带上你的菜单,我们帮你上线", en: "Bring your menu, we set you up", fr: "Apportez votre menu, on vous installe" },
  emailPh: { zh: "你的邮箱", en: "Your email", fr: "Votre courriel" },
  namePh: { zh: "餐车 / 档口名字", en: "Food truck / kiosk name", fr: "Nom du camion / kiosque" },
  ctaStudent: { zh: "抢先体验 →", en: "Get early access →", fr: "Accès anticipé →" },
  ctaVendor: { zh: "带上你的菜单 →", en: "Bring your menu →", fr: "Apportez votre menu →" },
  sending: { zh: "提交中…", en: "Sending…", fr: "Envoi…" },
  okStudent: { zh: "搞定！开放时第一个通知你 🎉", en: "You're on the list. We'll ping you first 🎉", fr: "Vous êtes inscrit·e. On vous écrit en premier 🎉" },
  okVendor: { zh: "收到！我们会尽快联系你聊聊 🎉", en: "Got it. We'll reach out to talk soon 🎉", fr: "Reçu. On vous contacte bientôt 🎉" },
  err: { zh: "出错了，请填写邮箱后重试", en: "Something went wrong. Check your email and retry", fr: "Une erreur. Vérifiez le courriel et réessayez" },
  needEmail: { zh: "请填写邮箱", en: "Enter your email", fr: "Entrez votre courriel" },
  needName: { zh: "请填写餐车名字", en: "Enter your truck name", fr: "Entrez le nom du camion" },
  // vendor band
  vbTitle: { zh: "有餐车或档口?", en: "Run a truck or kiosk?", fr: "Un camion ou kiosque?" },
  vbBody: {
    zh: "我们为你带来学生客源,款项直接进你的账户,免费上线。",
    en: "We bring you the students, every payment goes straight to you, and it's free to get set up.",
    fr: "On vous amène les étudiants, chaque paiement vous revient directement, et l'installation est gratuite.",
  },
  vbCta: { zh: "聊一聊 →", en: "Let's talk →", fr: "Parlons-en →" },
  // proof + footer
  proof: { zh: "已在多伦多一家繁忙的海鲜厨房运行", en: "Already powering a busy Toronto seafood kitchen", fr: "Déjà en service dans une cuisine de fruits de mer achalandée à Toronto" },
  soon: { zh: "校园招募中 · 敬请期待", en: "Recruiting on campus now · coming soon", fr: "Recrutement sur le campus · bientôt" },
  heroBadge: { zh: "正在招募圣乔治周边餐饮商家", en: "Now onboarding food spots around St. George", fr: "Recrutement des comptoirs autour de St. George" },
  // footer
  ftTagline: { zh: "圣乔治校园的订餐取餐操作系统。", en: "Order-ahead pickup for the St. George food community.", fr: "Commande et retrait pour la communauté alimentaire de St. George." },
  ftExplore: { zh: "探索", en: "Explore", fr: "Explorer" },
  ftContact: { zh: "联系我们", en: "Contact", fr: "Contact" },
  ftStudents: { zh: "学生候补名单", en: "For students", fr: "Pour étudiants" },
  ftVendors: { zh: "商家申请演示", en: "For vendors", fr: "Pour commerçants" },
  ftBuilt: { zh: "多伦多制造 🇨🇦", en: "Built in Toronto 🇨🇦", fr: "Conçu à Toronto 🇨🇦" },
  ftMainSite: { zh: "BentoOS.io 主站 ↗", en: "BentoOS.io main site ↗", fr: "Site principal BentoOS.io ↗" },
  ftPrivacy: { zh: "隐私", en: "Privacy", fr: "Confidentialité" },
  ftDisclaimer: {
    zh: "BentoOS 为独立服务,与多伦多大学无隶属、代言或赞助关系。",
    en: "BentoOS is an independent service. It is not affiliated with, endorsed by, or sponsored by the University of Toronto.",
    fr: "BentoOS est un service indépendant. Il n'est ni affilié, ni approuvé, ni commandité par l'Université de Toronto.",
  },
  // header merchant-demo link
  merchantDemo: { zh: "商家后台 ↗", en: "Merchant demo ↗", fr: "Démo marchand ↗" },
  forBusiness: { zh: "商户版 ↗", en: "For business ↗", fr: "Pour entreprises ↗" },
  signIn: { zh: "登录", en: "Sign in", fr: "Connexion" },
  // back-office (vendor) section
  boEyebrow: { zh: "不止点餐", en: "More than ordering", fr: "Plus que la commande" },
  boTitle: { zh: "不只是点餐,它管好你整间店。", en: "Not just ordering. It runs your whole shop.", fr: "Pas seulement la commande. Ça gère tout votre commerce." },
  boSub: {
    zh: "实时订单、销售分析、库存采购、每日对账,后台都替你算好。同一部手机,同样免费。",
    en: "Live orders, sales, inventory, and daily books. The back office does the math for you. Same phone, same free system.",
    fr: "Commandes en direct, ventes, stocks et comptes quotidiens. L'arrière-boutique fait les calculs. Même téléphone, même système gratuit.",
  },
  pill1t: { zh: "全部免费", en: "Free to run", fr: "Gratuit" },
  pill1b: { zh: "扫码菜单、提前下单、经营后台。没有月费、没有抽成、每单也不收费。", en: "The QR menu, order-ahead, and back office. No monthly fee, no commission, no per-order fee.", fr: "Le menu QR, la commande à l'avance et l'arrière-boutique. Sans abonnement, sans commission, sans frais par commande." },
  pill2t: { zh: "无需采购", en: "Nothing to buy", fr: "Rien à acheter" },
  pill2b: { zh: "不用 POS 机、不用硬件、无合约、不锁定。", en: "No POS terminal, no hardware, no contracts, no lock-in.", fr: "Pas de terminal, pas de matériel, pas de contrat, aucun verrouillage." },
  pill3t: { zh: "手机就是收银台", en: "Your phone is the POS", fr: "Votre téléphone suffit" },
  pill3b: { zh: "用你现有的手机或平板就能跑,几分钟上线。", en: "Runs on the phone or tablet you already have. Live in minutes.", fr: "Fonctionne sur le téléphone ou la tablette que vous avez déjà. En ligne en quelques minutes." },
  boLive: { zh: "看看实时后台 →", en: "Try the live dashboard →", fr: "Voir le tableau de bord →" },
  boTour: { zh: "先逛一圈演示 →", en: "Take the guided tour →", fr: "Faire la visite guidée →" },
  boSample: { zh: "演示为示例数据", en: "Demo shows sample data", fr: "Démo avec données d'exemple" },
  // four capability shots
  capOrdersT: { zh: "实时订单 · 取餐", en: "Live orders & pickup", fr: "Commandes en direct" },
  capOrdersB: { zh: "新单即时提醒:接单 → 备餐 → 可取餐 → 已取,一屏搞定。", en: "Orders land in real time. Accept, prep, ready, picked-up, all on one screen.", fr: "Commandes en temps réel. Accepter, préparer, prêt, récupéré, sur un écran." },
  capSalesT: { zh: "销售分析", en: "Sales analytics", fr: "Analyse des ventes" },
  capSalesB: { zh: "营业额、热销菜、按时段与桌号,趋势一目了然。", en: "Revenue, top dishes, trends by hour and table. See what sells.", fr: "Revenus, plats vedettes, tendances par heure. Voyez ce qui se vend." },
  capInvT: { zh: "库存 · 采购", en: "Inventory & purchasing", fr: "Stock et achats" },
  capInvB: { zh: "库存水位、补货预警、供应商,别再断货。", en: "Stock levels, low-stock alerts, suppliers. Stop running out.", fr: "Niveaux de stock, alertes, fournisseurs. Ne manquez plus de rien." },
  capBooksT: { zh: "对账 · 记账", en: "Daily books & reconcile", fr: "Comptes et caisse" },
  capBooksB: { zh: "每日现金刷卡对账,差异自动标红,月底不头疼。", en: "Daily cash & card reconciliation, variances flagged. Month-end made easy.", fr: "Rapprochement caisse/carte quotidien, écarts signalés. Fin de mois facile." },
} satisfies Record<string, Dict>;

export default function UofTLanding() {
  const { t } = useLang();
  // Vendor-only page: students never see this landing (they arrive via the truck's
  // QR). Role is fixed to vendor; the signup collects the truck name + email.
  const [role] = useState<Role>("vendor");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async () => {
    if (!email.trim()) { setStatus("error"); return; }
    if (role === "vendor" && !name.trim()) { setStatus("error"); return; }
    setStatus("busy");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: role === "vendor" ? name.trim() : (name.trim() || "UofT student"),
          business_type: role === "vendor" ? "food-truck" : "student",
          email: email.trim(),
          notes: `source: utoronto-waitlist · role: ${role}`,
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const scrollToJoin = () => document.getElementById("join")?.scrollIntoView({ behavior: "smooth" });

  // Sticky-header CTA: the "Join waitlist" button fades in once the hero signup
  // card has scrolled out of view (so there's always a one-tap path back to it).
  const [pastHero, setPastHero] = useState(false);
  const [demoOpenSignal, setDemoOpenSignal] = useState(0); // vendor band → opens the Request-a-demo form
  const openDemo = () => {
    setDemoOpenSignal((n) => n + 1);
    document.getElementById("backoffice")?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    const el = document.getElementById("join");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => { track("campus_page_view"); }, []); // /admin funnel top

  return (
    <main id="top" className="min-h-screen bg-[#FBFAF8] text-ink" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* header */}
      <header className="sticky top-0 z-30 border-b border-[#EBEAE5]/70 bg-[#FBFAF8]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#top" className="flex items-center gap-2" aria-label="BentoOS Campus">
            <BentoMark className="h-7 w-7 shadow-sm" />
            <span className="text-lg tracking-tight">
              <span className="font-extrabold text-ink">BentoOS</span>
              <span className="ml-1 font-semibold text-brand-ink/70">{t(T.atUofT)}</span>
            </span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={scrollToJoin}
              className={`hidden rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white transition-all duration-300 hover:opacity-90 sm:inline-flex ${pastHero ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
            >
              {t(T.joinCta)}
            </button>
            <a href="#backoffice" className="hidden text-sm font-semibold text-brand-ink hover:text-brand sm:inline">{t(T.merchantDemo)}</a>
            <a href="/campus/login" className="text-sm font-semibold text-brand-ink hover:text-brand">{t(T.signIn)}</a>
            <a href="https://bentoos.io" className="hidden text-sm font-medium text-ink-soft transition hover:text-ink sm:inline">{t(T.forBusiness)}</a>
            <LangToggle />
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-5 pb-10 pt-8 text-center sm:pt-16">
        <div className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand-ink">
          🚚 {t(T.heroBadge)}
        </div>
        <h1 className="rise text-balance text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl" style={{ animationDelay: "60ms" }}>
          {t(T.hero)}
        </h1>
        <p className="rise mx-auto mt-4 max-w-xl text-balance text-lg text-ink-soft" style={{ animationDelay: "120ms" }}>{t(T.sub)}</p>

        {/* waitlist card */}
        <div id="join" style={{ animationDelay: "180ms" }} className="rise mx-auto mt-8 max-w-md scroll-mt-20 rounded-2xl border border-[#EBEAE5] bg-white p-5 text-left shadow-sm">
          {status === "done" ? (
            <div className="py-6 text-center">
              <div className="text-2xl">🎉</div>
              <p className="mt-2 font-semibold text-ink">{t(role === "vendor" ? T.okVendor : T.okStudent)}</p>
            </div>
          ) : (
            <>
              <div className="mb-3 text-sm font-bold text-ink">{t(T.joinVendor)}</div>
              <div className="space-y-2">
                {(role === "vendor") && (
                  <input
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (status === "error") setStatus("idle"); }}
                    placeholder={t(T.namePh)}
                    className="w-full rounded-lg border border-[#E3E2DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                )}
                <input
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                  type="email"
                  inputMode="email"
                  placeholder={t(T.emailPh)}
                  className="w-full rounded-lg border border-[#E3E2DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <button
                  onClick={submit}
                  disabled={status === "busy"}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {status === "busy" ? t(T.sending) : t(role === "vendor" ? T.ctaVendor : T.ctaStudent)}
                </button>
                {status === "error" && (
                  <p className="text-center text-xs font-medium text-red-600">
                    {!email.trim() ? t(T.needEmail) : role === "vendor" && !name.trim() ? t(T.needName) : t(T.err)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* the student flow, shown: choose a truck → menu → order ahead → skip line.
          The captioned phone frames ARE the how-it-works (no separate text storyboard). */}
      <StudentFlowFrames />

      {/* live QR → dashboard demo (real scannable QR + animated order arrival) */}
      <LiveOrderFlow />

      {/* back-office (vendor) section — "way more than a QR menu": the free QR
          ordering is the front door; the paid platform runs the whole shop. Real
          screenshots (public/shots) captured from the /demo tour. */}
      <section id="backoffice" className="scroll-mt-16 border-y border-[#EBEAE5] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rise text-xs font-bold uppercase tracking-[0.15em] text-brand-ink">{t(T.boEyebrow)}</div>
            <h2 className="rise mt-2 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl" style={{ animationDelay: "60ms" }}>{t(T.boTitle)}</h2>
            <p className="rise mx-auto mt-3 max-w-xl text-balance text-ink-soft" style={{ animationDelay: "120ms" }}>{t(T.boSub)}</p>
            <div className="rise mt-6" style={{ animationDelay: "180ms" }}>
              <RequestDemo openSignal={demoOpenSignal} />
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[
              { img: "/shots/orders.png", title: T.capOrdersT, body: T.capOrdersB },
              { img: "/shots/sales.png", title: T.capSalesT, body: T.capSalesB },
              { img: "/shots/inventory.png", title: T.capInvT, body: T.capInvB },
              { img: "/shots/books.png", title: T.capBooksT, body: T.capBooksB },
            ].map((c, i) => (
              <div key={c.img} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="overflow-hidden rounded-xl border border-[#EBEAE5] bg-[#FBFAF8] shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.img} alt={t(c.title)} loading="lazy" className="block w-full" />
                </div>
                <div className="mt-3 px-1">
                  <div className="text-base font-bold text-ink">{t(c.title)}</div>
                  <p className="mt-0.5 text-sm text-ink-soft">{t(c.body)}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-faint">{t(T.boSample)}</p>
        </div>
      </section>

      {/* vendor band */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-brand p-7 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="text-xl font-extrabold">{t(T.vbTitle)}</div>
            <p className="mt-1 text-sm text-white/90">{t(T.vbBody)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              <span className="font-semibold">Allen Zhang</span>
              <a href="tel:+15143574178" className="underline-offset-2 hover:text-white hover:underline">📞 +1 (514) 357-4178</a>
              <a href="mailto:allen.zhang@bentoos.io" className="underline-offset-2 hover:text-white hover:underline">✉️ allen.zhang@bentoos.io</a>
            </div>
          </div>
          <button
            onClick={openDemo}
            className="flex-none rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-ink transition hover:bg-white/90"
          >
            {t(T.vbCta)}
          </button>
        </div>
      </section>

      <footer className="border-t border-[#EBEAE5] bg-white">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="flex flex-col gap-9 sm:flex-row sm:justify-between">
            {/* brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-2">
                <BentoMark className="h-8 w-8 shadow-sm" />
                <span className="text-lg font-extrabold tracking-tight text-ink">BentoOS</span>
              </div>
              <p className="mt-3 text-sm text-ink-soft">{t(T.ftTagline)}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {t(T.soon)}
              </div>
            </div>

            {/* link columns */}
            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">{t(T.ftExplore)}</div>
                <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
                  <li><button onClick={scrollToJoin} className="transition hover:text-brand-ink">{t(T.join)}</button></li>
                  <li><a href="#backoffice" className="transition hover:text-brand-ink">{t(T.ftVendors)}</a></li>
                  <li><a href="/demo" className="transition hover:text-brand-ink">{t(T.boTour)}</a></li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">{t(T.ftContact)}</div>
                <ul className="mt-3 space-y-2.5 text-sm text-ink-soft">
                  <li className="font-semibold text-ink">Allen Zhang</li>
                  <li><a href="tel:+15143574178" className="transition hover:text-brand-ink">+1 (514) 357-4178</a></li>
                  <li><a href="mailto:allen.zhang@bentoos.io" className="transition hover:text-brand-ink">allen.zhang@bentoos.io</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* bottom bar */}
          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[#EBEAE5] pt-6 text-xs text-ink-faint sm:flex-row">
            <span>© 2026 BentoOS · {t(T.ftBuilt)}</span>
            <div className="flex items-center gap-4">
              <a href="/privacy" className="transition hover:text-brand-ink">{t(T.ftPrivacy)}</a>
              <a href="https://bentoos.io" className="font-medium text-brand-ink transition hover:text-brand">{t(T.ftMainSite)}</a>
            </div>
          </div>
          {/* Independence disclaimer — campus-neutral: reduces implied-affiliation
              trademark risk while using the utoronto surface. Not legal advice. */}
          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">{t(T.ftDisclaimer)}</p>
        </div>
      </footer>
    </main>
  );
}
