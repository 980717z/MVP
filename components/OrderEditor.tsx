"use client";

// Back-office ONLY editor for an existing order (opened from the ⋯ menu on an
// order card). Staff can change qty, change unit price, add dishes from the
// menu, and remove dishes. Persisting goes through updateOrderItems, which is
// gated by the orders_member_update RLS policy — anon (customers) can't update,
// so price changes are structurally staff-only. On save we ask whether to
// reprint the kitchen ticket (an added dish the kitchen hasn't seen).
import { useEffect, useMemo, useState } from "react";
import { updateOrderItems, reprintOrder, type Order, type OrderItem } from "@/lib/orders";
import { postOrderSales, adjustOrderSale } from "@/lib/store";
import { listMenuItems, displayPrice, catLabel, type MenuItem } from "@/lib/menu";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { en: "Edit order", zh: "编辑订单", fr: "Modifier la commande" },
  empty: { en: "No dishes left — add one or cancel the order.", zh: "没有菜了 — 加一道或取消整单。", fr: "Aucun plat — ajoutez-en un ou annulez." },
  addDish: { en: "＋ Add dish", zh: "＋ 加菜", fr: "＋ Ajouter" },
  searchDish: { en: "Search dishes", zh: "搜索菜品", fr: "Rechercher" },
  total: { en: "Total", zh: "合计", fr: "Total" },
  cancel: { en: "Cancel", zh: "取消", fr: "Annuler" },
  save: { en: "Save", zh: "保存", fr: "Enregistrer" },
  saving: { en: "Saving…", zh: "保存中…", fr: "Enregistrement…" },
  saved: { en: "Saved. Reprint the kitchen ticket?", zh: "已保存。要重打后厨小票吗?", fr: "Enregistré. Réimprimer le ticket ?" },
  reprint: { en: "🖨 Reprint ticket", zh: "🖨 重打小票", fr: "🖨 Réimprimer" },
  noReprint: { en: "No, done", zh: "不用了", fr: "Non, terminé" },
  saveErr: { en: "Save failed, retry: ", zh: "保存失败,请重试:", fr: "Échec, réessayez : " },
  done: { en: "Done", zh: "完成", fr: "Terminé" },
  allCats: { en: "All", zh: "全部", fr: "Tous" },
  noHits: { en: "No dishes found.", zh: "没有找到菜品。", fr: "Aucun plat trouvé." },
};

type Row = OrderItem & { cancelled?: boolean };

export default function OrderEditor({
  slug,
  order,
  onClose,
  onSaved,
}: {
  slug: string;
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, lang } = useLang();
  // Working copy of the FULL items array (cancelled ones preserved for the
  // record); the editor only surfaces active rows.
  const [rows, setRows] = useState<Row[]>(() => (order.items ?? []).map((it) => ({ ...it })));
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(""); // "" = all categories; else browse one category
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"edit" | "reprint">("edit");
  const [err, setErr] = useState("");

  useEffect(() => { listMenuItems(slug).then(setMenu).catch(() => {}); }, [slug]);

  const total = useMemo(
    () => Math.round(rows.filter((r) => !r.cancelled).reduce((s, r) => s + (Number(r.price) || 0) * r.qty, 0) * 100) / 100,
    [rows],
  );
  const activeCount = rows.filter((r) => !r.cancelled).length;

  const dishName = (r: { name_zh: string; name_en?: string }) => (lang === "zh" ? r.name_zh : r.name_en || r.name_zh);

  const setQty = (i: number, d: number) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, qty: Math.max(1, r.qty + d) } : r)));
  const setPrice = (i: number, v: string) => {
    const clean = v.replace(/[^0-9.]/g, "");
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, price: clean === "" ? 0 : Number(clean) || 0 } : r)));
  };
  const removeRow = (i: number) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, cancelled: true } : r)));

  // Tap-to-add: bump the qty of the matching single-price line if it's already on
  // the order (keeps the bill tidy), else append it. Panel stays open so staff can
  // keep browsing the menu and add several dishes in a row.
  const addDish = (d: MenuItem) => {
    const price = displayPrice(d) ?? 0;
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === d.id && r.vi == null && !r.cancelled);
      if (i >= 0) return rs.map((r, k) => (k === i ? { ...r, qty: r.qty + 1 } : r));
      return [...rs, { id: d.id, name_zh: d.name_zh, name_en: d.name_en, price, qty: 1 }];
    });
  };

  const catOf = (d: MenuItem) => d.category || "其他";
  const clabel = (c: string) => catLabel(c, lang === "zh" ? "zh" : "en");
  const searching = q.trim().length > 0;

  // Category rail: every category present in the menu, in menu order.
  const cats = useMemo(() => {
    const seen: string[] = [];
    for (const d of menu) { if (d.sold_out) continue; const c = catOf(d); if (!seen.includes(c)) seen.push(c); }
    return seen;
  }, [menu]);

  // Search matches across all categories; otherwise browse (all, or one category).
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = menu.filter((d) => !d.sold_out);
    if (s) return list.filter((d) => d.name_zh.toLowerCase().includes(s) || (d.name_en || "").toLowerCase().includes(s) || (d.search_initials || "").includes(s));
    return cat ? list.filter((d) => catOf(d) === cat) : list;
  }, [menu, q, cat]);

  // Grouped-by-category headers only when browsing ALL with no search; a single
  // category or a search shows a flat list.
  const grouped = useMemo(() => {
    if (searching || cat) return null;
    const m = new Map<string, MenuItem[]>();
    for (const d of results) { const c = catOf(d); const a = m.get(c); if (a) a.push(d); else m.set(c, [d]); }
    return [...m.entries()];
  }, [results, searching, cat]);

  const doSave = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    const active = rows.filter((r) => !r.cancelled);
    const { error } = await updateOrderItems(order.id, rows, total);
    if (error) { setBusy(false); setErr(t(T.saveErr) + error); return; }
    // 加菜到「已完成」的单:该单完成时已把原有菜计入 菜品销量 + 营业额,所以这里只把
    // 「新增的」菜(新菜或加量)补计入 菜品销量,并把这张单的营业额改写为新的合计。
    // 未完成的单不走这里 —— 它们会在完成时正常一次性计入,不能提前 double count。
    if (order.status === "done") {
      const keyOf = (it: { id: string; vi?: number; note?: string }) => `${it.id}#${it.vi ?? ""}#${it.note ?? ""}`;
      const before = new Map<string, number>();
      for (const it of order.items ?? []) {
        if ((it as Row).cancelled) continue;
        before.set(keyOf(it), (before.get(keyOf(it)) ?? 0) + it.qty);
      }
      const nowQty = new Map<string, number>();
      const sample = new Map<string, Row>();
      for (const r of active) { nowQty.set(keyOf(r), (nowQty.get(keyOf(r)) ?? 0) + r.qty); sample.set(keyOf(r), r); }
      const delta: { name_zh: string; qty: number; price: number | null }[] = [];
      for (const [k, qty] of nowQty) {
        const add = qty - (before.get(k) ?? 0);
        if (add > 0) { const r = sample.get(k)!; delta.push({ name_zh: r.name_zh, qty: add, price: r.price }); }
      }
      try {
        if (delta.length) await postOrderSales(slug, delta);
        await adjustOrderSale(slug, { id: order.id, total, items: active, source: "qr" });
      } catch { /* non-blocking: the order items already saved above */ }
    }
    setBusy(false);
    setPhase("reprint");
  };

  const finish = async (reprint: boolean) => {
    if (reprint) { try { await reprintOrder(order.id); } catch { /* non-blocking */ } }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-hidden rounded-t-2xl bg-white md:max-w-lg md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-bold text-ink">
            {t(T.title)} {order.order_no && <span className="ml-1 text-ink-faint">#{order.order_no}</span>}
          </h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-faint hover:bg-slate-100">✕</button>
        </div>

        {phase === "edit" ? (
          <>
            <div className="max-h-[64vh] overflow-y-auto px-5 py-3">
              {activeCount === 0 && <p className="py-6 text-center text-sm text-ink-faint">{t(T.empty)}</p>}
              {rows.map((r, i) =>
                r.cancelled ? null : (
                  <div key={i} className="flex items-center gap-3 border-b border-slate-50 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{dishName(r)}</div>
                      {r.note && <div className="truncate text-xs text-ink-faint">→ {r.note}</div>}
                    </div>
                    <div className="flex flex-none items-center gap-1.5">
                      <button onClick={() => setQty(i, -1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-ink">－</button>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums">{r.qty}</span>
                      <button onClick={() => setQty(i, 1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-ink">＋</button>
                    </div>
                    <div className="flex flex-none items-center gap-0.5">
                      <span className="text-ink-faint">$</span>
                      <input
                        value={r.price == null ? "" : String(r.price)}
                        onChange={(e) => setPrice(i, e.target.value)}
                        inputMode="decimal"
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm tabular-nums"
                      />
                    </div>
                    <button onClick={() => removeRow(i)} title={t(T.cancel)} className="grid h-8 w-8 flex-none place-items-center rounded-full text-ink-faint hover:bg-red-50 hover:text-red-600">✕</button>
                  </div>
                ),
              )}

              {adding ? (
                <div className="mt-2 rounded-xl border border-slate-200 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      autoFocus
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t(T.searchDish)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button onClick={() => { setAdding(false); setQ(""); setCat(""); }} className="flex-none rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-slate-100">
                      {t(T.done)}
                    </button>
                  </div>
                  {/* Category rail — tap to browse one section; hidden while searching. */}
                  {!searching && cats.length > 1 && (
                    <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                      <button onClick={() => setCat("")} className={`flex-none rounded-full border px-3 py-1 text-xs font-medium ${cat === "" ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`}>
                        {t(T.allCats)}
                      </button>
                      {cats.map((c) => (
                        <button key={c} onClick={() => setCat(c)} className={`flex-none whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${cat === c ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`}>
                          {clabel(c)}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="max-h-[42vh] overflow-y-auto">
                    {results.length === 0 ? (
                      <p className="py-6 text-center text-sm text-ink-faint">{t(T.noHits)}</p>
                    ) : grouped ? (
                      grouped.map(([c, items]) => (
                        <div key={c} className="mb-1">
                          <div className="sticky top-0 bg-white px-2 py-1 text-xs font-semibold text-ink-faint">{clabel(c)}</div>
                          {items.map((d) => (
                            <button key={d.id} onClick={() => addDish(d)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-slate-50">
                              <span className="truncate text-ink">{dishName(d)}</span>
                              <span className="flex-none tabular-nums text-ink-soft">${(displayPrice(d) ?? 0).toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      ))
                    ) : (
                      results.map((d) => (
                        <button key={d.id} onClick={() => addDish(d)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-slate-50">
                          <span className="truncate text-ink">{dishName(d)}</span>
                          <span className="flex-none tabular-nums text-ink-soft">${(displayPrice(d) ?? 0).toFixed(2)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-brand hover:bg-slate-50">
                  {t(T.addDish)}
                </button>
              )}
            </div>

            {err && <p className="px-5 text-sm text-red-600">{err}</p>}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <div className="text-sm text-ink-soft">
                {t(T.total)} <span className="text-lg font-bold tabular-nums text-ink">${total.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink-soft">{t(T.cancel)}</button>
                <button onClick={doSave} disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {busy ? t(T.saving) : t(T.save)}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 py-6 text-center">
            <p className="mb-4 text-sm text-ink">{t(T.saved)}</p>
            <div className="flex justify-center gap-2">
              <button onClick={() => finish(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink-soft">{t(T.noReprint)}</button>
              <button onClick={() => finish(true)} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white">{t(T.reprint)}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
