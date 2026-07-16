"use client";

// ─────────────────────────────────────────────────────────────────────────
//  Staff-side manual order composer — 新建外卖/外送单.
//  Lets staff enter a takeout (自取) or delivery (外送) order by hand for
//  phone/walk-in customers. It builds the SAME item shape the customer QR
//  flow produces and calls the same createOrder(), so the new order behaves
//  identically downstream: lands unpaid in the 自取/外送 tab, auto-prints a
//  kitchen ticket, and 时价 items get priced at 完成 like any other order.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { createOrder, type OrderItem } from "@/lib/orders";
import { listMenuItems, unitPrice, displayPrice, type MenuItem } from "@/lib/menu";
import { price as fmtPrice } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  title: { en: "New order", zh: "新建订单", fr: "Nouvelle commande" },
  typeTogo: { en: "Pickup", zh: "自取", fr: "À emporter" },
  typeDelivery: { en: "Delivery", zh: "外送", fr: "Livraison" },
  phone: { en: "Phone (optional)", zh: "电话(选填)", fr: "Téléphone (facultatif)" },
  street: { en: "Street address", zh: "街道地址", fr: "Adresse" },
  unit: { en: "Unit (optional)", zh: "单元(选填)", fr: "Unité (facultatif)" },
  postal: { en: "Postal code", zh: "邮编", fr: "Code postal" },
  note: { en: "Note (optional)", zh: "备注(选填)", fr: "Note (facultatif)" },
  search: { en: "Search dishes", zh: "搜索菜品", fr: "Rechercher un plat" },
  market: { en: "Market", zh: "时价", fr: "Prix du jour" },
  add: { en: "Add", zh: "加", fr: "Ajouter" },
  total: { en: "Total", zh: "合计", fr: "Total" },
  itemsN: { en: "{n} items", zh: "{n} 份", fr: "{n} articles" },
  create: { en: "Create order", zh: "创建订单", fr: "Créer la commande" },
  creating: { en: "Creating…", zh: "创建中…", fr: "Création…" },
  needItems: { en: "Add at least one dish.", zh: "请至少选择一个菜品。", fr: "Ajoutez au moins un plat." },
  needAddress: { en: "Enter the delivery address.", zh: "请填写外送地址。", fr: "Saisissez l'adresse de livraison." },
  createFailed: { en: "Couldn't create the order: ", zh: "创建失败:", fr: "Échec de la création : " },
  close: { en: "Close", zh: "关闭", fr: "Fermer" },
  emptyMenu: { en: "No menu items yet.", zh: "菜单还没有菜品。", fr: "Aucun plat au menu." },
  noResults: { en: "No dishes found.", zh: "没有找到相关菜品。", fr: "Aucun plat trouvé." },
  marketHint: {
    en: "Market-priced (时价) items are priced when you mark the order done.",
    zh: "时价菜品会在标记订单完成时录入价格。",
    fr: "Les plats au prix du jour sont tarifés à la clôture de la commande.",
  },
  uncat: { en: "Other", zh: "未分类", fr: "Autres" },
};

// A single orderable line in the picker. Variant dishes flatten to one row per
// size (id#vi) so every pickable price gets its own stepper — mirrors cartKey.
type Row = { key: string; d: MenuItem; vi: number | null; labelZh: string; labelEn: string; price: number | null; market: boolean };

function variantLabel(dishZh: string, dishEn: string, vLabelZh: string, vLabelEn: string, en: boolean): string {
  const base = en ? dishEn || dishZh : dishZh;
  const lbl = en ? vLabelEn || vLabelZh : vLabelZh;
  return en ? `${base} (${lbl})` : `${base}(${lbl})`;
}

export default function NewOrderModal({
  slug,
  onClose,
  onCreated,
}: {
  slug: string;
  onClose: () => void;
  onCreated: (type: "togo" | "delivery") => void;
}) {
  const { t, lang } = useLang();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"togo" | "delivery">("togo");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [postal, setPostal] = useState("");
  const [note, setNote] = useState("");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listMenuItems(slug)
      .then((m) => setMenu(m.filter((d) => !d.sold_out)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  // Flatten dishes → orderable rows (one per variant, else one per dish).
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const d of menu) {
      if (d.variants?.length) {
        d.variants.forEach((v, vi) => {
          out.push({
            key: `${d.id}#${vi}`,
            d,
            vi,
            labelZh: variantLabel(d.name_zh, d.name_en, v.label_zh, v.label_en || "", false),
            labelEn: variantLabel(d.name_zh, d.name_en, v.label_zh, v.label_en || "", true),
            price: d.is_market ? null : Number(v.price) || 0,
            market: d.is_market,
          });
        });
      } else {
        out.push({
          key: d.id,
          d,
          vi: null,
          labelZh: d.name_zh,
          labelEn: d.name_en || d.name_zh,
          price: d.is_market ? null : displayPrice(d),
          market: d.is_market,
        });
      }
    }
    return out;
  }, [menu]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.labelZh.toLowerCase().includes(s) || r.labelEn.toLowerCase().includes(s));
  }, [rows, q]);

  // Group filtered rows by category, preserving menu order of first appearance.
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of filtered) {
      const c = r.d.category || "";
      const arr = map.get(c);
      if (arr) arr.push(r);
      else map.set(c, [r]);
    }
    return [...map.entries()];
  }, [filtered]);

  const rowByKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const count = Object.values(cart).reduce((s, n) => s + n, 0);
  const total = useMemo(() => {
    let sum = 0;
    for (const [key, qty] of Object.entries(cart)) {
      const r = rowByKey.get(key);
      if (r && !r.market) sum += (Number(r.price) || 0) * qty;
    }
    return Math.round(sum * 100) / 100;
  }, [cart, rowByKey]);
  const hasMarket = Object.keys(cart).some((k) => rowByKey.get(k)?.market);

  const setQty = (key: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[key];
      else next[key] = qty;
      return next;
    });

  const submit = async () => {
    setErr("");
    const items: OrderItem[] = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([key, qty]) => {
        const r = rowByKey.get(key)!;
        return {
          id: r.d.id,
          name_zh: r.labelZh,
          name_en: r.labelEn,
          price: r.market ? null : unitPrice(r.d, r.vi),
          qty,
          ...(r.market ? { market: true } : {}),
        };
      });
    if (items.length === 0) {
      setErr(t(T.needItems));
      return;
    }
    if (type === "delivery" && (!street.trim() || !postal.trim())) {
      setErr(t(T.needAddress));
      return;
    }
    setSubmitting(true);
    const res = await createOrder(slug, {
      items,
      total,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      order_type: type,
      address:
        type === "delivery"
          ? { street: street.trim(), unit: unit.trim() || undefined, city: "Toronto, ON", postal: postal.trim().toUpperCase() }
          : undefined,
    });
    setSubmitting(false);
    if (res.error) {
      setErr(t(T.createFailed) + res.error);
      return;
    }
    onCreated(type);
  };

  const cat = (c: string) => c || t(T.uncat);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-ink">{t(T.title)}</h2>
          <button onClick={onClose} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-lg text-xl leading-none text-ink-faint hover:bg-slate-50">
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* type toggle */}
          <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
            {(["togo", "delivery"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`min-h-10 rounded-lg px-5 text-sm font-medium transition ${type === k ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}
              >
                {k === "togo" ? `📦 ${t(T.typeTogo)}` : `🚴 ${t(T.typeDelivery)}`}
              </button>
            ))}
          </div>

          {/* customer fields */}
          <div className="mb-4 grid gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder={t(T.phone)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            {type === "delivery" && (
              <>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder={t(T.street)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={t(T.unit)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  />
                  <input
                    value={postal}
                    onChange={(e) => setPostal(e.target.value)}
                    placeholder={t(T.postal)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
                  />
                </div>
              </>
            )}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t(T.note)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </div>

          {/* item picker */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`🔍 ${t(T.search)}`}
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />

          {loading ? (
            <div className="py-10 text-center text-sm text-ink-faint">…</div>
          ) : menu.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-faint">{t(T.emptyMenu)}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-faint">{t(T.noResults)}</div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([category, list]) => (
                <div key={category || "_uncat"} className="space-y-1">
                  <div className="sticky top-0 z-10 -mx-1 bg-white/90 px-1 py-1 text-xs font-bold text-ink-faint backdrop-blur">{cat(category)}</div>
                  {list.map((r) => {
                    const qty = cart[r.key] || 0;
                    return (
                      <div key={r.key} className="flex items-center justify-between gap-2 py-1">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-ink">{lang === "en" ? r.labelEn : r.labelZh}</div>
                          <div className="text-xs text-ink-soft">
                            {r.market ? (
                              <span className="font-semibold text-amber-600">{t(T.market)}</span>
                            ) : (
                              fmtPrice(Number(r.price) || 0)
                            )}
                          </div>
                        </div>
                        {qty === 0 ? (
                          <button
                            onClick={() => setQty(r.key, 1)}
                            className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-wash"
                          >
                            + {t(T.add)}
                          </button>
                        ) : (
                          // 44px tap floor — staff hit these one-handed mid-call (design review 6-2A)
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setQty(r.key, qty - 1)} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-300 text-xl leading-none text-ink-soft hover:bg-slate-50">
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold tabular-nums text-ink">{qty}</span>
                            <button onClick={() => setQty(r.key, qty + 1)} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-300 text-xl leading-none text-ink-soft hover:bg-slate-50">
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-t border-slate-200 px-5 py-4">
          {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          {hasMarket && <div className="mb-2 text-xs text-ink-faint">{t(T.marketHint)}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-ink-soft">
              <span className="font-semibold text-ink">{t(T.total)} {fmtPrice(total)}</span>
              {count > 0 && <span className="ml-2 text-ink-faint">· {t(T.itemsN).replace("{n}", String(count))}</span>}
            </div>
            <button
              onClick={submit}
              disabled={submitting || count === 0}
              className="btn-primary px-5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t(T.creating) : t(T.create)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
