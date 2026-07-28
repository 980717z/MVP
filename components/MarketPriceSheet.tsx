"use client";

// 时价录入 — the sheet that replaced window.prompt for pricing market items
// (weighed live seafood) at completion/checkout.
//
// Why this exists: the old flow looped window.prompt once PER ITEM. On the
// service iPad that meant the single most money-critical nightly flow ran
// through a blocking native dialog: it froze the 8s order poll, showed one
// dish at a time with no overview, lost everything on one mistyped price, and
// on iPad Safari the prompt can't even prefill reliably. One sheet shows every
// un-priced dish at once, prefilled with today's board price, and commits in a
// single save.
import { useEffect, useRef, useState } from "react";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { zh: "时价录入", en: "Enter market prices", fr: "Prix du jour" },
  hint: {
    zh: "这些菜按当日时价收费。已预填今日牌价,可按实称重量修改。",
    en: "These dishes are charged at today's market price. Today's board price is prefilled — adjust to the weighed price.",
    fr: "Ces plats sont au prix du jour. Le prix affiché est prérempli — ajustez selon la pesée.",
  },
  perUnit: { zh: "单价", en: "Unit price", fr: "Prix unitaire" },
  qty: { zh: "×{n}", en: "×{n}", fr: "×{n}" },
  needAll: { zh: "每道菜都要填一个大于 0 的价格", en: "Every dish needs a price above 0", fr: "Chaque plat doit avoir un prix supérieur à 0" },
  cancel: { zh: "取消", en: "Cancel", fr: "Annuler" },
  save: { zh: "确认价格", en: "Confirm prices", fr: "Confirmer" },
  saving: { zh: "保存中…", en: "Saving…", fr: "Enregistrement…" },
  saveErr: { zh: "保存失败,请重试:", en: "Save failed, retry: ", fr: "Échec, réessayez : " },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

/** One un-priced market line. `key` ties the entered price back to the caller's
 *  data (e.g. `${orderId}:${itemIndex}`). */
export interface MarketLine {
  key: string;
  name_zh: string;
  name_en?: string;
  qty: number;
  /** Today's board price from 菜单设置, if the owner entered one. */
  prefill?: number | null;
}

export default function MarketPriceSheet({
  lines,
  onCancel,
  onSave,
}: {
  lines: MarketLine[];
  onCancel: () => void;
  /** Prices keyed by MarketLine.key, all > 0. Caller persists + continues its
   *  flow; a thrown error is shown inline and the sheet stays open. */
  onSave: (prices: Record<string, number>) => Promise<void>;
}) {
  const { t, lang } = useLang();
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const l of lines) v[l.key] = l.prefill != null && l.prefill > 0 ? String(l.prefill) : "";
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const parsed = lines.map((l) => ({ key: l.key, p: parseFloat(vals[l.key] ?? "") }));
  const allValid = parsed.every((x) => x.p > 0);

  const save = async () => {
    if (busy || !allValid) return;
    setBusy(true);
    setErr("");
    const out: Record<string, number> = {};
    for (const x of parsed) out[x.key] = Math.round(x.p * 100) / 100;
    try {
      await onSave(out);
    } catch (e) {
      setBusy(false);
      setErr(t(T.saveErr) + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t(T.title)}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-ink">💰 {t(T.title)}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t(T.hint)}</p>
          </div>
          <button onClick={onCancel} aria-label={t(T.close)} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-faint hover:bg-slate-50">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {lines.map((l, i) => (
            <div key={l.key} className="flex items-center justify-between gap-3 border-b border-slate-50 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {lang === "zh" ? l.name_zh : l.name_en || l.name_zh}
                  {l.qty > 1 && <span className="ml-1 text-ink-faint">{t(T.qty).replace("{n}", String(l.qty))}</span>}
                </div>
              </div>
              <div className={`flex w-32 flex-none items-center rounded-lg border px-3 ${vals[l.key] !== "" && !(parseFloat(vals[l.key]) > 0) ? "border-red-400" : "border-slate-300"}`}>
                <span className="text-ink-faint">$</span>
                <input
                  ref={i === 0 ? firstRef : undefined}
                  value={vals[l.key] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [l.key]: e.target.value.replace(/[^0-9.]/g, "") }))}
                  inputMode="decimal"
                  aria-label={`${l.name_zh} ${t(T.perUnit)}`}
                  className="w-full bg-transparent py-2.5 text-right text-base tabular-nums outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {(err || !allValid) && (
          <p className={`px-5 pb-1 text-xs ${err ? "text-red-600" : "text-ink-faint"}`}>{err || t(T.needAll)}</p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-ink-soft">{t(T.cancel)}</button>
          <button onClick={save} disabled={busy || !allValid} className="btn-primary min-h-11 px-5 text-sm disabled:opacity-50">
            {busy ? t(T.saving) : t(T.save)}
          </button>
        </div>
      </div>
    </div>
  );
}
