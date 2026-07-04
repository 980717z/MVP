"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { listMenuItems, orderedCategories, parseCartKey, cartKey, unitPrice, displayPrice, type MenuItem, type Variant } from "@/lib/menu";
import { createOrder, type OrderItem } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";
import { priceOrder, deliveryShortfall, isValidPostal, inDeliveryZone, DELIVERY_TIP_RATE } from "@/lib/tax";

const ORDER = [
  "招牌精选", "滋补菜式", "火锅", "火锅配菜", "海鲜", "汤羹", "头盘", "蔬菜豆腐",
  "猪肉牛肉", "鸡鸭", "铁板煲仔", "芙蓉蛋", "炒粉面", "煲仔饭", "饭类", "炒饭",
  "汤粉面", "粥类", "酒水饮品",
];

type Lang = "zh" | "en";

const T = {
  zh: { menu: "扫码菜单", search: "搜索菜品", noResults: "没有找到相关菜品", add: "加入", cart: "查看订单", submit: "提交订单", table: "桌号（可选）", phone: "电话号码（必填）", phoneErr: "请填写 10 位电话号码", note: "备注（可选）", empty: "还没选菜", items: "份", total: "合计", subtotal: "小计", prevOrdered: "已点", thisRound: "本次新增", grand: "累计合计", placed: "已下单，厨房马上处理 🎉", another: "再点一单", market: "时价", submitting: "提交中…",
    togoBadge: "外卖 · 自取", pickup: "自取", delivery: "配送", street: "街道地址（必填）", unit: "单元/门牌（可选）", postal: "邮编（必填）", postalBad: "请填写有效邮编（如 M5T 2E7）", zoneBad: "超出配送范围 —— 仅限多伦多市中心", minShort: "满 $30 起送，还差", hst: "税 HST 13%", tipLine: "配送小费 10%", email: "邮箱（可选，接收订单通知）", payFirst: "外卖/配送需在线支付，付款后厨房开始备餐", paySoon: "在线支付即将开通，敬请期待", goPay: "去支付" },
  en: { menu: "Digital Menu", search: "Search dishes", noResults: "No dishes found", add: "Add", cart: "View order", submit: "Place order", table: "Table # (optional)", phone: "Phone (required)", phoneErr: "Please enter a 10-digit phone number", note: "Note (optional)", empty: "No items yet", items: "items", total: "Total", subtotal: "Subtotal", prevOrdered: "Already ordered", thisRound: "This round", grand: "Running total", placed: "Order placed — kitchen is on it 🎉", another: "Order again", market: "Market", submitting: "Submitting…",
    togoBadge: "Takeout · Delivery", pickup: "Pickup", delivery: "Delivery", street: "Street address (required)", unit: "Unit (optional)", postal: "Postal code (required)", postalBad: "Enter a valid postal code (e.g. M5T 2E7)", zoneBad: "Outside our delivery zone — downtown Toronto only", minShort: "$30 minimum for delivery — add", hst: "HST 13%", tipLine: "Delivery tip 10%", email: "Email (optional, for order updates)", payFirst: "Takeout & delivery are paid online; the kitchen starts after payment", paySoon: "Online payment coming soon", goPay: "Pay now" },
};

// Flipped to "1" when the Clover checkout routes go live (Phase 0/1).
const PAYMENTS_LIVE = process.env.NEXT_PUBLIC_PAYMENTS_LIVE === "1";
// Client-side zone hint; the server re-validates against tenants.delivery_fsas at checkout.
const DT_FSAS = ["M4W", "M4X", "M4Y", "M5A", "M5B", "M5C", "M5E", "M5G", "M5H", "M5J", "M5K", "M5L", "M5S", "M5T", "M5V", "M5X"];

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
  const [sheetDish, setSheetDish] = useState<MenuItem | null>(null); // open 多规格 size sheet
  const railRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");

  // 外卖/自取 mode: entered via the separate QR (?m=togo). Dine-in tables use ?t=N.
  const [togoMode, setTogoMode] = useState(false);
  const [togoType, setTogoType] = useState<"togo" | "delivery">("togo");
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [postal, setPostal] = useState("");
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const t = (k: keyof typeof T["zh"]) => T[lang][k];

  useEffect(() => {
    // per-table QR: /menu/<slug>?t=5 → lock to table 5
    // togo QR:      /menu/<slug>?m=togo → takeout/delivery mode (pay-first)
    const params = new URLSearchParams(window.location.search);
    const tParam = params.get("t");
    if (tParam) {
      setLockedTable(tParam);
      setTableNo(tParam);
    }
    if (params.get("m") === "togo") setTogoMode(true);
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
  const inc = (key: string, delta: number) =>
    setCart((c) => {
      const q = Math.max(0, (c[key] ?? 0) + delta);
      const next = { ...c };
      if (q === 0) delete next[key];
      else next[key] = q;
      return next;
    });

  // Cart is keyed by dish id (single-price) or `id#variantIndex` (a chosen size).
  const cartLines = Object.entries(cart)
    .map(([key, qty]) => {
      const { id, vi } = parseCartKey(key);
      const d = byId[id];
      if (!d) return null;
      const variant = vi != null ? d.variants?.[vi] ?? null : null;
      return { key, d, variant, unit: unitPrice(d, vi), qty };
    })
    .filter((x): x is { key: string; d: MenuItem; variant: Variant | null; unit: number; qty: number } => !!x);
  const count = cartLines.reduce((a, x) => a + x.qty, 0);
  const total = cartLines.reduce((a, x) => a + x.unit * x.qty, 0);
  // Display name with size baked in, so kitchen ticket / receipt / ledger read "红烧蟹肉翅（中）".
  const lineName = (d: MenuItem, v: Variant | null, en = false) =>
    en
      ? v ? `${d.name_en || d.name_zh} (${v.label_en || v.label_zh})` : d.name_en || d.name_zh
      : v ? `${d.name_zh}（${v.label_zh}）` : d.name_zh;
  // qty of a dish across all its sizes (for the 选规格 button badge)
  const dishQty = (id: string) =>
    cartLines.reduce((a, x) => (x.d.id === id ? a + x.qty : a), 0);

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

  // togo/delivery pricing: HST on food; delivery adds mandatory 10% tip (pre-tax,
  // untaxed) and a $30 minimum. Display only — the server re-prices at checkout.
  const isDelivery = togoMode && togoType === "delivery";
  const pricing = priceOrder(total, isDelivery ? DELIVERY_TIP_RATE : 0);
  const shortfall = isDelivery ? deliveryShortfall(total) : 0;

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

    // Delivery: validate address + downtown zone + $30 minimum before anything else.
    // (Client-side hint only — the checkout server re-validates authoritatively.)
    if (isDelivery) {
      if (!street.trim()) { setAddrErr(t("street")); return; }
      if (!isValidPostal(postal)) { setAddrErr(t("postalBad")); return; }
      if (!inDeliveryZone(postal, DT_FSAS)) { setAddrErr(t("zoneBad")); return; }
      if (shortfall > 0) { setAddrErr(`${t("minShort")} $${shortfall.toFixed(2)}`); return; }
      setAddrErr(null);
    }

    // Pay-first rule: takeout/delivery orders are only submitted once online
    // payment is live — otherwise they'd sit invisible (pending) forever.
    if (togoMode && !PAYMENTS_LIVE) return;

    setSubmitting(true);
    const items: OrderItem[] = cartLines.map((x) => ({
      id: x.d.id,
      name_zh: lineName(x.d, x.variant),
      name_en: lineName(x.d, x.variant, true),
      price: x.unit,
      qty: x.qty,
    }));
    const res = await createOrder(slug, {
      items,
      total,
      table_no: togoMode ? "" : tableNo,
      phone: digits,
      note,
      order_type: togoMode ? togoType : "dine_in",
      address: isDelivery ? { street: street.trim(), unit: unit.trim() || undefined, postal: postal.trim().toUpperCase() } : undefined,
      customer_email: togoMode ? email : undefined,
    });
    setSubmitting(false);
    if (res.error) {
      alert("提交失败：" + res.error);
      return;
    }

    if (togoMode && res.id) {
      // Pay-first: hand off to Clover checkout; the webhook/reconcile marks the
      // order paid, which is what releases it to the kitchen + printer.
      window.location.href = `/api/pay/checkout?orderId=${res.id}`;
      return;
    }

    // Dine-in: kitchen fires immediately. No push to a printer here — the Epson
    // TM-T88VI PULLS via Server Direct Print (it polls /api/epson and picks up
    // this order on its next cycle). Nothing to do client-side.
    setPlaced(true);
    setPlacedOrders((p) => [
      ...p,
      { lines: cartLines.map((x) => ({ name_zh: lineName(x.d, x.variant), name_en: lineName(x.d, x.variant, true), price: x.unit, qty: x.qty })), total },
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

  const jumpToCat = (i: number) => {
    setActiveCat(cats[i].category);
    document.getElementById(`menu-cat-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 美团-style scroll-sync: highlight the category whose section sits at the top.
  useEffect(() => {
    if (query.trim()) return; // search mode shows flat results, no rail
    const onScroll = () => {
      let current = cats[0]?.category;
      for (let i = 0; i < cats.length; i++) {
        const el = document.getElementById(`menu-cat-${i}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top - 92 <= 1) current = cats[i].category;
        else break;
      }
      if (current) setActiveCat((prev) => (prev === current ? prev : current));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [query, cats]);

  // keep the active category visible inside the rail (scrolls the rail only, never the page)
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const idx = cats.findIndex((c) => c.category === activeCat);
    const btn = idx >= 0 ? (rail.querySelector(`[data-rail="${idx}"]`) as HTMLElement | null) : null;
    if (!btn) return;
    const top = btn.offsetTop;
    const bottom = top + btn.offsetHeight;
    if (top < rail.scrollTop) rail.scrollTop = top - 8;
    else if (bottom > rail.scrollTop + rail.clientHeight) rail.scrollTop = bottom - rail.clientHeight + 8;
  }, [activeCat, cats]);

  // Search across all dishes (zh + en), case-insensitive, flat results.
  const q = query.trim().toLowerCase();
  const results = q
    ? dishes.filter(
        (d) => d.name_zh.toLowerCase().includes(q) || (d.name_en || "").toLowerCase().includes(q),
      )
    : [];

  const renderDish = (d: MenuItem) => {
    const hasVariants = (d.variants?.length ?? 0) > 0;
    const qty = hasVariants ? dishQty(d.id) : cart[d.id] ?? 0;
    const dp = displayPrice(d);
    return (
      <div key={d.id} className="flex items-center gap-3">
        {d.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image_url} alt={d.name_zh} className="h-14 w-14 flex-none rounded-lg object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold leading-snug text-ink">
            {lang === "zh" ? d.name_zh : d.name_en || d.name_zh}
            {hasVariants && <span className="ml-1.5 rounded border border-jade px-1 align-middle text-[9px] font-bold text-jade">{d.variants.length} 规格</span>}
          </div>
          {lang === "zh"
            ? d.name_en && <div className="text-xs text-ink-faint">{d.name_en}</div>
            : <div className="text-xs text-ink-faint">{d.name_zh}</div>}
          <div className="mt-1 text-sm font-bold text-jade">
            {hasVariants && dp != null && <span className="mr-1 text-xs font-medium text-ink-faint">{lang === "zh" ? "起" : "from"}</span>}
            {fmtPrice(dp) || t("market")}
          </div>
        </div>
        {hasVariants ? (
          <button
            onClick={() => setSheetDish(d)}
            className="relative flex flex-none items-center gap-1 rounded-full border-[1.5px] border-jade bg-white px-3 py-1.5 text-sm font-medium text-jade"
          >
            {lang === "zh" ? "选规格" : "Size"} ›
            {qty > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-jade px-1 text-[10px] font-bold text-white">{qty}</span>}
          </button>
        ) : qty === 0 ? (
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
      className={`min-h-screen bg-paper ${count > 0 || placedTotal > 0 ? "pb-32" : "pb-20"}`}
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
        <div className="mx-auto flex max-w-[440px] items-center gap-3 px-5 py-4">
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

      {lockedTable && !togoMode && (
        <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
          🪑 {lang === "zh" ? `您正在为 ${lockedTable} 号桌点餐` : `Ordering for Table ${lockedTable}`}
        </div>
      )}
      {togoMode && (
        <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
          🛵 {t("togoBadge")} · {t("payFirst")}
        </div>
      )}

      <div className="mx-auto max-w-[440px] px-5 py-6">
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
        <div className="flex gap-3">
          {/* left category rail — all categories visible, tap to jump (美团 / 大众点评 style) */}
          {cats.length > 1 && (
            <nav
              ref={railRef}
              className="sticky top-[68px] z-[5] max-h-[calc(100vh-88px)] w-[88px] flex-none self-start overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {cats.map((g, i) => {
                const on = g.category === activeCat;
                return (
                  <button
                    key={g.category}
                    data-rail={i}
                    onClick={() => jumpToCat(i)}
                    className={`relative block w-full px-2.5 py-3 text-left text-[13px] leading-tight transition ${
                      on ? "bg-jade-wash font-semibold text-jade" : "text-ink-soft hover:bg-slate-50"
                    }`}
                  >
                    {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-jade" />}
                    {g.category}
                    <span className={`mt-0.5 block text-[10px] ${on ? "text-jade/70" : "text-ink-faint"}`}>{g.items.length}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* dish list — every category as a section; scrolling syncs the rail */}
          <div className="min-w-0 flex-1">
            {cats.map((g, i) => (
              <section key={g.category} id={`menu-cat-${i}`} className="mb-7 scroll-mt-[76px]">
                <h2 className="mb-3 flex items-baseline gap-2 border-b-2 border-ink/80 pb-1 text-base font-bold text-ink">
                  {g.category}<span className="text-xs font-normal text-ink-faint">{g.items.length}</span>
                </h2>
                <div className="space-y-3">{g.items.map(renderDish)}</div>
              </section>
            ))}
          </div>
        </div>
        </>
        )}
      </div>

      {/* slim bottom checkout bar — one row, no dish list (美团 pattern) */}
      {(count > 0 || placedTotal > 0) && !open && !sheetDish && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
          <button
            onClick={() => setOpen(true)}
            className="mx-auto flex w-full max-w-[440px] items-center justify-between rounded-full bg-jade py-3 pl-5 pr-2 text-white shadow-[0_6px_24px_rgba(17,122,101,0.35)] transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="relative text-lg leading-none">
                🛒
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-jade">
                    {count}
                  </span>
                )}
              </span>
              <span className="tabular-nums">
                {count > 0
                  ? `${count} ${t("items")} · $${(togoMode ? pricing.grandTotal : total).toFixed(2)}`
                  : `${t("prevOrdered")} $${placedTotal.toFixed(2)}`}
              </span>
            </span>
            <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold">
              {count > 0 ? (togoMode ? t("goPay") : t("submit")) : t("cart")} →
            </span>
          </button>
        </div>
      )}

      {/* 多规格 size selector — tap 选规格 opens this */}
      {sheetDish && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={() => setSheetDish(null)}>
          <div className="mx-auto max-h-[78vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-bold text-ink" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>{sheetDish.name_zh}</div>
                {sheetDish.name_en && <div className="text-xs text-ink-faint">{sheetDish.name_en}</div>}
              </div>
              <button onClick={() => setSheetDish(null)} className="flex-none text-ink-faint">✕</button>
            </div>
            <div className="mb-1 text-xs text-ink-soft">{lang === "zh" ? "选择大小" : "Choose a size"}</div>
            <div className="divide-y divide-slate-100">
              {sheetDish.variants.map((v, vi) => {
                const key = cartKey(sheetDish.id, vi);
                const q = cart[key] ?? 0;
                return (
                  <div key={vi} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-ink" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
                        {v.label_zh}{v.label_en && <span className="ml-1.5 text-xs font-normal text-ink-faint">{v.label_en}</span>}
                      </div>
                    </div>
                    <span className="font-bold tabular-nums text-jade">{fmtPrice(v.price)}</span>
                    {q === 0 ? (
                      <button onClick={() => inc(key, 1)} className="grid h-8 w-8 flex-none place-items-center rounded-full bg-jade text-lg text-white">＋</button>
                    ) : (
                      <div className="flex flex-none items-center gap-2">
                        <button onClick={() => inc(key, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300">－</button>
                        <span className="w-5 text-center font-semibold">{q}</span>
                        <button onClick={() => inc(key, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setSheetDish(null)} className="mt-4 w-full rounded-lg bg-jade py-3 font-medium text-white">
              {lang === "zh" ? "完成" : "Done"}{count > 0 ? ` · ${count} ${t("items")}` : ""}
            </button>
          </div>
        </div>
      )}

      {/* cart sheet */}
      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
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
                    <div key={x.key} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink">{lineName(x.d, x.variant, lang !== "zh")}</div>
                        <div className="text-xs text-ink-faint">{fmtPrice(x.unit) || t("market")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => inc(x.key, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300">－</button>
                        <span className="w-5 text-center font-semibold">{x.qty}</span>
                        <button onClick={() => inc(x.key, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
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

                {/* togo: pickup/delivery toggle + delivery address */}
                {togoMode && (
                  <div className="mt-4 grid gap-2">
                    <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
                      <button
                        onClick={() => setTogoType("togo")}
                        className={`flex-1 rounded-md py-2 font-medium ${togoType === "togo" ? "bg-jade text-white" : "text-ink-soft"}`}
                      >
                        🛍️ {t("pickup")}
                      </button>
                      <button
                        onClick={() => setTogoType("delivery")}
                        className={`flex-1 rounded-md py-2 font-medium ${togoType === "delivery" ? "bg-jade text-white" : "text-ink-soft"}`}
                      >
                        🛵 {t("delivery")}
                      </button>
                    </div>
                    {isDelivery && (
                      <>
                        <input className="input" placeholder={t("street")} value={street} onChange={(e) => { setStreet(e.target.value); setAddrErr(null); }} />
                        <div className="grid grid-cols-2 gap-2">
                          <input className="input" placeholder={t("unit")} value={unit} onChange={(e) => setUnit(e.target.value)} />
                          <input className="input uppercase" placeholder={t("postal")} value={postal} onChange={(e) => { setPostal(e.target.value); setAddrErr(null); }} />
                        </div>
                        {addrErr && <p className="text-xs text-red-600">{addrErr}</p>}
                      </>
                    )}
                    <input className="input" type="email" inputMode="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                )}

                <div className={`grid gap-2 ${togoMode ? "mt-2" : "mt-4"}`}>
                  {!togoMode && (lockedTable ? (
                    <div className="rounded-lg border border-jade/30 bg-jade-wash px-3 py-2 text-sm font-medium text-jade">
                      🪑 {lockedTable} 号桌
                    </div>
                  ) : (
                    <input className="input" placeholder={t("table")} value={tableNo} onChange={(e) => setTableNo(e.target.value)} />
                  ))}
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
                  {togoMode ? (
                    /* takeout/delivery: full price breakdown — HST + mandatory delivery tip */
                    <div className="mb-3 space-y-1 text-sm tabular-nums">
                      <div className="flex justify-between text-ink-soft"><span>{t("subtotal")}</span><span>${pricing.subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-ink-soft"><span>{t("hst")}</span><span>${(pricing.gst + pricing.pst).toFixed(2)}</span></div>
                      {isDelivery && (
                        <div className="flex justify-between text-ink-soft"><span>{t("tipLine")}</span><span>${pricing.tip.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t("total")}</span><span>${pricing.grandTotal.toFixed(2)}</span></div>
                      {isDelivery && shortfall > 0 && (
                        <p className="text-xs font-medium text-amber-700">{t("minShort")} ${shortfall.toFixed(2)}</p>
                      )}
                    </div>
                  ) : placedTotal > 0 ? (
                    <div className="mb-3 space-y-1 text-sm">
                      <div className="flex justify-between text-ink-soft"><span>{t("prevOrdered")}</span><span className="tabular-nums">${placedTotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-ink-soft"><span>{t("thisRound")}</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t("grand")}</span><span className="tabular-nums">${grandTotal.toFixed(2)}</span></div>
                    </div>
                  ) : (
                    <div className="mb-3 flex justify-between text-base font-bold text-ink"><span>{t("total")}</span><span className="tabular-nums">${total.toFixed(2)}</span></div>
                  )}
                  {togoMode && !PAYMENTS_LIVE && (
                    <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">⏳ {t("paySoon")}</p>
                  )}
                  <button
                    onClick={submit}
                    disabled={submitting || (togoMode && (!PAYMENTS_LIVE || (isDelivery && shortfall > 0)))}
                    className="w-full rounded-lg bg-jade py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting ? t("submitting") : togoMode ? `${t("goPay")} · $${pricing.grandTotal.toFixed(2)}` : t("submit")}
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

      {/* discreet but findable: links to the BentoOS landing page */}
      <footer className="pb-8 text-center">
        <a
          href="/"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] text-ink-faint transition hover:bg-white hover:text-jade"
          title="BentoOS — 小商家的轻量后台"
        >
          🍱 Powered by <span className="font-semibold underline decoration-dotted underline-offset-2">BentoOS</span>
        </a>
      </footer>
    </main>
  );
}
