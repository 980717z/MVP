"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLang, LangToggle, type Dict } from "@/app/i18n";

const TYPES: { key: string; label: Dict }[] = [
  { key: "restaurant", label: { zh: "餐厅", en: "Restaurant", fr: "Restaurant" } },
  { key: "cafe", label: { zh: "咖啡 / 奶茶", en: "Cafe / Bubble tea", fr: "Café / Bubble tea" } },
  { key: "bakery", label: { zh: "烘焙", en: "Bakery", fr: "Boulangerie" } },
  { key: "grocery", label: { zh: "超市 / 便利店", en: "Grocery / convenience", fr: "Épicerie / dépanneur" } },
  { key: "other", label: { zh: "其他", en: "Other", fr: "Autre" } },
];

const LOCATIONS: { key: string; label: Dict }[] = [
  { key: "1", label: { zh: "1 家", en: "1", fr: "1" } },
  { key: "2-3", label: { zh: "2–3 家", en: "2–3", fr: "2–3" } },
  { key: "4+", label: { zh: "4 家以上", en: "4+", fr: "4+" } },
];

const MODULES: { key: string; label: Dict }[] = [
  { key: "orders", label: { zh: "订单", en: "Orders", fr: "Commandes" } },
  { key: "inventory", label: { zh: "库存", en: "Inventory", fr: "Inventaire" } },
  { key: "suppliers", label: { zh: "供应商", en: "Suppliers", fr: "Fournisseurs" } },
  { key: "shifts", label: { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" } },
  { key: "reconcile", label: { zh: "对账", en: "Reconcile", fr: "Rapprochement" } },
  { key: "members", label: { zh: "会员", en: "Members", fr: "Membres" } },
  { key: "qr", label: { zh: "扫码菜单", en: "QR menu", fr: "Menu QR" } },
  { key: "reports", label: { zh: "报表", en: "Reports", fr: "Rapports" } },
];

const T = {
  back: { zh: "← 返回官网", en: "← Back to site", fr: "← Retour au site" },
  title: { zh: "免费开始", en: "Get started", fr: "Commencer" },
  sub: {
    zh: "留下几条基本信息，我们为你搭好专属后台，并尽快与你联系。",
    en: "Tell us a few basics — we'll set up your back-office and reach out shortly.",
    fr: "Donnez-nous quelques informations — nous préparons votre back-office et vous recontactons rapidement.",
  },
  bizName: { zh: "店铺名称", en: "Business name", fr: "Nom du commerce" },
  bizNamePh: { zh: "例如：富来小厨", en: "e.g. Sang's Great Seafood", fr: "ex. : Sang's Great Seafood" },
  bizType: { zh: "店铺类型", en: "Business type", fr: "Type de commerce" },
  email: { zh: "邮箱", en: "Email", fr: "Courriel" },
  phone: { zh: "电话（选填）", en: "Phone (optional)", fr: "Téléphone (facultatif)" },
  locations: { zh: "门店数量", en: "Locations", fr: "Nombre de sites" },
  modules: { zh: "感兴趣的功能", en: "Interested modules", fr: "Modules qui vous intéressent" },
  modulesHint: { zh: "可多选 · 选填", en: "Pick any · optional", fr: "Plusieurs choix · facultatif" },
  notes: { zh: "备注（选填）", en: "Notes (optional)", fr: "Remarques (facultatif)" },
  notesPh: {
    zh: "想先解决的问题、上线时间等……",
    en: "What you want to solve first, timeline, etc.",
    fr: "Ce que vous voulez régler en premier, échéancier, etc.",
  },
  submit: { zh: "提交", en: "Submit", fr: "Envoyer" },
  submitting: { zh: "提交中…", en: "Submitting…", fr: "Envoi…" },
  errName: { zh: "请填写店铺名称", en: "Please enter your business name", fr: "Veuillez saisir le nom du commerce" },
  errEmail: { zh: "请填写有效邮箱", en: "Please enter a valid email", fr: "Veuillez saisir un courriel valide" },
  doneTitle: { zh: "收到了，谢谢！", en: "Thanks — got it!", fr: "Bien reçu, merci !" },
  doneBody: {
    zh: "我们会尽快通过你留下的邮箱与你联系。你也可以现在就创建账号或先看看演示。",
    en: "We'll be in touch at the email you provided. You can create your account now or explore the demo.",
    fr: "Nous vous contacterons au courriel fourni. Vous pouvez créer votre compte ou voir la démo.",
  },
  createAccount: { zh: "创建账号 →", en: "Create your account →", fr: "Créer votre compte →" },
  exploreDemo: { zh: "先看演示", en: "Explore the demo", fr: "Voir la démo" },
};

export default function GetStarted() {
  const { lang, t } = useLang();

  const [name, setName] = useState("");
  const [type, setType] = useState("restaurant");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locations, setLocations] = useState("1");
  const [modules, setModules] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ name?: boolean; email?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const toggleModule = (key: string) =>
    setModules((m) => (m.includes(key) ? m.filter((x) => x !== key) : [...m, key]));

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = { name: !name.trim(), email: !validEmail(email.trim()) };
    setErrors(errs);
    if (errs.name || errs.email) return;

    setBusy(true);
    try {
      const { error } = await supabase.from("leads").insert({
        business_name: name.trim(),
        business_type: type,
        email: email.trim(),
        phone: phone.trim() || null,
        locations,
        modules,
        notes: notes.trim() || null,
        lang,
      });
      // Never block the prospect on a backend hiccup; the lead UX still completes.
      if (error) console.error("lead insert failed:", error.message);
    } catch (err) {
      console.error("lead insert error:", err);
    } finally {
      setBusy(false);
      setDone(true);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-48 -left-32 h-[34rem] w-[34rem] rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -top-32 right-0 h-[30rem] w-[30rem] rounded-full bg-sky-100/60 blur-3xl" />
      </div>

      {/* nav */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 text-base shadow-sm">🍱</span>
          <span className="text-lg font-bold tracking-tight text-slate-900">BentoOS</span>
        </Link>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Link href="/" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
            {t(T.back)}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-xl px-6 pb-24 pt-6">
        {done ? (
          <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-2xl">✅</div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{t(T.doneTitle)}</h1>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-slate-600">{t(T.doneBody)}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700"
              >
                {t(T.createAccount)}
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {t(T.exploreDemo)}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t(T.title)}</h1>
            <p className="mt-3 text-pretty text-slate-600">{t(T.sub)}</p>

            <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
              {/* business name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.bizName)}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(T.bizNamePh)}
                  className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.name ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-emerald-400"
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{t(T.errName)}</p>}
              </div>

              {/* business type */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.bizType)}</label>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setType(o.key)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        type === o.key
                          ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {t(o.label)}
                    </button>
                  ))}
                </div>
              </div>

              {/* email + phone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.email)}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@shop.com"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/20 ${
                      errors.email ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-emerald-400"
                    }`}
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{t(T.errEmail)}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.phone)}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(416) 000-0000"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* locations */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.locations)}</label>
                <div className="flex flex-wrap gap-2">
                  {LOCATIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setLocations(o.key)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        locations === o.key
                          ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700"
                          : "border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {t(o.label)}
                    </button>
                  ))}
                </div>
              </div>

              {/* modules */}
              <div>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <label className="block text-sm font-medium text-slate-700">{t(T.modules)}</label>
                  <span className="text-xs text-slate-400">{t(T.modulesHint)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODULES.map((o) => {
                    const on = modules.includes(o.key);
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => toggleModule(o.key)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                          on
                            ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {t(o.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t(T.notes)}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t(T.notesPh)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-60"
              >
                {busy ? t(T.submitting) : t(T.submit)}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
