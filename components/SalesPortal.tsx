"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listRecords, addRecord, deleteRecord, type RecordRow } from "@/lib/store";
import { computeTax } from "@/lib/tax";
import { addDays, shopHm, shopToday } from "@/lib/shopTime";
import { money } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

type Source = "cash" | "clover" | "qr" | "phone";
type Range = "today" | "7" | "all";

const SOURCES: { k: Source; label: Dict; emoji: string; cls: string }[] = [
  { k: "cash", label: { zh: "现金", en: "Cash", fr: "Comptant" }, emoji: "💵", cls: "bg-amber-50 text-amber-700" },
  { k: "clover", label: { zh: "Clover", en: "Clover", fr: "Clover" }, emoji: "💳", cls: "bg-violet-50 text-violet-700" },
  { k: "qr", label: { zh: "扫码", en: "QR", fr: "QR" }, emoji: "📱", cls: "bg-brand-wash text-brand-ink" },
  { k: "phone", label: { zh: "电话", en: "Phone", fr: "Tél." }, emoji: "📞", cls: "bg-sky-50 text-sky-700" },
];
const SRC = Object.fromEntries(SOURCES.map((s) => [s.k, s]));

const num = (v: any) => parseFloat(v) || 0;

export default function SalesPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const { t, lang } = useLang();
  const bi = (b: { zh: string; en: string }) => (lang === "zh" ? b.zh : b.en);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [range, setRange] = useState<Range>("today");

  // record-a-sale form
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<Source>("cash");
  const [desc, setDesc] = useState("");
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    listRecords(slug, "sales").then(setRows);
  }, [slug]);
  useEffect(() => {
    load();
  }, [load]);

  const today = shopToday();
  const cutoff = useMemo(() => addDays(shopToday(), -6), []);

  const filtered = useMemo(() => {
    if (range === "all") return rows;
    return rows.filter((r) => {
      const d = (r.date as string) || (r.createdAt || "").slice(0, 10);
      return range === "today" ? d === today : d >= cutoff;
    });
  }, [rows, range, today, cutoff]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (a, r) => ({
          subtotal: a.subtotal + num(r.subtotal),
          gst: a.gst + num(r.gst),
          pst: a.pst + num(r.pst),
          total: a.total + num(r.total),
        }),
        { subtotal: 0, gst: 0, pst: 0, total: 0 },
      ),
    [filtered],
  );

  const preview = computeTax(num(amount), taxIncluded);

  const save = async () => {
    if (num(amount) <= 0) return;
    setSaving(true);
    const ts = shopHm();
    const { error } = await addRecord(slug, "sales", {
      date: today,
      ts,
      source,
      desc: desc.trim(),
      subtotal: String(preview.subtotal),
      gst: String(preview.gst),
      pst: String(preview.pst),
      total: String(preview.total),
    });
    setSaving(false);
    if (error) {
      alert(t({ zh: "保存失败，请重试：", en: "Save failed, please retry: ", fr: "Échec de l'enregistrement, veuillez réessayer : " }) + error);
      return;
    }
    setAmount("");
    setDesc("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm(t({ zh: "删除这笔销售？", en: "Delete this sale?", fr: "Supprimer cette vente ?" }))) return;
    await deleteRecord(id);
    load();
  };

  const RANGES: { k: Range; label: Dict }[] = [
    { k: "today", label: { zh: "今日", en: "Today", fr: "Aujourd'hui" } },
    { k: "7", label: { zh: "近7天", en: "7 days", fr: "7 jours" } },
    { k: "all", label: { zh: "全部", en: "All", fr: "Tout" } },
  ];

  return (
    <main className="px-5 py-6 lg:px-7">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← {t({ zh: "总览", en: "Overview", fr: "Aperçu" })}</Link>
      <header className="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">{mod.icon} {bi(mod.label)}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{bi(mod.pain)}</p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {RANGES.map((r) => (
            <button
              key={r.k}
              onClick={() => setRange(r.k)}
              className={`rounded-md px-2.5 py-1 ${range === r.k ? "bg-white font-semibold text-ink shadow-sm" : "text-ink-faint"}`}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      </header>

      {/* KPIs incl. tax remittance */}
      <section className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#EBEAE5] bg-[#EBEAE5] lg:grid-cols-4">
        <Kpi k={t({ zh: "销售额（税前）", en: "Sales (pre-tax)", fr: "Ventes (avant taxe)" })} v={money(totals.subtotal)} s={`${filtered.length} ${t({ zh: "笔", en: "txns", fr: "trans." })}`} big />
        <Kpi k={t({ zh: "联邦税 GST 5%", en: "Federal GST 5%", fr: "TPS 5%" })} v={money(totals.gst)} s={t({ zh: "应申报", en: "to remit", fr: "à remettre" })} tax />
        <Kpi k={t({ zh: "省税 PST 8%", en: "Provincial PST 8%", fr: "TVP 8%" })} v={money(totals.pst)} s={t({ zh: "应申报", en: "to remit", fr: "à remettre" })} tax />
        <Kpi k={t({ zh: "税后合计", en: "After-tax total", fr: "Total avec taxe" })} v={money(totals.total)} s="HST 13%" big />
      </section>

      <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
        {/* record a sale */}
        <section className="self-start rounded-xl border border-[#EBEAE5] bg-white">
          <h2 className="border-b border-[#F3F2EE] px-4 py-3 text-[13px] font-bold text-ink">＋ {t({ zh: "记一笔", en: "Record a sale", fr: "Saisir une vente" })}</h2>
          <div className="p-4">
            <label className="mb-1.5 block text-[11px] font-semibold text-ink-soft">{t({ zh: "金额", en: "Amount", fr: "Montant" })}</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="w-full rounded-lg border border-[#EBEAE5] px-3 py-2.5 text-xl font-extrabold tabular-nums outline-none focus:border-brand"
            />

            <label className="mb-1.5 mt-3 block text-[11px] font-semibold text-ink-soft">{t({ zh: "来源", en: "Source", fr: "Source" })}</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button
                  key={s.k}
                  onClick={() => setSource(s.k)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    source === s.k ? "border-brand bg-brand-wash text-brand-ink" : "border-[#EBEAE5] text-ink-soft hover:bg-[#F3F2EE]"
                  }`}
                >
                  {s.emoji} {t(s.label)}
                </button>
              ))}
            </div>

            <label className="mb-1.5 mt-3 block text-[11px] font-semibold text-ink-soft">{t({ zh: "说明（可选）", en: "Note (optional)", fr: "Note (option.)" })}</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={t({ zh: "例：堂食 6 位", en: "e.g. dine-in, table 6", fr: "ex. table 6" })}
              className="w-full rounded-lg border border-[#EBEAE5] px-3 py-2 text-sm outline-none focus:border-brand"
            />

            <button
              onClick={() => setTaxIncluded((v) => !v)}
              className="mt-3 flex w-full items-center gap-2 text-left text-[11.5px] text-ink-soft"
            >
              <span className={`relative h-5 w-9 flex-none rounded-full transition ${taxIncluded ? "bg-brand" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${taxIncluded ? "left-[18px]" : "left-0.5"}`} />
              </span>
              {taxIncluded ? t({ zh: "金额已含税，自动反推", en: "Amount includes tax (extract it)", fr: "Montant taxes incluses" }) : t({ zh: "价格不含税，结账加税", en: "Add tax on top", fr: "Ajouter la taxe" })}
            </button>

            <div className="mt-3 rounded-lg bg-brand-wash px-3 py-3 text-[12.5px] tabular-nums text-ink-soft">
              <Row l={t({ zh: "小计", en: "Subtotal", fr: "Sous-total" })} v={money(preview.subtotal)} />
              <Row l="GST 5%" v={money(preview.gst)} />
              <Row l="PST 8%" v={money(preview.pst)} />
              <div className="mt-1.5 flex justify-between border-t border-dashed border-[#C7DFD4] pt-1.5 text-[15px] font-extrabold text-ink">
                <span>{t({ zh: "合计", en: "Total", fr: "Total" })} (HST 13%)</span>
                <span>{money(preview.total)}</span>
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || num(amount) <= 0}
              className="mt-3 w-full rounded-full bg-brand py-2.5 text-sm font-bold text-white transition hover:bg-brand-soft disabled:opacity-40"
            >
              {saving ? "…" : `${t({ zh: "保存销售", en: "Save sale", fr: "Enregistrer" })} →`}
            </button>
          </div>
        </section>

        {/* ledger */}
        <section className="overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
          <h2 className="border-b border-[#F3F2EE] px-4 py-3 text-[13px] font-bold text-ink">{t({ zh: "销售流水", en: "Sales ledger", fr: "Registre des ventes" })}</h2>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-2xl">🧾</div>
              <div className="mt-2 text-sm font-semibold text-ink">{t({ zh: "暂无销售记录", en: "No sales yet", fr: "Aucune vente" })}</div>
              <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
                {t({ zh: "在左边记一笔，或完成一个扫码订单，就会自动出现在这里。", en: "Record one on the left, or complete a QR order — it lands here automatically.", fr: "Saisissez-en une, ou complétez une commande QR." })}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-[#EBEAE5] text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2.5 font-bold">{t({ zh: "日期", en: "Date", fr: "Date" })}</th>
                    <th className="px-3 py-2.5 font-bold">{t({ zh: "时间", en: "Time", fr: "Heure" })}</th>
                    <th className="px-3 py-2.5 font-bold">{t({ zh: "来源", en: "Source", fr: "Source" })}</th>
                    <th className="px-3 py-2.5 font-bold">{t({ zh: "说明", en: "Note", fr: "Note" })}</th>
                    <th className="px-3 py-2.5 text-right font-bold">{t({ zh: "税前", en: "Pre-tax", fr: "Av. taxe" })}</th>
                    <th className="px-3 py-2.5 text-right font-bold">GST</th>
                    <th className="px-3 py-2.5 text-right font-bold">PST</th>
                    <th className="px-3 py-2.5 text-right font-bold">{t({ zh: "合计", en: "Total", fr: "Total" })}</th>
                    <th className="px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const s = SRC[(r.source as Source) || "cash"] ?? SRC.cash;
                    return (
                      <tr key={r.id} className="border-b border-[#F3F2EE] last:border-0 hover:bg-[#FBFAF8]">
                        <td className="px-3 py-2.5 text-ink-faint">{(r.date as string) || (r.createdAt || "").slice(0, 10)}</td>
                        <td className="px-3 py-2.5 text-ink-faint">{(r.ts as string) || (r.createdAt || "").slice(11, 16)}</td>
                        <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.emoji} {t(s.label)}</span></td>
                        <td className="px-3 py-2.5 text-ink">{(r.desc as string) || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{money(num(r.subtotal))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-faint">{money(num(r.gst))}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-faint">{money(num(r.pst))}</td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-ink">{money(num(r.total))}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => remove(r.id)} className="text-xs text-ink-faint hover:text-red-600">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#EBEAE5] font-extrabold text-ink">
                    <td className="px-3 py-2.5" colSpan={4}>{t({ zh: "合计", en: "Total", fr: "Total" })} · {filtered.length}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.subtotal)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.gst)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.pst)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Kpi({ k, v, s, big, tax }: { k: string; v: string; s?: string; big?: boolean; tax?: boolean }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <div className="text-[11px] font-semibold text-ink-faint">{k}</div>
      <div className={`mt-1 font-extrabold tabular-nums tracking-tight ${big ? "text-[24px]" : "text-[20px]"} ${tax ? "text-amber-700" : "text-ink"}`}>{v}</div>
      {s && <div className="mt-0.5 text-[11px] text-ink-faint">{s}</div>}
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
