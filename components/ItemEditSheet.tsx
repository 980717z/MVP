"use client";

// Per-dish editor for a line on an EXISTING order, opened by tapping the dish
// name in the table sheet. Mirrors the ✎ per-unit editor the customer menu
// already uses at order time, so staff meet one interaction, not two.
//
// The pain it solves: a QR order arrives with no note, then the diner asks for
// 加料 that costs more. Before this, staff could only CANCEL the line — there
// was no way to re-price it or tell the kitchen why.
//
// Money math lives in lib/itemEdit (pure, unit-tested); this file is only UI.
import { useEffect, useRef, useState } from "react";
import { applyItemEdit, basePriceOf, type EditableItem } from "@/lib/itemEdit";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { zh: "改这道菜", en: "Edit dish", fr: "Modifier le plat" },
  qty: { zh: "数量", en: "Qty", fr: "Quantité" },
  unitPrice: { zh: "单价", en: "Unit price", fr: "Prix unitaire" },
  note: { zh: "备注", en: "Note", fr: "Note" },
  notePh: { zh: "如:加料、少辣", en: "e.g. extra toppings, less spicy", fr: "ex. supplément, moins épicé" },
  noteHint: {
    zh: "备注会跟着菜名印在后厨小票和账单上。",
    en: "The note prints under the dish on the kitchen ticket and the bill.",
    fr: "La note s'imprime sous le plat sur le ticket cuisine et l'addition.",
  },
  base: { zh: "原价 {p}", en: "was {p}", fr: "avant {p}" },
  lineTotal: { zh: "这一行", en: "Line total", fr: "Total ligne" },
  cancel: { zh: "取消", en: "Cancel", fr: "Annuler" },
  save: { zh: "保存", en: "Save", fr: "Enregistrer" },
  saving: { zh: "保存中…", en: "Saving…", fr: "Enregistrement…" },
  saveErr: { zh: "保存失败,请重试:", en: "Save failed, retry: ", fr: "Échec, réessayez : " },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

// One-tap note chips. Language-aware: an English-only vendor (a campus truck)
// must not be handed Chinese kitchen shorthand.
const CHIPS: Record<string, string[]> = {
  zh: ["加料", "少辣", "走青", "少油", "免味精"],
  en: ["Extra toppings", "Less spicy", "No green onion", "Less oil", "No MSG"],
  fr: ["Supplément", "Moins épicé", "Sans oignon vert", "Moins d'huile", "Sans MSG"],
};

export default function ItemEditSheet({
  item,
  onCancel,
  onSave,
}: {
  item: EditableItem & { name_zh: string; name_en?: string };
  onCancel: () => void;
  /** Receives the edited line; the caller persists it and recomputes the total. */
  onSave: (next: EditableItem & { name_zh: string; name_en?: string }) => Promise<void>;
}) {
  const { t, lang } = useLang();
  const [qty, setQty] = useState(item.qty);
  const [price, setPrice] = useState(item.price == null ? "" : String(item.price));
  const [note, setNote] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc closes; focus starts on Close so a keyboard user is never trapped.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const base = basePriceOf(item);
  const priceNum = price === "" ? 0 : Number(price) || 0;
  const changed = Math.abs(priceNum - base) >= 0.005;
  const lineTotal = Math.round(priceNum * qty * 100) / 100;
  const dishName = lang === "zh" ? item.name_zh : item.name_en || item.name_zh;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    const next = applyItemEdit(item, { qty, price: price === "" ? undefined : priceNum, note });
    try {
      await onSave(next as EditableItem & { name_zh: string; name_en?: string });
    } catch (e) {
      setBusy(false);
      setErr(t(T.saveErr) + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t(T.title)}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-ink">{dishName}</div>
            {changed && <div className="mt-0.5 text-xs text-ink-faint">{t(T.base).replace("{p}", `$${base.toFixed(2)}`)}</div>}
          </div>
          <button ref={closeRef} onClick={onCancel} aria-label={t(T.close)} className="grid h-9 w-9 flex-none place-items-center rounded-lg text-ink-faint hover:bg-slate-50">✕</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* qty — 44px targets for a waiter on an iPad mid-service */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">{t(T.qty)}</span>
            <div className="flex items-center gap-3">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-lg text-ink">－</button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums text-ink">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="grid h-11 w-11 place-items-center rounded-full border border-slate-300 text-lg text-ink">＋</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex-none text-sm font-medium text-ink-soft">{t(T.unitPrice)}</span>
            <div className="flex w-36 items-center rounded-lg border border-slate-300 px-3">
              <span className="text-ink-faint">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="w-full bg-transparent py-2.5 text-right text-base tabular-nums outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="item-note" className="text-sm font-medium text-ink-soft">{t(T.note)}</label>
            <input
              id="item-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(T.notePh)}
              className="input mt-1 w-full"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(CHIPS[lang] ?? CHIPS.en).map((c) => (
                <button
                  key={c}
                  onClick={() => setNote(c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${note === c ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">{t(T.noteHint)}</p>
          </div>
        </div>

        {err && <p className="px-5 pb-2 text-sm text-red-600">{err}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <div className="text-sm text-ink-soft">
            {t(T.lineTotal)} <span className="text-lg font-bold tabular-nums text-ink">${lineTotal.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-ink-soft">{t(T.cancel)}</button>
            <button onClick={save} disabled={busy} className="btn-primary min-h-11 px-5 text-sm disabled:opacity-50">{busy ? t(T.saving) : t(T.save)}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
