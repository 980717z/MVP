"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { listMenuItems, orderedCategories, type MenuItem } from "@/lib/menu";
import { createOrder, type OrderItem } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";

const ORDER = [
  "招牌精选", "滋补菜式", "火锅", "火锅配菜", "海鲜", "汤羹", "头盘", "蔬菜豆腐",
  "猪肉牛肉", "鸡鸭", "铁板煲仔", "芙蓉蛋", "炒粉面", "煲仔饭", "饭类", "炒饭",
  "汤粉面", "粥类", "酒水饮品",
];

type Lang = "zh" | "en";

const T = {
  zh: { menu: "扫码菜单", search: "搜索菜品", noResults: "没有找到相关菜品", add: "加入", cart: "查看订单", submit: "提交订单", table: "桌号（可选）", phone: "电话号码（必填）", phoneErr: "请填写 10 位电话号码", note: "备注（可选）", empty: "还没选菜", items: "份", total: "合计", subtotal: "小计", prevOrdered: "已点", thisRound: "本次新增", grand: "累计合计", placed: "已下单，厨房马上处理 🎉", another: "再点一单", market: "时价", submitting: "提交中…" },
  en: { menu: "Digital Menu", search: "Search dishes", noResults: "No dishes found", add: "Add", cart: "View order", submit: "Place order", table: "Table # (optional)", phone: "Phone (required)", phoneErr: "Please enter a 10-digit phone number", note: "Note (optional)", empty: "No items yet", items: "items", total: "Total", subtotal: "Subtotal", prevOrdered: "Already ordered", thisRound: "This round", grand: "Running total", placed: "Order placed — kitchen is on it 🎉", another: "Order again", market: "Market", submitting: "Submitting…" },
};

export default function PublicMenu() {
  const slug = useParams().tenant as string;
  const [lang, setLang] = useState<Lang>("zh");
  const [name, setName] = useState<{ zh: string; en: string } | null>(null);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [catOrder, setCatOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [tableNo, setTableNo] = useState("");
  const [lockedTable, setLockedTable] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");
  const [query, setQuery] = useState("");

  const t = (k: keyof typeof T["zh"]) => T[lang][k];

  useEffect(() => {
    // per-table QR: /menu/<slug>?t=5 → lock to table 5
    const tParam = new URLSearchParams(window.location.search).get("t");
    if (tParam) {
      setLockedTable(tParam);
      setTableNo(tParam);
    }
    Promise.all([
      supabase.from("storefront").select("name, cat_order").eq("slug", slug).maybeSingle(),
      listMenuItems(slug),
    ]).then(([shop, items]) => {
      const n = shop.data?.name;
      setName(typeof n === "string" ? { zh: n, en: n } : n ?? { zh: slug, en: slug });
      const co = (shop.data as any)?.cat_order;
      setCatOrder(Array.isArray(co) ? co : []);
      setDishes(items);
      setLoaded(true);
    });
  }, [slug]);

  const byId = useMemo(() => Object.fromEntries(dishes.map((d) => [d.id, d])), [dishes]);
  const inc = (id: string, delta: number) =>
    setCart((c) => {
      const q = Math.max(0, (c[id] ?? 0) + delta);
      const next = { ...c };
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const cartLines = Object.entries(cart).map(([id, qty]) => ({ d: byId[id], qty })).filter((x) => x.d);
  const count = cartLines.reduce((a, x) => a + x.qty, 0);
  const total = cartLines.reduce((a, x) => a + (Number(x.d.price) || 0) * x.qty, 0);

  // Orders already placed this session (each "再点一单" round). Lets a returning
  // diner see what they've ordered plus the running total across rounds.
  type PlacedLine = { name_zh: string; name_en: string; price: number | null; qty: number };
  const [placedOrders, setPlacedOrders] = useState<{ lines: PlacedLine[]; total: number }[]>([]);
  const placedTotal = placedOrders.reduce((a, o) => a + o.total, 0);
  const grandTotal = placedTotal + total;
  const placedLines = useMemo(() => {
    const m = new Map<string, PlacedLine>();
    for (const o of placedOrders)
      for (const l of o.lines) {
        const e = m.get(l.name_zh);
        if (e) e.qty += l.qty;
        else m.set(l.name_zh, { ...l });
      }
    return [...m.values()];
  }, [placedOrders]);

  // upsell: when a 火锅 dish is in the cart, suggest 火锅配菜 add-ons
  const hasHotpot = cartLines.some((x) => x.d.category === "火锅");
  const hotpotSides = useMemo(() => dishes.filter((d) => d.category === "火锅配菜"), [dishes]);

  const submit = async () => {
    // Required phone: strip formatting, drop a NA country-code "1", require 10 digits.
    const digits = phone.replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");
    if (digits.length !== 10) {
      setPhoneErr(true);
      return;
    }
    setPhoneErr(false);
    setSubmitting(true);
    const items: OrderItem[] = cartLines.map((x) => ({
      id: x.d.id, name_zh: x.d.name_zh, name_en: x.d.name_en, price: x.d.price, qty: x.qty,
    }));
    const res = await createOrder(slug, { items, total, table_no: tableNo, phone: digits, note });
    setSubmitting(false);
    if (res.error) {
      alert("提交失败：" + res.error);
      return;
    }
    setPlaced(true);
    setPlacedOrders((p) => [
      ...p,
      { lines: cartLines.map((x) => ({ name_zh: x.d.name_zh, name_en: x.d.name_en, price: x.d.price, qty: x.qty })), total },
    ]);
    setCart({});
    setTableNo(lockedTable ?? "");
    setPhone("");
    setNote("");
  };

  const cats = useMemo(() => {
    const present = Array.from(new Set(dishes.map((d) => d.category).filter(Boolean)));
    const ordered = orderedCategories(present, catOrder, ORDER);
    return ordered.map((c) => ({ category: c, items: dishes.filter((d) => d.category === c) }));
  }, [dishes, catOrder]);

  // default the active tab to the first category once dishes load
  useEffect(() => {
    if (cats.length && !cats.some((g) => g.category === activeCat)) {
      setActiveCat(cats[0].category);
    }
  }, [cats, activeCat]);

  const activeGroup = cats.find((g) => g.category === activeCat) ?? cats[0];

  // Search across all dishes (zh + en), case-insensitive, flat results.
  const q = query.trim().toLowerCase();
  const results = q
    ? dishes.filter(
        (d) => d.name_zh.toLowerCase().includes(q) || (d.name_en || "").toLowerCase().includes(q),
      )
    : [];

  const renderDish = (d: MenuItem) => {
    const qty = cart[d.id] ?? 0;
    return (
      <div key={d.id} className="flex items-center gap-3">
        {d.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image_url} alt={d.name_zh} className="h-14 w-14 flex-none rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold leading-snug text-ink">{lang === "zh" ? d.name_zh : d.name_en || d.name_zh}</div>
          {lang === "zh"
            ? d.name_en && <div className="text-xs text-ink-faint">{d.name_en}</div>
            : <div className="text-xs text-ink-faint">{d.name_zh}</div>}
          <div className="mt-1 text-sm font-bold text-jade">{fmtPrice(d.price) || t("market")}</div>
        </div>
        {qty === 0 ? (
          <button onClick={() => inc(d.id, 1)} className="flex-none rounded-full bg-jade px-3 py-1.5 text-sm font-medium text-white">
            ＋
          </button>
        ) : (
          <div className="flex flex-none items-center gap-2">
            <button onClick={() => inc(d.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-ink">－</button>
            <span className="w-5 text-center font-semibold text-ink">{qty}</span>
            <button onClick={() => inc(d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <main
      className="min-h-screen bg-paper pb-20"
      style={{ fontFamily: '"General Sans", "Noto Sans SC", system-ui, sans-serif' }}
    >
      {/* design-system fonts — React hoists these to <head>, scoped to the menu route */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@600;700&display=swap"
        rel="stylesheet"
      />
      <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />

      <header className="sticky top-0 z-10 border-b border-[#ECE7DF] bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          {/* shopping cart — top-left; shows subtotal, opens the order sheet */}
          {(count > 0 || placedTotal > 0) && (
            <button
              onClick={() => setOpen(true)}
              aria-label={t("cart")}
              className="flex flex-none items-center gap-2 rounded-full bg-jade px-3 py-1.5 text-white shadow-sm transition active:scale-95"
            >
              <span className="relative text-base leading-none">
                🛒
                {count > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-jade">
                    {count}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold tabular-nums">${(count > 0 ? total : placedTotal).toFixed(2)}</span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold tracking-wide text-ink" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              {name ? name.zh : "…"}
            </div>
            {name?.en && name.en !== name.zh && (
              <div className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">{name.en}</div>
            )}
          </div>
          <button
            onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}
            className="flex-none rounded-full border border-slate-200 px-3 py-1 text-xs text-ink-soft"
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      {lockedTable && (
        <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
          🪑 {lang === "zh" ? `您正在为 ${lockedTable} 号桌点餐` : `Ordering for Table ${lockedTable}`}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-5 py-6">
        {loaded && dishes.length === 0 && <p className="py-20 text-center text-sm text-ink-faint">菜单还没准备好。</p>}

        {/* search bar — filters across all categories */}
        {dishes.length > 0 && (
          <div className="relative mb-5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              type="search"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm outline-none focus:border-jade focus:ring-2 focus:ring-jade/20"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="clear"
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:bg-slate-100"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {q ? (
          <section className="mb-7">
            {results.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-faint">{t("noResults")}</p>
            ) : (
              <div className="space-y-3">{results.map(renderDish)}</div>
            )}
          </section>
        ) : (
        <>
        {/* category tabs — centered window, folds front/back; lives with the menu */}
        {cats.length > 1 && (() => {
          const idx = Math.max(0, cats.findIndex((g) => g.category === activeGroup?.category));
          const WIN = 5;
          let start = Math.max(0, idx - Math.floor(WIN / 2));
          const end = Math.min(cats.length, start + WIN);
          start = Math.max(0, end - WIN);
          const windowCats = cats.slice(start, end);
          const jump = (i: number) => setActiveCat(cats[i].category);
          return (
            <nav className="mb-5 flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1.5">
              <button
                disabled={idx <= 0}
                onClick={() => jump(idx - 1)}
                className="grid h-7 w-7 flex-none place-items-center rounded-full text-ink-faint hover:bg-slate-100 disabled:opacity-25"
                aria-label="prev"
              >
                ‹
              </button>
              <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden">
                {start > 0 && <span className="text-ink-faint">…</span>}
                {windowCats.map((g) => {
                  const on = g.category === activeGroup?.category;
                  return (
                    <button
                      key={g.category}
                      onClick={() => jump(cats.findIndex((c) => c.category === g.category))}
                      className={`flex-none whitespace-nowrap rounded-full px-3 py-1 text-sm transition ${
                        on ? "bg-jade font-medium text-white" : "text-ink-soft hover:bg-slate-100"
                      }`}
                    >
                      {g.category}
                      <span className={`ml-1 text-xs ${on ? "text-white/60" : "text-ink-faint"}`}>{g.items.length}</span>
                    </button>
                  );
                })}
                {end < cats.length && <span className="text-ink-faint">…</span>}
              </div>
              <button
                disabled={idx >= cats.length - 1}
                onClick={() => jump(idx + 1)}
                className="grid h-7 w-7 flex-none place-items-center rounded-full text-ink-faint hover:bg-slate-100 disabled:opacity-25"
                aria-label="next"
              >
                ›
              </button>
            </nav>
          );
        })()}

        {activeGroup && (
          <section className="mb-7">
            <h2 className="mb-3 border-b-2 border-ink/80 pb-1 text-base font-bold text-ink">{activeGroup.category}</h2>
            <div className="space-y-3">{activeGroup.items.map(renderDish)}</div>
          </section>
        )}
        </>
        )}
      </div>

      {/* cart sheet */}
      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-bold text-ink">{t("cart")}</div>
              <button onClick={() => setOpen(false)} className="text-ink-faint">✕</button>
            </div>

            {/* already-ordered rounds (this session) */}
            {placedLines.length > 0 && (
              <div className="mb-3 rounded-xl border border-jade/20 bg-jade-wash/50 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-jade">
                  <span>✓ {t("prevOrdered")}</span>
                  <span className="tabular-nums">${placedTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-0.5">
                  {placedLines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-2 text-xs text-ink-soft">
                      <span className="min-w-0 truncate">{lang === "zh" ? l.name_zh : l.name_en || l.name_zh} ×{l.qty}</span>
                      <span className="flex-none tabular-nums">{fmtPrice((Number(l.price) || 0) * l.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cartLines.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-faint">{t("empty")}</p>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {cartLines.map((x) => (
                    <div key={x.d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink">{x.d.name_zh}</div>
                        <div className="text-xs text-ink-faint">{fmtPrice(x.d.price) || t("market")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => inc(x.d.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300">－</button>
                        <span className="w-5 text-center font-semibold">{x.qty}</span>
                        <button onClick={() => inc(x.d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* hot-pot add-on upsell */}
                {hasHotpot && hotpotSides.length > 0 && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-3">
                    <div className="mb-2 text-sm font-medium text-amber-800">
                      🍲 {lang === "zh" ? "点了火锅，加点配菜？" : "Hot pot — add some sides?"}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {hotpotSides.map((d) => {
                        const q = cart[d.id] ?? 0;
                        return (
                          <button
                            key={d.id}
                            onClick={() => inc(d.id, 1)}
                            className={`flex-none rounded-lg border px-3 py-2 text-left transition ${
                              q > 0 ? "border-jade bg-jade-wash" : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                          >
                            <div className="text-sm font-medium text-ink">
                              {lang === "zh" ? d.name_zh : d.name_en || d.name_zh}
                              {q > 0 && <span className="ml-1 text-jade">×{q}</span>}
                            </div>
                            <div className="text-xs text-ink-faint">{fmtPrice(d.price) || t("market")} ＋</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-2">
                  {lockedTable ? (
                    <div className="rounded-lg border border-jade/30 bg-jade-wash px-3 py-2 text-sm font-medium text-jade">
                      🪑 {lockedTable} 号桌
                    </div>
                  ) : (
                    <input className="input" placeholder={t("table")} value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
                  )}
                  <div>
                    <input
                      className={`input ${phoneErr ? "border-red-400 ring-2 ring-red-200" : ""}`}
                      type="tel"
                      inputMode="tel"
                      placeholder={t("phone")}
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); if (phoneErr) setPhoneErr(false); }}
                    />
                    {phoneErr && <p className="mt-1 text-xs text-red-600">{t("phoneErr")}</p>}
                  </div>
                  <input className="input" placeholder={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="mt-4">
                  {placedTotal > 0 ? (
                    <div className="mb-3 space-y-1 text-sm">
                      <div className="flex justify-between text-ink-soft"><span>{t("prevOrdered")}</span><span className="tabular-nums">${placedTotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-ink-soft"><span>{t("thisRound")}</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t("grand")}</span><span className="tabular-nums">${grandTotal.toFixed(2)}</span></div>
                    </div>
                  ) : (
                    <div className="mb-3 flex justify-between text-base font-bold text-ink"><span>{t("total")}</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
                  )}
                  <button onClick={submit} disabled={submitting} className="w-full rounded-lg bg-jade py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                    {submitting ? t("submitting") : t("submit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* placed confirmation */}
      {placed && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 px-6" onClick={() => { setPlaced(false); setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl">✅</div>
            <p className="mt-3 font-medium text-ink">{t("placed")}</p>
            <button onClick={() => { setPlaced(false); setOpen(false); }} className="inline-flex items-center justify-center rounded-lg bg-jade font-medium text-white transition hover:opacity-90 mt-5 px-6 py-2.5">{t("another")}</button>
          </div>
        </div>
      )}

      <footer className="pb-8 text-center text-[11px] text-ink-faint">🍱 Powered by BentoOS</footer>
    </main>
  );
}
