"use client";

// Gated demo request (replaces instant demo-account access). Captures a
// qualified lead — contact name, email, phone, business, revenue range —
// and posts to /api/leads (persists + emails the team). The fake-data guided
// tour (/demo) stays as the no-account instant peek. Brand: DESIGN-PLATFORM.
import { useEffect, useState } from "react";
import { useLang, type Dict } from "@/app/i18n";

const REVENUE: { v: string; label: Dict }[] = [
  { v: "under-10k", label: { zh: "月营业额 < $10k", en: "< $10k / month", fr: "< 10 k$ / mois" } },
  { v: "10-30k", label: { zh: "$10k–30k / 月", en: "$10k–30k / month", fr: "10–30 k$ / mois" } },
  { v: "30-75k", label: { zh: "$30k–75k / 月", en: "$30k–75k / month", fr: "30–75 k$ / mois" } },
  { v: "75k-plus", label: { zh: "$75k+ / 月", en: "$75k+ / month", fr: "75 k$+ / mois" } },
  { v: "new", label: { zh: "新店 / 还不确定", en: "New / not sure", fr: "Nouveau / incertain" } },
];

const T = {
  requestCta: { zh: "申请演示 →", en: "Request a demo →", fr: "Demander une démo →" },
  tour: { zh: "先逛一圈演示 →", en: "Take the guided tour →", fr: "Faire la visite guidée →" },
  formTitle: { zh: "申请一次量身演示", en: "Request a tailored demo", fr: "Demander une démo sur mesure" },
  formSub: { zh: "留个联系方式,我们带着适合你店的演示联系你。", en: "Leave your details and we'll reach out with a demo built for your shop.", fr: "Laissez vos coordonnées et nous vous présenterons une démo adaptée." },
  name: { zh: "联系人姓名", en: "Contact name", fr: "Nom du contact" },
  email: { zh: "邮箱", en: "Email", fr: "Courriel" },
  phone: { zh: "电话", en: "Phone", fr: "Téléphone" },
  business: { zh: "店铺 / 餐车名称", en: "Business name", fr: "Nom de l'entreprise" },
  revenue: { zh: "月营业额区间", en: "Monthly revenue range", fr: "Chiffre d'affaires mensuel" },
  revenuePh: { zh: "请选择…", en: "Select…", fr: "Choisir…" },
  submit: { zh: "提交申请", en: "Request demo", fr: "Envoyer la demande" },
  sending: { zh: "提交中…", en: "Sending…", fr: "Envoi…" },
  done: { zh: "收到!我们会尽快带着量身演示联系你 🎉", en: "Got it. We'll reach out with a tailored demo shortly 🎉", fr: "Reçu. Nous vous contactons bientôt avec une démo sur mesure 🎉" },
  errRequired: { zh: "请填写姓名、邮箱、电话和店铺名称", en: "Please add your name, email, phone and business name", fr: "Ajoutez nom, courriel, téléphone et entreprise" },
  errGeneric: { zh: "出错了,请重试", en: "Something went wrong, please retry", fr: "Une erreur, réessayez" },
} satisfies Record<string, Dict>;

export default function RequestDemo({ openSignal = 0 }: { openSignal?: number }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  // Let another section (the vendor band) open this form so every vendor CTA
  // funnels to the same qualified request — one path, not three.
  useEffect(() => { if (openSignal > 0) setOpen(true); }, [openSignal]);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "", revenue: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setF((s) => ({ ...s, [k]: e.target.value }));
    if (status === "error") setStatus("idle");
  };

  const submit = async () => {
    if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.business.trim()) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    try {
      const revLabel = REVENUE.find((r) => r.v === f.revenue)?.label.en ?? "not specified";
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: f.business.trim(),
          business_type: "demo-request",
          email: f.email.trim(),
          phone: f.phone.trim(),
          notes: `Demo request · Contact: ${f.name.trim()} · Revenue: ${revLabel} · source: utoronto`,
          lang,
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const inputCls = "w-full rounded-lg border border-[#E3E2DC] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full rounded-full bg-brand px-5 py-2.5 text-center text-sm font-bold text-white transition hover:opacity-90 sm:w-auto"
        >
          {t(T.requestCta)}
        </button>
        <a href="/demo" className="w-full rounded-full border border-[#E3E2DC] bg-white px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:border-brand/40 sm:w-auto">
          {t(T.tour)}
        </a>
      </div>

      {open && (
        <div className="mx-auto mt-5 max-w-md rounded-2xl border border-[#EBEAE5] bg-white p-5 text-left shadow-sm">
          {status === "done" ? (
            <div className="py-6 text-center">
              <div className="text-2xl">🎉</div>
              <p className="mt-2 font-semibold text-ink">{t(T.done)}</p>
            </div>
          ) : (
            <>
              <div className="text-base font-bold text-ink">{t(T.formTitle)}</div>
              <p className="mt-1 text-sm text-ink-soft">{t(T.formSub)}</p>
              <div className="mt-4 space-y-2">
                <input className={inputCls} value={f.name} onChange={set("name")} placeholder={t(T.name)} autoComplete="name" />
                <input className={inputCls} value={f.business} onChange={set("business")} placeholder={t(T.business)} autoComplete="organization" />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input className={inputCls} type="email" inputMode="email" value={f.email} onChange={set("email")} placeholder={t(T.email)} autoComplete="email" />
                  <input className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder={t(T.phone)} autoComplete="tel" />
                </div>
                <select className={`${inputCls} ${f.revenue ? "text-ink" : "text-ink-faint"}`} value={f.revenue} onChange={set("revenue")} aria-label={t(T.revenue)}>
                  <option value="" disabled>{t(T.revenue)} · {t(T.revenuePh)}</option>
                  {REVENUE.map((r) => (
                    <option key={r.v} value={r.v} className="text-ink">{t(r.label)}</option>
                  ))}
                </select>
                <button
                  onClick={submit}
                  disabled={status === "busy"}
                  className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {status === "busy" ? t(T.sending) : t(T.submit)}
                </button>
                {status === "error" && (
                  <p className="text-center text-xs font-medium text-red-600">
                    {!f.name.trim() || !f.email.trim() || !f.phone.trim() || !f.business.trim() ? t(T.errRequired) : t(T.errGeneric)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
