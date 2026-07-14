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

import { useState } from "react";
import { useLang, LangToggle, type Dict } from "@/app/i18n";

type Role = "student" | "vendor";

const T = {
  wordmark: { zh: "BentoOS · 多大", en: "BentoOS · UofT", fr: "BentoOS · UofT" },
  hero: {
    zh: "多大校园取餐社区的操作系统",
    en: "The operating system for UofT's food pickup community",
    fr: "Le système d'exploitation de la communauté de ramassage alimentaire de UofT",
  },
  sub: {
    zh: "免排队。提前下单，校园餐车与小吃摊，到店即取。",
    en: "Skip the line. Order ahead from campus food trucks and kiosks — ready when you arrive.",
    fr: "Sautez la file. Commandez à l'avance des camions et kiosques du campus — prêt à votre arrivée.",
  },
  // waitlist card
  join: { zh: "加入候补名单", en: "Join the waitlist", fr: "Rejoindre la liste" },
  student: { zh: "我是学生", en: "I'm a student", fr: "Je suis étudiant·e" },
  vendor: { zh: "我是商家", en: "I run a food truck/kiosk", fr: "J'ai un camion/kiosque" },
  emailPh: { zh: "你的邮箱", en: "Your email", fr: "Votre courriel" },
  namePh: { zh: "餐车 / 档口名字", en: "Food truck / kiosk name", fr: "Nom du camion / kiosque" },
  ctaStudent: { zh: "抢先体验 →", en: "Get early access →", fr: "Accès anticipé →" },
  ctaVendor: { zh: "带上你的菜单 →", en: "Bring your menu →", fr: "Apportez votre menu →" },
  sending: { zh: "提交中…", en: "Sending…", fr: "Envoi…" },
  okStudent: { zh: "搞定！开放时第一个通知你 🎉", en: "You're on the list — we'll ping you first 🎉", fr: "Vous êtes inscrit·e — on vous écrit en premier 🎉" },
  okVendor: { zh: "收到！我们会尽快联系你聊聊 🎉", en: "Got it — we'll reach out to talk soon 🎉", fr: "Reçu — on vous contacte bientôt 🎉" },
  err: { zh: "出错了，请填写邮箱后重试", en: "Something went wrong — check your email and retry", fr: "Une erreur — vérifiez le courriel et réessayez" },
  needEmail: { zh: "请填写邮箱", en: "Enter your email", fr: "Entrez votre courriel" },
  needName: { zh: "请填写餐车名字", en: "Enter your truck name", fr: "Entrez le nom du camion" },
  // vision strip
  how: { zh: "怎么用", en: "How it works", fr: "Comment ça marche" },
  s1t: { zh: "一处逛全部", en: "Browse in one place", fr: "Parcourez au même endroit" },
  s1b: { zh: "校园每个餐车、档口，一个页面全看到。", en: "Every campus truck and kiosk, on one page.", fr: "Chaque camion et kiosque du campus, sur une page." },
  s2t: { zh: "提前下单", en: "Order ahead", fr: "Commandez à l'avance" },
  s2b: { zh: "上课前点好，付款用你习惯的方式。", en: "Tap before class; pay however you like.", fr: "Commandez avant le cours; payez comme vous voulez." },
  s3t: { zh: "到店即取", en: "Walk up, skip the line", fr: "Arrivez, sautez la file" },
  s3b: { zh: "不排队，到了直接拿。", en: "No lineup — it's ready when you get there.", fr: "Pas de file — c'est prêt à votre arrivée." },
  // vendor band
  vbTitle: { zh: "有餐车或档口?", en: "Run a truck or kiosk?", fr: "Un camion ou kiosque?" },
  vbBody: {
    zh: "免费的扫码点餐系统，我们把学生带给你。没有抽成套路——每单只收几分钱。我们帮你上线。",
    en: "Free QR ordering. We bring you the students. No commission games — just a few cents an order. We get you set up.",
    fr: "Commande QR gratuite. On vous amène les étudiants. Pas de commissions — quelques cents par commande. On vous installe.",
  },
  vbCta: { zh: "聊一聊 →", en: "Let's talk →", fr: "Parlons-en →" },
  // proof + footer
  proof: { zh: "已在多伦多一家繁忙的海鲜厨房运行", en: "Already powering a busy Toronto seafood kitchen", fr: "Déjà en service dans une cuisine de fruits de mer achalandée à Toronto" },
  soon: { zh: "校园招募中 · 敬请期待", en: "Recruiting on campus now · coming soon", fr: "Recrutement sur le campus · bientôt" },
  heroBadge: { zh: "正在招募 UofT 周边餐饮商家", en: "Now onboarding food spots around UofT", fr: "Recrutement des comptoirs autour de UofT" },
  // header merchant-demo link
  merchantDemo: { zh: "商家后台 ↗", en: "Merchant demo ↗", fr: "Démo marchand ↗" },
  // back-office (vendor) section
  boEyebrow: { zh: "不止点单", en: "More than ordering", fr: "Plus que la commande" },
  boTitle: { zh: "一套系统,管好整间店", en: "One system runs the whole shop", fr: "Un système pour toute la boutique" },
  boSub: {
    zh: "免费的扫码点餐只是入口。销售分析、库存采购、每日对账记账——后台都替你算好。",
    en: "Free QR ordering is just the front door. Sales analytics, inventory, daily cash & books — the back office does the math for you.",
    fr: "La commande QR gratuite n'est que la porte d'entrée. Analyses des ventes, stocks, caisse et comptes quotidiens — l'arrière-boutique fait les calculs.",
  },
  boLive: { zh: "看看实时后台 →", en: "Try the live dashboard →", fr: "Voir le tableau de bord →" },
  boTour: { zh: "先逛一圈演示 →", en: "Take the guided tour →", fr: "Faire la visite guidée →" },
  boSample: { zh: "演示为示例数据", en: "Demo shows sample data", fr: "Démo avec données d'exemple" },
  // four capability shots
  capOrdersT: { zh: "实时订单 · 取餐", en: "Live orders & pickup", fr: "Commandes en direct" },
  capOrdersB: { zh: "新单即时提醒:接单 → 备餐 → 可取餐 → 已取,一屏搞定。", en: "Orders land in real time — accept, prep, ready, picked-up, all on one screen.", fr: "Commandes en temps réel — accepter, préparer, prêt, récupéré, sur un écran." },
  capSalesT: { zh: "销售分析", en: "Sales analytics", fr: "Analyse des ventes" },
  capSalesB: { zh: "营业额、热销菜、按时段与桌号,趋势一目了然。", en: "Revenue, top dishes, trends by hour and table — see what sells.", fr: "Revenus, plats vedettes, tendances par heure — voyez ce qui se vend." },
  capInvT: { zh: "库存 · 采购", en: "Inventory & purchasing", fr: "Stock et achats" },
  capInvB: { zh: "库存水位、补货预警、供应商——别再断货。", en: "Stock levels, low-stock alerts, suppliers — stop running out.", fr: "Niveaux de stock, alertes, fournisseurs — ne manquez plus de rien." },
  capBooksT: { zh: "对账 · 记账", en: "Daily books & reconcile", fr: "Comptes et caisse" },
  capBooksB: { zh: "每日现金刷卡对账,差异自动标红,月底不头疼。", en: "Daily cash & card reconciliation, variances flagged — month-end made easy.", fr: "Rapprochement caisse/carte quotidien, écarts signalés — fin de mois facile." },
} satisfies Record<string, Dict>;

export default function UofTLanding() {
  const { t } = useLang();
  const [role, setRole] = useState<Role>("student");
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

  return (
    <main className="min-h-screen bg-[#FBFAF8] text-ink" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", system-ui, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="text-lg font-extrabold tracking-tight text-ink">{t(T.wordmark)}</div>
        <div className="flex items-center gap-3">
          <a href="#backoffice" className="hidden text-sm font-semibold text-brand-ink hover:text-brand sm:inline">{t(T.merchantDemo)}</a>
          <LangToggle />
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-5 pb-10 pt-8 text-center sm:pt-16">
        <div className="rise mb-5 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand-ink">
          🎓 {t(T.heroBadge)}
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
              {/* role toggle */}
              <div className="mb-3 flex rounded-xl bg-[#F3F2EE] p-1 text-sm font-semibold">
                {(["student", "vendor"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRole(r); if (status === "error") setStatus("idle"); }}
                    className={`flex-1 rounded-lg py-2 transition ${role === r ? "bg-white text-brand-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
                  >
                    {t(r === "student" ? T.student : T.vendor)}
                  </button>
                ))}
              </div>
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
        <p className="rise mt-3 text-xs text-ink-soft" style={{ animationDelay: "240ms" }}>✓ {t(T.proof)}</p>
      </section>

      {/* vision strip — a connected LEFT→RIGHT journey (browse → order → skip the line),
          not a 3-up card grid. Big ghost numerals + arrows read as a storyboard. */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="mb-10 text-center text-sm font-bold uppercase tracking-[0.15em] text-ink-soft">{t(T.how)}</h2>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-3">
          {[
            { n: "1", t: T.s1t, b: T.s1b },
            { n: "2", t: T.s2t, b: T.s2b },
            { n: "3", t: T.s3t, b: T.s3b },
          ].map((s, i) => (
            <div key={s.n} className="contents">
              <div className="rise flex-1" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="text-5xl font-extrabold leading-none text-brand/20">{s.n}</div>
                <div className="mt-2 text-lg font-bold text-ink">{t(s.t)}</div>
                <p className="mt-1 text-sm text-ink-soft">{t(s.b)}</p>
              </div>
              {i < 2 && (
                <div className="select-none self-center text-2xl font-light text-brand/40 sm:pt-4" aria-hidden="true">
                  <span className="hidden sm:inline">→</span>
                  <span className="block text-center sm:hidden">↓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* back-office (vendor) section — "way more than a QR menu": the free QR
          ordering is the front door; the paid platform runs the whole shop. Real
          screenshots (public/shots) captured from the /demo tour. */}
      <section id="backoffice" className="scroll-mt-16 border-y border-[#EBEAE5] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rise text-xs font-bold uppercase tracking-[0.15em] text-brand-ink">{t(T.boEyebrow)}</div>
            <h2 className="rise mt-2 text-balance text-3xl font-extrabold tracking-tight text-ink sm:text-4xl" style={{ animationDelay: "60ms" }}>{t(T.boTitle)}</h2>
            <p className="rise mx-auto mt-3 max-w-xl text-balance text-ink-soft" style={{ animationDelay: "120ms" }}>{t(T.boSub)}</p>
            <div className="rise mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
              <a href="/login?demo=1" className="w-full rounded-full bg-brand px-5 py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90 sm:w-auto">{t(T.boLive)}</a>
              <a href="/demo" className="w-full rounded-full border border-[#E3E2DC] bg-white px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:border-brand/40 sm:w-auto">{t(T.boTour)}</a>
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
              <a href="mailto:support@bentoos.io" className="underline-offset-2 hover:text-white hover:underline">✉️ support@bentoos.io</a>
            </div>
          </div>
          <button
            onClick={() => { setRole("vendor"); scrollToJoin(); }}
            className="flex-none rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-ink transition hover:bg-white/90"
          >
            {t(T.vbCta)}
          </button>
        </div>
      </section>

      <footer className="border-t border-[#EBEAE5] px-5 py-8 text-center text-xs text-ink-faint">
        BentoOS · {t(T.soon)}
      </footer>
    </main>
  );
}
