"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { listMenuItems, type MenuItem } from "@/lib/menu";
import { createOrder, type OrderItem } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";

const ORDER = [
  "招牌精选", "滋补菜式", "火锅", "火锅配菜", "海鲜", "汤羹", "头盘", "蔬菜豆腐",
  "猪肉牛肉", "鸡鸭", "铁板煲仔", "芙蓉蛋", "炒粉面", "煲仔饭", "饭类", "炒饭",
  "汤粉面", "粥类", "酒水饮品",
];

type Lang = "zh" | "en";

const T = {
  zh: { menu: "扫码菜单", add: "加入", cart: "查看订单", submit: "提交订单", table: "桌号（可选）", phone: "电话号码（可选）", note: "备注（可选）", empty: "还没选菜", items: "份", total: "合计", placed: "已下单，厨房马上处理 🎉", another: "再点一单", market: "时价", submitting: "提交中…" },
  en: { menu: "Digital Menu", add: "Add", cart: "View order", submit: "Place order", table: "Table # (optional)", phone: "Phone (optional)", note: "Note (optional)", empty: "No items yet", items: "items", total: "Total", placed: "Order placed — kitchen is on it 🎉", another: "Order again", market: "Market", submitting: "Submitting…" },
};

export default function PublicMenu() {
  const slug = useParams().tenant as string;
  const [lang, setLang] = useState<Lang>("zh");
  const [name, setName] = useState<{ zh: string; en: string } | null>(null);
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [tableNo, setTableNo] = useState("");
  const [lockedTable, setLockedTable] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  const t = (k: keyof typeof T["zh"]) => T[lang][k];

  useEffect(() => {
    // per-table QR: /menu/<slug>?t=5 → lock to table 5
    const tParam = new URLSearchParams(window.location.search).get("t");
    if (tParam) {
      setLockedTable(tParam);
      setTableNo(tParam);
    }
    Promise.all([
      supabase.from("storefront").select("name").eq("slug", slug).maybeSingle(),
      listMenuItems(slug),
    ]).then(([shop, items]) => {
      const n = shop.data?.name;
      setName(typeof n === "string" ? { zh: n, en: n } : n ?? { zh: slug, en: slug });
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

  const submit = async () => {
    setSubmitting(true);
    const items: OrderItem[] = cartLines.map((x) => ({
      id: x.d.id, name_zh: x.d.name_zh, name_en: x.d.name_en, price: x.d.price, qty: x.qty,
    }));
    const res = await createOrder(slug, { items, total, table_no: tableNo, phone, note });
    setSubmitting(false);
    if (res.error) {
      alert("提交失败：" + res.error);
      return;
    }
    setPlaced(true);
    setCart({});
    setTableNo(lockedTable ?? "");
    setPhone("");
    setNote("");
  };

  const cats = ORDER
    .map((c) => ({ category: c, items: dishes.filter((d) => d.category === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-ink text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-lg font-bold tracking-wide">{name ? name[lang] : "…"}</div>
            <div className="text-[11px] text-white/50">{t("menu")} · Digital Menu</div>
          </div>
          <button onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))} className="rounded-full border border-white/30 px-3 py-1 text-xs">
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      {lockedTable && (
        <div className="bg-brand-wash py-2 text-center text-sm font-medium text-brand">
          🪑 {lang === "zh" ? `您正在为 ${lockedTable} 号桌点餐` : `Ordering for Table ${lockedTable}`}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-5 py-6">
        {loaded && dishes.length === 0 && <p className="py-20 text-center text-sm text-ink-faint">菜单还没准备好。</p>}

        {cats.map((g) => (
          <section key={g.category} className="mb-7">
            <h2 className="mb-3 border-b-2 border-ink/80 pb-1 text-base font-bold text-ink">{g.category}</h2>
            <div className="space-y-3">
              {g.items.map((d) => {
                const qty = cart[d.id] ?? 0;
                return (
                  <div key={d.id} className="flex items-center gap-3">
                    {d.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image_url} alt={d.name_zh} className="h-14 w-14 flex-none rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{lang === "zh" ? d.name_zh : d.name_en || d.name_zh}</div>
                      {lang === "zh"
                        ? d.name_en && <div className="text-xs text-ink-faint">{d.name_en}</div>
                        : <div className="text-xs text-ink-faint">{d.name_zh}</div>}
                      <div className="mt-0.5 text-sm font-semibold text-ink">{fmtPrice(d.price) || t("market")}</div>
                    </div>
                    {/* qty control */}
                    {qty === 0 ? (
                      <button onClick={() => inc(d.id, 1)} className="flex-none rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white">
                        ＋
                      </button>
                    ) : (
                      <div className="flex flex-none items-center gap-2">
                        <button onClick={() => inc(d.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-ink">－</button>
                        <span className="w-5 text-center font-semibold text-ink">{qty}</span>
                        <button onClick={() => inc(d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">＋</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* sticky cart bar */}
      {count > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl items-center justify-between bg-brand px-5 py-4 text-white shadow-lg"
        >
          <span className="text-sm">🛒 {count} {t("items")} · {t("total")} ${total.toFixed(2)}</span>
          <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium">{t("cart")} →</span>
        </button>
      )}

      {/* cart sheet */}
      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-bold text-ink">{t("cart")}</div>
              <button onClick={() => setOpen(false)} className="text-ink-faint">✕</button>
            </div>

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
                        <button onClick={() => inc(x.d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">＋</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-2">
                  {lockedTable ? (
                    <div className="rounded-lg border border-brand/30 bg-brand-wash px-3 py-2 text-sm font-medium text-brand">
                      🪑 {lockedTable} 号桌
                    </div>
                  ) : (
                    <input className="input" placeholder={t("table")} value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
                  )}
                  <input className="input" type="tel" inputMode="tel" placeholder={t("phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <input className="input" placeholder={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-ink-soft">{t("total")} <b className="text-ink">${total.toFixed(2)}</b></span>
                  <button onClick={submit} disabled={submitting} className="btn-primary px-6 py-2.5 disabled:opacity-50">
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
            <button onClick={() => { setPlaced(false); setOpen(false); }} className="btn-primary mt-5 px-6 py-2.5">{t("another")}</button>
          </div>
        </div>
      )}

      <footer className="pb-8 text-center text-[11px] text-ink-faint">🍱 Powered by BentoOS</footer>
    </main>
  );
}
