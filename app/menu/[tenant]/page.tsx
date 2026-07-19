"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { listMenuItems, orderedCategories, parseCartKey, cartKey, unitPrice, displayPrice, isChoiceDish, catLabel, lineName, isNoCookDish, type MenuItem, type Variant } from "@/lib/menu";
import { createOrder, type OrderItem } from "@/lib/orders";
import { createPickupOrder } from "@/lib/pickup";
import { price as fmtPrice, displayTable } from "@/lib/format";
import { priceOrder, deliveryShortfall, isValidPostal, inDeliveryZone, postalFsa, DELIVERY_TIP_RATE } from "@/lib/tax";
import { FSA_NAMES, fsaLabel, publicDeliveryFsas } from "@/lib/deliveryZone";
import CheckoutSheet from "@/components/CheckoutSheet";
import { resolveMenuView, MENU_VIEW_KEY, type MenuView } from "@/lib/menuView";
import { BentoMark } from "@/components/BentoMark";
import { track } from "@/lib/track";

/** Resolve the student's pickup-time choice → ISO timestamp (null = ASAP).
 *  Number = minutes from now; "HH:MM" = today at that clock time (error if
 *  it's already more than a couple of minutes past). */
function resolvePickupAt(when: "asap" | number | string): { iso: string | null } | { invalid: true } {
  if (when === "asap") return { iso: null };
  if (typeof when === "number") return { iso: new Date(Date.now() + when * 60_000).toISOString() };
  const m = when.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { invalid: true };
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() < Date.now() - 2 * 60_000) return { invalid: true };
  return { iso: d.toISOString() };
}
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Traction attribution: how this menu session arrived. Derived from the URL,
 *  which is stable for the whole visit — recomputed at fire time so no state.
 *  "embed" (landing iframe) and "staff" (staff order entry) exist so /admin can
 *  exclude non-customer traffic from the funnel. */
function entrySrc(): string {
  const p = new URLSearchParams(window.location.search);
  if (p.get("embed") === "1") return "embed";
  if (p.get("staff") === "1") return "staff";
  if (p.get("m") === "pickup") return "pickup";
  if (p.get("m") === "togo") return "togo";
  if (p.get("t")) return "qr";
  return "direct";
}

const ORDER = [
  "招牌精选", "滋补菜式", "火锅", "火锅配菜", "海鲜", "汤羹", "头盘", "蔬菜豆腐",
  "猪肉牛肉", "鸡鸭", "铁板煲仔", "芙蓉蛋", "炒粉面", "煲仔饭", "饭类", "炒饭",
  "汤粉面", "粥类", "酒水饮品",
];

type Lang = "zh" | "en" | "fr";

const T = {
  zh: { menu: "扫码菜单", search: "搜索菜品", noResults: "没有找到相关菜品", add: "加入", cart: "查看订单", submit: "提交订单", table: "桌号（可选）", phone: "电话号码（必填）", phoneErr: "请填写 10 位电话号码", note: "备注（可选）", empty: "还没选菜", items: "份", total: "合计", subtotal: "小计", prevOrdered: "已点", thisRound: "本次新增", grand: "累计合计", placed: "已下单，厨房马上处理 🎉", another: "再点一单", market: "时价", submitting: "提交中…", sendOrder: "送出订单", sentCallback: "订单已送出 🎉 富来会致电与您确认", callbackHint: "无需在线支付 · 富来会致电确认订单与地址", estNote: "预计金额 · 以电话确认为准",
    togoBadge: "外卖 · 自取", pickup: "自取", delivery: "配送", street: "街道地址（必填）", unit: "单元/门牌（可选）", postal: "邮编（必填）", postalBad: "请填写有效邮编（如 M5T 2E7）", zoneBad: "超出配送范围", minShort: "满 $30 起送，还差", hst: "税 HST 13%", tipLine: "配送小费 10%", email: "邮箱（可选，接收订单通知）", payFirst: "外卖/配送需在线支付，付款后厨房开始备餐", paySoon: "在线支付即将开通，敬请期待", goPay: "去支付",
    chooseMode: "怎么取餐？", pickupHint: "到店自取 · 无额外费用", deliveryHint: "满 $30 起送 · 10% 配送小费", addrTitle: "配送地址", postalHint: "先填邮编，马上告诉你能不能送", canDeliver: "可以配送到", noDeliver: "暂不配送到", switchPickup: "改为自取 →", zoneList: "查看全部配送范围", city: "Toronto, ON", deliverTo: "配送到", addrMissing: "请填写完整配送地址" },
  en: { menu: "Digital Menu", search: "Search dishes", noResults: "No dishes found", add: "Add", cart: "View order", submit: "Place order", table: "Table # (optional)", phone: "Phone (required)", phoneErr: "Please enter a 10-digit phone number", note: "Note (optional)", empty: "No items yet", items: "items", total: "Total", subtotal: "Subtotal", prevOrdered: "Already ordered", thisRound: "This round", grand: "Running total", placed: "Order placed — kitchen is on it 🎉", another: "Order again", market: "Market", submitting: "Submitting…", sendOrder: "Send order", sentCallback: "Order sent 🎉 Fulai will call to confirm", callbackHint: "No online payment — Fulai will call to confirm your order & address", estNote: "Estimate — confirmed by phone",
    togoBadge: "Takeout · Delivery", pickup: "Pickup", delivery: "Delivery", street: "Street address (required)", unit: "Unit (optional)", postal: "Postal code (required)", postalBad: "Enter a valid postal code (e.g. M5T 2E7)", zoneBad: "Outside our delivery zone", minShort: "$30 minimum for delivery — add", hst: "HST 13%", tipLine: "Delivery tip 10%", email: "Email (optional, for order updates)", payFirst: "Takeout & delivery are paid online; the kitchen starts after payment", paySoon: "Online payment coming soon", goPay: "Pay now",
    chooseMode: "How would you like your order?", pickupHint: "Pick up at the restaurant · no fees", deliveryHint: "$30 minimum · 10% delivery tip", addrTitle: "Delivery address", postalHint: "Postal code first — we'll check your area instantly", canDeliver: "We deliver to", noDeliver: "We don't deliver to", switchPickup: "Switch to pickup →", zoneList: "See all delivery areas", city: "Toronto, ON", deliverTo: "Deliver to", addrMissing: "Please complete the delivery address" },
  fr: { menu: "Menu numérique", search: "Rechercher un plat", noResults: "Aucun plat trouvé", add: "Ajouter", cart: "Voir la commande", submit: "Commander", table: "N° de table (facultatif)", phone: "Téléphone (requis)", phoneErr: "Entrez un numéro à 10 chiffres", note: "Note (facultatif)", empty: "Aucun article", items: "articles", total: "Total", subtotal: "Sous-total", prevOrdered: "Déjà commandé", thisRound: "Cette fois", grand: "Total cumulé", placed: "Commande passée — la cuisine s'en occupe 🎉", another: "Commander encore", market: "Prix du jour", submitting: "Envoi…", sendOrder: "Envoyer la commande", sentCallback: "Commande envoyée 🎉 Fulai vous appellera pour confirmer", callbackHint: "Aucun paiement en ligne — Fulai vous appellera pour confirmer la commande et l'adresse", estNote: "Estimation — confirmée par téléphone",
    togoBadge: "À emporter · Livraison", pickup: "À emporter", delivery: "Livraison", street: "Adresse (requise)", unit: "Unité (facultatif)", postal: "Code postal (requis)", postalBad: "Code postal invalide (ex. M5T 2E7)", zoneBad: "Hors de notre zone de livraison", minShort: "Minimum 30 $ — ajoutez", hst: "TVH 13 %", tipLine: "Pourboire livraison 10 %", email: "Courriel (facultatif, pour le suivi)", payFirst: "À emporter et livraison payés en ligne; la cuisine commence après le paiement", paySoon: "Paiement en ligne bientôt disponible", goPay: "Payer",
    chooseMode: "Comment souhaitez-vous commander ?", pickupHint: "Au restaurant · sans frais", deliveryHint: "Minimum 30 $ · pourboire 10 %", addrTitle: "Adresse de livraison", postalHint: "Le code postal d'abord — on vérifie votre secteur", canDeliver: "Nous livrons à", noDeliver: "Nous ne livrons pas à", switchPickup: "Passer à emporter →", zoneList: "Voir toutes les zones", city: "Toronto, ON", deliverTo: "Livrer à", addrMissing: "Veuillez compléter l'adresse de livraison" },
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
  const [tables, setTables] = useState<string[]>([]); // real table labels for the 整店一码 dropdown
  const [tableErr, setTableErr] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("1"); // country code, +1 default
  const [phoneErr, setPhoneErr] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  // togo/delivery pay-first: the order awaiting card payment (Clover sheet)
  const [payingOrder, setPayingOrder] = useState<{ id: string; amount: number; lines: PlacedLine[] } | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");
  const [sheetDish, setSheetDish] = useState<MenuItem | null>(null); // open 多规格 size sheet
  const [sidesOpen, setSidesOpen] = useState(false); // full 火锅配菜 sheet (auto-opens on hotpot)
  // staff (?staff=1) per-item customization: note + price adjustment (±), keyed by cartKey
  // Per-PORTION note + price adjustment: units[u] customizes the u-th portion, so a
  // note can apply to just one of several identical dishes (grouped back into order lines).
  const [itemMeta, setItemMeta] = useState<Record<string, { units: { note?: string; adjust?: number }[] }>>({});
  const [staffEditKey, setStaffEditKey] = useState<string | null>(null); // cartKey whose editor sheet is open
  const [editUnits, setEditUnits] = useState<{ note: string; adjust: string }[]>([]);
  const railRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");

  // 外卖/自取 mode: entered via the separate QR (?m=togo). Dine-in tables use ?t=N.
  const [togoMode, setTogoMode] = useState(false);
  // Campus order-ahead PICKUP (?m=pickup): a food-truck / single-window vendor.
  // Implies togoMode's layout (no table, phone required, cart checkout) but is
  // always pickup (no delivery chooser), order-only, and on submit routes through
  // the server pickup-create route → redirects to the /order/[id]?t=<token> tracker.
  const [pickupMode, setPickupMode] = useState(false);
  // Scheduled pickup: "asap" | minutes-from-now (15/30/45) | "HH:MM" custom.
  // Students order from class and note when they'll swing by the truck.
  const [pickupWhen, setPickupWhen] = useState<"asap" | 15 | 30 | 45 | string>("asap");
  const [pickupErr, setPickupErr] = useState("");
  // Truck hours (design review 4A): closed banner + disabled checkout + picker
  // max. null until fetched; unconfigured hours never gate.
  const [truckHours, setTruckHours] = useState<{ open: boolean; unconfigured: boolean; opensAt: string | null; closesAt: string | null } | null>(null);
  // ?embed=1 (landing showcase): hide the shop's name until we have written
  // authorization to feature it. Purely additive — printed QR params untouched.
  const [embed, setEmbed] = useState(false);
  const [staff, setStaff] = useState(false); // opened from the floor plan (?staff=1): phone optional + ping parent on placement
  const [togoType, setTogoType] = useState<"togo" | "delivery">("togo");
  // Desktop/iPad vs phone layout. `viewOverride` = the manual toggle (null = auto).
  // The auto layout is driven by CSS `md:` breakpoints (correct on first paint, no
  // hydration flash); this state only powers the manual override attribute + toggle.
  const [viewOverride, setViewOverride] = useState<MenuView | null>(null);
  const [wideAuto, setWideAuto] = useState(false); // viewport ≥768 (toggle highlight only)
  const [street, setStreet] = useState("");
  const [unit, setUnit] = useState("");
  const [postal, setPostal] = useState("");
  const [addrErr, setAddrErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  // Shop's delivery zone (postal-FSA whitelist) from the public storefront
  // view; falls back to the downtown default until delivery-zone.sql runs.
  const [zoneFsas, setZoneFsas] = useState<string[]>(DT_FSAS);
  const [zoneOpen, setZoneOpen] = useState(false);

  const t = (k: keyof typeof T["zh"]) => T[lang][k];
  // Inline 3-language helper for UI chrome not in the dict. Dish NAMES stay 2-way
  // (fr falls back to English — there is no French dish data in the catalog).
  const tri = (zh: string, en: string, fr: string) => (lang === "zh" ? zh : lang === "fr" ? fr : en);
  // For helpers/data with only zh/en (category & postal-zone names, Clover sheet):
  // French shows English (no French data exists for those).
  const lang2: "zh" | "en" = lang === "zh" ? "zh" : "en";

  // Layout view: read the saved manual choice + track viewport width. Layout itself
  // is CSS-driven (md: breakpoints + the [data-view] override in globals.css); this
  // only resolves the toggle's active state and the override attribute.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(MENU_VIEW_KEY); } catch { /* private mode */ }
    if (stored === "phone" || stored === "desktop") setViewOverride(stored);
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    setWideAuto(mq.matches);
    const on = () => setWideAuto(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const effectiveView = resolveMenuView(viewOverride, wideAuto);
  const setView = (v: MenuView) => {
    setViewOverride(v);
    try { localStorage.setItem(MENU_VIEW_KEY, v); } catch { /* ignore */ }
  };

  // Auto-format the postal code as the customer types: "m5t2e7" → "M5T 2E7"
  const onPostal = (raw: string) => {
    const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setPostal(c.length > 3 ? `${c.slice(0, 3)} ${c.slice(3)}` : c);
    setAddrErr(null);
  };
  // Live zone check: fires as soon as the FSA (first 3 chars) is typed.
  const fsa = postalFsa(postal);
  const fsaTyped = /^[A-Z]\d[A-Z]$/.test(fsa);
  const zoneStatus: "idle" | "ok" | "no" = !fsaTyped ? "idle" : zoneFsas.includes(fsa) ? "ok" : "no";

  // Remember the address across visits (repeat delivery customers).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bentoos-addr") || "null");
      if (saved?.street) setStreet(saved.street);
      if (saved?.unit) setUnit(saved.unit);
      if (saved?.postal) setPostal(saved.postal);
    } catch {}
  }, []);
  useEffect(() => {
    if (street || unit || postal)
      try { localStorage.setItem("bentoos-addr", JSON.stringify({ street, unit, postal })); } catch {}
  }, [street, unit, postal]);

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
    // pickup QR: /menu/<slug>?m=pickup → campus order-ahead. Reuses the togo
    // layout (togoMode) but is pickup-only + routes to the tracking screen.
    // Campus audience is English-first: pickup entry defaults the menu to EN
    // (zh stays one toggle-tap away; explicit ?lang= below still wins).
    if (params.get("m") === "pickup") {
      setTogoMode(true); setPickupMode(true);
      if (!params.get("lang")) setLang("en");
      // Hours gate is a courtesy (server enforces the real one) — fetch failure
      // must never block the menu, so errors just leave truckHours null.
      fetch(`/api/pickup/hours?slug=${encodeURIComponent(slug)}`)
        .then((r) => r.json())
        .then((d) => { if (d?.ok) setTruckHours({ open: !!d.open, unconfigured: !!d.unconfigured, opensAt: d.opensAt ?? null, closesAt: d.closesAt ?? null }); })
        .catch(() => {});
    }
    if (params.get("embed") === "1") setEmbed(true);
    // ?lang= lets an embedder (e.g. the landing showcase iframe) pick the menu
    // language. Menu is zh/en only (FR omitted); anything non-zh falls to en.
    const lp = params.get("lang");
    if (lp === "zh") setLang("zh");
    else if (lp) setLang("en");
    if (params.get("staff") === "1") setStaff(true);
    // Preselect 自取/配送 when the caller already knows (design review D4): staff
    // open this from the 自取 or 外送 tab, so re-asking "怎么取餐?" costs a tap at
    // the worst moment — the customer is mid-sentence reading out dishes. The
    // choice stays visible and changeable; this only sets the starting value.
    const tp = params.get("type");
    if (tp === "delivery" || tp === "togo") setTogoType(tp);
    // Traction funnel (/admin): how did this menu view arrive? Fire-and-forget.
    track("menu_view", { tenant: slug, src: entrySrc() });
    // Separate query so a pre-migration storefront view (no delivery_fsas
    // column) errors quietly here instead of taking the whole menu down.
    supabase.from("storefront").select("delivery_fsas").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        const z = publicDeliveryFsas(data);
        if (z) setZoneFsas(z);
      });
    // Separate query (like delivery_fsas): a pre-migration storefront view with
    // no `tables` column errors quietly here instead of breaking the whole menu.
    supabase.from("storefront").select("tables").eq("slug", slug).maybeSingle()
      .then(({ data }) => { const tb = (data as { tables?: unknown } | null)?.tables; if (Array.isArray(tb)) setTables(tb as string[]); });
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
  const cartLines = Object.entries(cart).flatMap(([key, qty]) => {
    const { id, vi } = parseCartKey(key);
    const d = byId[id];
    if (!d) return [];
    const variant = vi != null ? d.variants?.[vi] ?? null : null;
    // 时价 line = market dish whose chosen price is 0 (no today-price, or a
    // priceless cooking-style variant like 生猛龙虾·清蒸). Staff prices it at
    // completion. A market dish with a today-price entered charges normally.
    const isMarket = !!d.is_market && !(unitPrice(d, vi) > 0);
    const meta = itemMeta[key];
    const base = isMarket ? 0 : unitPrice(d, vi);
    const unitAt = (u: number) => Math.max(0, Math.round((base + (meta?.units?.[u]?.adjust ?? 0)) * 100) / 100);
    const unit = unitAt(0); // representative (first portion) for the cart row
    const lineTotal = isMarket ? 0 : Array.from({ length: qty }, (_, u) => unitAt(u)).reduce((a, b) => a + b, 0);
    const customized = Array.from({ length: qty }, (_, u) => meta?.units?.[u]).some((m) => m && ((m.adjust ?? 0) !== 0 || (m.note ?? "").trim() !== ""));
    return [{ key, d, variant, isMarket, base, unit, lineTotal, qty, meta, customized }];
  });
  const hasMarketItems = cartLines.some((x) => x.isMarket);
  const count = cartLines.reduce((a, x) => a + x.qty, 0);
  const total = cartLines.reduce((a, x) => a + x.lineTotal, 0);
  // Display name with size baked in ("红烧蟹肉翅（中）") — lives in lib/menu so the
  // pickup route can rebuild the same name server-side instead of trusting ours.
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
  // A tenant with no table labels is a food truck / counter-service vendor:
  // no dine-in table field, and every order needs a phone (there's no table to
  // call out, so the number is how staff reach the customer).
  const noTables = tables.length === 0;
  // Phone required for togo/delivery, per-table (每桌一码) scans, and any
  // no-table (food-truck) vendor. Optional only for the whole-store QR of a
  // sit-down shop, and staff-placed orders.
  const phoneRequired = togoMode || noTables || (!!lockedTable && !staff);

  // Secondary (other-language) dish name — shown only when it's actually
  // different. An English-only vendor sets name_zh = name_en, so this returns
  // "" and no Chinese subtitle renders.
  const secondaryName = (d: MenuItem): string => {
    const primary = (lang === "zh" ? d.name_zh : d.name_en || d.name_zh) || "";
    const secondary = (lang === "zh" ? d.name_en || "" : d.name_zh) || "";
    return secondary.trim() && secondary.trim() !== primary.trim() ? secondary : "";
  };

  // Delivery address fields — postal FIRST with an instant in-zone check.
  // Rendered in the up-front chooser panel AND in the checkout sheet (same
  // state, so whatever the customer typed up top is already filled in).
  const renderAddress = () => (
    <div className="grid gap-2">
      <div>
        <div className="relative">
          <input
            className="input pr-9 uppercase"
            placeholder={t("postal")}
            autoComplete="postal-code"
            value={postal}
            onChange={(e) => onPostal(e.target.value)}
          />
          {zoneStatus !== "idle" && (
            <span
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${
                zoneStatus === "ok" ? "text-jade" : "text-[#C0392B]"
              }`}
            >
              {zoneStatus === "ok" ? "✓" : "✕"}
            </span>
          )}
        </div>
        {zoneStatus === "idle" && <p className="mt-1 text-[11px] text-ink-faint">{t("postalHint")}</p>}
        {zoneStatus === "ok" && (
          <p className="mt-1 text-xs font-medium text-jade">✓ {t("canDeliver")} {fsaLabel(fsa, lang2)}</p>
        )}
        {zoneStatus === "no" && (
          <p className="mt-1 text-xs font-medium text-[#C0392B]">
            ✕ {t("noDeliver")} {fsa} · {t("zoneBad")}
            <button onClick={() => setTogoType("togo")} className="ml-2 font-semibold underline underline-offset-2">
              {t("switchPickup")}
            </button>
          </p>
        )}
      </div>
      <input
        className="input"
        placeholder={t("street")}
        autoComplete="street-address"
        value={street}
        onChange={(e) => { setStreet(e.target.value); setAddrErr(null); }}
      />
      <div className="grid grid-cols-2 gap-2">
        <input className="input" placeholder={t("unit")} value={unit} onChange={(e) => setUnit(e.target.value)} />
        <div className="input flex items-center bg-slate-50 text-ink-faint">{t("city")}</div>
      </div>
    </div>
  );
  // Order-only mode charges nothing online, so no mandatory delivery tip is applied.
  const pricing = priceOrder(total, isDelivery && PAYMENTS_LIVE ? DELIVERY_TIP_RATE : 0);
  const shortfall = isDelivery ? deliveryShortfall(total) : 0;

  // upsell: when a 火锅 dish is in the cart, suggest 火锅配菜 add-ons
  const hasHotpot = cartLines.some((x) => x.d.category === "火锅");
  const hotpotSides = useMemo(() => dishes.filter((d) => d.category === "火锅配菜"), [dishes]);
  const sidesCount = cartLines.filter((x) => x.d.category === "火锅配菜").reduce((a, x) => a + x.qty, 0);
  // Ordering hotpot → picking sides IS the next step: auto-open the full 配菜 sheet
  // once when the first hotpot lands in the cart. Won't re-nag if the diner closes it.
  useEffect(() => {
    if (hasHotpot && hotpotSides.length > 0) setSidesOpen(true);
  }, [hasHotpot]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    // Required phone. +1 (default): strip formatting, drop a typed leading "1",
    // require exactly 10 digits — stored bare (legacy format). Other country
    // codes: 7-12 digits, stored as +<code><digits>.
    let phoneToSave = "";
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phoneRequired && phoneDigits.length === 0) {
      // Optional (整店一码 or staff-placed): left blank, stored as N/A.
      phoneToSave = "";
    } else if (phoneCode === "1") {
      const digits = phoneDigits.replace(/^1(\d{10})$/, "$1");
      if (digits.length !== 10) {
        setPhoneErr(true);
        return;
      }
      phoneToSave = digits;
    } else {
      if (phoneDigits.length < 7 || phoneDigits.length > 12) {
        setPhoneErr(true);
        return;
      }
      phoneToSave = `+${phoneCode}${phoneDigits}`;
    }
    setPhoneErr(false);

    // 整店一码: a customer-typed table number must be a REAL table (can't invent one).
    if (!togoMode && !lockedTable && tableNo.trim() && tables.length > 0 && !tables.includes(tableNo.trim())) {
      setTableErr(true);
      return;
    }
    setTableErr(false);

    // Delivery: validate address + downtown zone + $30 minimum before anything else.
    // (Client-side hint only — the checkout server re-validates authoritatively.)
    if (isDelivery) {
      if (!street.trim()) { setAddrErr(tri("请填写街道地址", "Please enter a street address", "Veuillez saisir une adresse")); return; }
      if (!isValidPostal(postal)) { setAddrErr(t("postalBad")); return; }
      if (!inDeliveryZone(postal, zoneFsas)) { setAddrErr(`${t("noDeliver")} ${postalFsa(postal)} · ${t("zoneBad")}`); return; }
      if (shortfall > 0) { setAddrErr(`${t("minShort")} $${shortfall.toFixed(2)}`); return; }
      setAddrErr(null);
    }

    // Order-only mode (PAYMENTS_LIVE off): takeout/delivery place WITHOUT paying —
    // staff call back to confirm. 时价 is fine here (price settled on the callback).
    // When online payment IS live, keep the pay-first + no-market-items rules.
    if (togoMode && PAYMENTS_LIVE && hasMarketItems) {
      setAddrErr(tri("时价菜品暂不支持外卖/自取在线支付，请移除后再下单", "Market-price items can't be pre-paid online — please remove them for takeout/delivery", "Les articles à prix du jour ne peuvent être payés en ligne — retirez-les pour la commande à emporter/livraison"));
      return;
    }

    setSubmitting(true);
    // Drinks (酒水饮品) and plain white rice (白饭/白米饭) aren't cooked — a round of
    // only these skips the kitchen ticket (see /api/epson). Still prints on the bill.
    // isNoCookDish lives in lib/menu so the pickup route derives it from the dish
    // too, rather than trusting a client-sent noKitchen flag.
    const items: OrderItem[] = cartLines.flatMap((x) => {
      // Chosen size index (null = single-price dish).
      const vi = parseCartKey(x.key).vi;
      // Group this dish's portions by identical (note, adjust) → one order line per group,
      // so 白饭×3 with a note on portion 2 becomes 白饭×2 + 白饭×1(备注).
      const groups = new Map<string, { note?: string; adjust: number; qty: number }>();
      for (let u = 0; u < x.qty; u++) {
        const note = (x.meta?.units?.[u]?.note ?? "").trim();
        const adjust = x.meta?.units?.[u]?.adjust ?? 0;
        const gk = `${note}|${adjust}`;
        const g = groups.get(gk) ?? { note: note || undefined, adjust, qty: 0 };
        g.qty += 1;
        groups.set(gk, g);
      }
      return [...groups.values()].map((g) => {
        // Clamp a discount to never exceed the dish price: the line price floors
        // at $0, so store the SAME clamped delta — otherwise the bill would print
        // "$0.00 · 加价 −$100.00" (line & reason disagree). Clamp at the source so
        // price and the printed annotation are consistent by construction.
        const adj = Math.round(Math.max(g.adjust, -x.base) * 100) / 100;
        return {
          id: x.d.id,
          name_zh: lineName(x.d, x.variant),
          name_en: lineName(x.d, x.variant, true),
          price: x.isMarket ? null : Math.max(0, Math.round((x.base + adj) * 100) / 100),
          qty: g.qty,
          // Which size was chosen. The name bakes the label in for humans, but the
          // pickup route needs the INDEX to re-price the line from menu_items
          // server-side (a name string can't be priced). Additive: dine-in ignores it.
          ...(vi != null ? { vi } : {}),
          ...(x.isMarket ? { market: true } : {}),
          ...(g.note ? { note: g.note } : {}),
          ...(!x.isMarket && adj !== 0 ? { adjust: adj } : {}),
          ...(isNoCookDish(x.d) ? { noKitchen: true } : {}),
        };
      });
    });
    // Campus pickup: route through the server (it mints the tracking_token +
    // pickup_code), then hand off to the anonymous /order/[id] tracking screen.
    // Order-only — no online charge; staff settle at the truck.
    if (pickupMode) {
      // Scheduled pickup: resolve the chip/time choice; a past custom time
      // (e.g. a tab left open across noon) must re-pick, not cook stale.
      const when = resolvePickupAt(pickupWhen);
      if ("invalid" in when) {
        setSubmitting(false);
        setPickupErr(tri("这个时间已经过了，请重新选择", "That time has already passed — pick a new one", "Cette heure est déjà passée, choisissez-en une autre"));
        return;
      }
      const pu = await createPickupOrder({ slug, items, phone: phoneToSave, note, pickup_at: when.iso });
      setSubmitting(false);
      if ("error" in pu) {
        // Server messages (hours gate, time window) are written for customers —
        // show them inline where the choice was made, not as a raw alert (10A).
        setPickupErr(pu.error);
        return;
      }
      track("order_placed", { tenant: slug, src: entrySrc(), meta: { type: "pickup" } }); // beacon survives the redirect
      window.location.href = `/order/${pu.id}?t=${encodeURIComponent(pu.tracking_token)}`;
      return;
    }

    const res = await createOrder(slug, {
      items,
      total,
      table_no: togoMode ? "" : tableNo,
      phone: phoneToSave,
      note,
      order_type: togoMode ? togoType : "dine_in",
      address: isDelivery ? { street: street.trim(), unit: unit.trim() || undefined, city: "Toronto, ON", postal: postal.trim().toUpperCase() } : undefined,
      customer_email: togoMode ? email : undefined,
    });
    setSubmitting(false);
    if (res.error) {
      // Inside the staff picker this runs in an IFRAME: a native alert() would
      // trap the failure behind glass the parent can't see, so the modal keeps
      // looking fine while the order never happened (design review D2). Tell the
      // parent instead and let it surface the error where staff are looking.
      if (staff && typeof window !== "undefined" && window.parent !== window) {
        window.parent.postMessage({ type: "bento-staff-order-failed", message: res.error }, window.location.origin);
      } else {
        alert("提交失败：" + res.error);
      }
      return;
    }
    track("order_placed", { tenant: slug, src: entrySrc(), meta: { type: togoMode ? togoType : "dine_in" } });

    // STAFF ORDERS NEVER PAY FIRST (design review D3). A staff member is taking
    // this order over the phone or at the counter — the person tapping is not the
    // person paying, and there's no card to present. Worse, this branch returns
    // BEFORE the postMessage below, so a staff order would leave the picker hung
    // open over a card form nobody can complete. Staff orders settle at handover,
    // exactly like dine-in.
    // Note: in a pay_first tenant such an order stays unpaid, so the DB payment
    // gate (supabase/payment-gate-order-only.sql) would hold it out of the
    // kitchen. That shop needs a staff-settle path before it turns payments on;
    // order_only tenants (富来, campus trucks) are unaffected.
    if (togoMode && PAYMENTS_LIVE && !staff && res.id) {
      // Pay-first: show the Clover card sheet. On success the server (re-prices +)
      // charges and marks the order paid, which releases it to the kitchen/printer.
      setPayingOrder({
        id: res.id,
        amount: pricing.grandTotal,
        lines: cartLines.map((x) => ({ name_zh: lineName(x.d, x.variant), name_en: lineName(x.d, x.variant, true), price: x.unit, qty: x.qty })),
      });
      return;
    }

    // Dine-in: kitchen fires immediately. No push to a printer here — the Epson
    // TM-T88VI PULLS via Server Direct Print (it polls /api/epson and picks up
    // this order on its next cycle). Nothing to do client-side.
    setPlaced(true);
    // Opened from the floor plan (?staff=1): tell the parent so the modal can
    // auto-close and refresh the table's tab.
    if (staff && typeof window !== "undefined" && window.parent !== window) {
      // Carry the order type so the parent can switch to the tab the order
      // actually landed in — a delivery order placed from the 自取 tab would
      // otherwise disappear from view and read as a failure.
      window.parent.postMessage(
        { type: "bento-staff-order-placed", orderType: togoMode ? togoType : "dine_in" },
        window.location.origin, // same-origin embed; don't broadcast to "*"
      );
    }
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
    // 同价多选（菠菜/唐生菜 二选一）：显示原价+「选择」；不同价（例/小/中/大）：起+「选规格」
    const choice = isChoiceDish(d);
    const qty = hasVariants ? dishQty(d.id) : cart[d.id] ?? 0;
    const dp = displayPrice(d);
    // 时价 dish: with today's price entered → show it (gold); without → show
    // the 时价 tag only, still orderable, staff prices it at completion.
    // Market dishes can also carry cooking-style/brand CHOICES (生猛龙虾:
    // 清蒸/姜葱/豉椒) — still 时价, diner picks a style, priced at completion.
    const isMarket = !!d.is_market;
    const marketPriced = isMarket && !hasVariants && Number(d.price) > 0;
    // NOT market, no variants, no price = owner hasn't priced it yet — don't
    // let it into the cart at $0 (there's no completion gate for these).
    const unpriced = !hasVariants && !d.is_market && !(Number(d.price) > 0);
    const sold = !!d.sold_out; // 沽清：灰显、不可下单
    return (
      <div key={d.id} className={`flex items-center gap-3 ${sold ? "opacity-45" : ""}`}>
        {d.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image_url} alt={d.name_zh} className={`h-14 w-14 flex-none rounded-lg object-cover ${sold ? "grayscale" : ""}`} />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold leading-snug text-ink">
            {lang === "zh" ? d.name_zh : d.name_en || d.name_zh}
            {hasVariants && (
              <span className="ml-1.5 rounded border border-jade px-1 align-middle text-[9px] font-bold text-jade">
                {choice
                  ? tri(`${d.variants.length} 选 1`, "pick 1", "choisir 1")
                  : `${d.variants.length} ${lang === "zh" ? "规格" : lang === "fr" ? (d.variants.length > 1 ? "tailles" : "taille") : d.variants.length > 1 ? "sizes" : "size"}`}
              </span>
            )}
            {d.is_market && (
              <span className="ml-1.5 rounded border border-gold px-1 align-middle text-[9px] font-bold text-gold">
                {t("market")}
              </span>
            )}
          </div>
          {secondaryName(d) && <div className="text-xs text-ink-faint">{secondaryName(d)}</div>}
          <div className={`mt-1 text-sm font-bold ${isMarket ? "text-gold" : "text-jade"}`}>
            {isMarket ? (
              marketPriced ? fmtPrice(d.price) /* today's market price, in gold */ : t("market")
            ) : (
              <>
                {hasVariants && !choice && dp != null && <span className="mr-1 text-xs font-medium text-ink-faint">{tri("起", "from", "dès")}</span>}
                {fmtPrice(dp) || t("market")}
              </>
            )}
          </div>
        </div>
        {sold ? (
          <span className="flex-none rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-ink-faint">
            {tri("沽清", "Sold out", "Épuisé")}
          </span>
        ) : hasVariants ? (
          <button
            onClick={() => setSheetDish(d)}
            className="relative flex flex-none items-center gap-1 rounded-full border-[1.5px] border-jade bg-white px-3 py-1.5 text-sm font-medium text-jade"
          >
            {choice ? tri("选择", "Choose", "Choisir") : tri("选规格", "Size", "Taille")} ›
            {qty > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-jade px-1 text-[10px] font-bold text-white">{qty}</span>}
          </button>
        ) : unpriced ? (
          <span className="flex-none rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-ink-faint" title={tri("未定价", "Not priced", "Non tarifé")}>
            {tri("请询问", "Ask staff", "Demander")}
          </span>
        ) : (
          <div className="flex flex-none items-center gap-2">
            {/* staff-only: per-item 备注 + 加价/减价 for this dish (opens the editor sheet) */}
            {staff && (
              <button
                onClick={() => {
                  const n = Math.max(1, cart[d.id] ?? 0);
                  const u = itemMeta[d.id]?.units ?? [];
                  setEditUnits(Array.from({ length: n }, (_, i) => ({ note: u[i]?.note ?? "", adjust: u[i]?.adjust != null ? String(u[i]!.adjust) : "" })));
                  setStaffEditKey(d.id);
                }}
                title={tri("备注 / 改价", "Note / price", "Note / prix")}
                className={`grid h-7 w-7 flex-none place-items-center rounded-full border text-sm ${(itemMeta[d.id]?.units ?? []).some((m) => (m?.adjust ?? 0) !== 0 || (m?.note ?? "").trim() !== "") ? "border-gold text-gold" : "border-slate-300 text-ink-soft"}`}
              >
                ✎
              </button>
            )}
            {qty === 0 ? (
              <button onClick={() => inc(d.id, 1)} className="rounded-full bg-jade px-3 py-1.5 text-sm font-medium text-white">＋</button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => inc(d.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-ink">－</button>
                <span className="w-5 text-center font-semibold text-ink">{qty}</span>
                <button onClick={() => inc(d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Desktop/iPad persistent order panel (right column). Reuses the same cartLines +
  // inc handlers as the phone cart sheet; the primary button opens the cart sheet
  // (a centered dialog on desktop) for phone/note + final submit — no logic fork.
  const renderOrderPanel = () => {
    const headTable = lockedTable ? tri(`本单 · ${displayTable(lockedTable)} 号桌`, `Order · Table ${displayTable(lockedTable)}`, `Commande · Table ${displayTable(lockedTable)}`) : tri("本单", "Your order", "Votre commande");
    return (
      <>
        <div className="flex-none border-b border-slate-100 px-4 py-3 text-sm font-bold text-ink">{headTable}</div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {placedLines.length > 0 && (
            <div className="mb-3 rounded-xl border border-jade/20 bg-jade-wash/50 p-3">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-jade">
                <span>✓ {t("prevOrdered")}</span><span className="tabular-nums">${placedTotal.toFixed(2)}</span>
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
            <p className="py-10 text-center text-sm text-ink-faint">{t("empty")}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {cartLines.map((x) => (
                <div key={x.key} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{lineName(x.d, x.variant, lang !== "zh")}</div>
                    <div className={`text-xs ${x.isMarket ? "font-semibold text-gold" : "text-ink-faint"}`}>
                      {x.isMarket ? t("market") : x.customized ? `${fmtPrice(x.lineTotal)}${x.qty > 1 ? ` · ${x.qty} ${t("items")}` : ""}` : fmtPrice(x.unit) || t("market")}
                      {x.customized && <span className="ml-1 text-gold">✎</span>}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <button onClick={() => inc(x.key, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300">－</button>
                    <span className="w-5 text-center font-semibold">{x.qty}</span>
                    <button onClick={() => inc(x.key, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-none border-t border-slate-100 p-4">
          <div className="mb-2 flex items-center justify-between text-base font-bold text-ink">
            <span>{placedTotal > 0 ? t("grand") : t("total")}</span>
            <span className="tabular-nums">${(placedTotal > 0 ? grandTotal : total).toFixed(2)}{hasMarketItems && <span className="ml-1 text-xs font-semibold text-gold">+ {t("market")}</span>}</span>
          </div>
          <button
            onClick={() => setOpen(true)}
            disabled={count === 0}
            className="w-full rounded-full bg-jade py-3 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-40"
          >
            {count > 0 ? (togoMode ? (PAYMENTS_LIVE ? t("goPay") : t("sendOrder")) : t("submit")) : t("empty")}
          </button>
        </div>
      </>
    );
  };

  return (
    <main
      data-view={viewOverride ?? undefined}
      className={`min-h-screen bg-paper ${count > 0 || placedTotal > 0 ? "pb-32 md:pb-6" : "pb-20 md:pb-6"}`}
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
        <div className="mv-shell mx-auto flex w-full max-w-[440px] items-center gap-3 px-5 py-4 md:max-w-[1440px]">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-bold tracking-wide text-ink" style={{ fontFamily: '"Noto Serif SC", serif' }}>
              {embed ? (lang === "zh" ? "今日菜单" : "Menu") : name ? name.zh : "…"}
            </div>
            {!embed && name?.en && name.en !== name.zh && (
              <div className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">{name.en}</div>
            )}
          </div>
          {/* phone ⇄ desktop layout toggle — auto-detects by screen, manual choice sticks */}
          <div className="flex flex-none items-center rounded-full border border-slate-200 p-0.5" role="group" aria-label={tri("视图", "Layout", "Vue")}>
            <button
              onClick={() => setView("phone")}
              aria-pressed={effectiveView === "phone"}
              title={tri("手机版", "Phone view", "Vue mobile")}
              className={`grid h-7 w-8 place-items-center rounded-full text-sm transition ${effectiveView === "phone" ? "bg-jade text-white" : "text-ink-faint hover:bg-slate-50"}`}
            >📱</button>
            <button
              onClick={() => setView("desktop")}
              aria-pressed={effectiveView === "desktop"}
              title={tri("桌面版", "Desktop view", "Vue bureau")}
              className={`grid h-7 w-8 place-items-center rounded-full text-sm transition ${effectiveView === "desktop" ? "bg-jade text-white" : "text-ink-faint hover:bg-slate-50"}`}
            >🖥️</button>
          </div>
          <button
            // FR omitted from the diner menu for now (menu content is zh/en only;
            // French fell back to English anyway). Landing keeps EN/FR/中.
            onClick={() => setLang((l) => (l === "zh" ? "en" : "zh"))}
            className="flex-none rounded-full border border-slate-200 px-3 py-1 text-xs text-ink-soft"
          >
            {lang === "zh" ? "EN" : "中"}
          </button>
        </div>
      </header>

      {lockedTable && !togoMode && (
        <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
          🪑 {tri(`您正在为 ${displayTable(lockedTable)} 号桌点餐`, `Ordering for Table ${displayTable(lockedTable)}`, `Commande pour la table ${displayTable(lockedTable)}`)}
        </div>
      )}
      {togoMode && !pickupMode && (
        <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
          🛵 {t("togoBadge")} · {PAYMENTS_LIVE ? t("payFirst") : t("callbackHint")}
        </div>
      )}
      {pickupMode && (
        truckHours && !truckHours.open && !truckHours.unconfigured ? (
          <div className="bg-[#FBF1DE] py-2 text-center text-sm font-medium text-[#8a5a10]">
            ⏸ {truckHours.opensAt
              ? tri(`现在打烊 · ${truckHours.opensAt} 开门`, `Closed right now · opens at ${truckHours.opensAt}`, `Fermé · ouvre à ${truckHours.opensAt}`)
              : tri("今天已打烊，明天见", "Closed for today — see you tomorrow", "Fermé pour aujourd'hui")}
          </div>
        ) : (
          <div className="bg-jade-wash py-2 text-center text-sm font-medium text-jade">
            🚚 {tri("到餐车取餐 · 做好后通知你来取", "Pickup at the truck · we'll ping you when it's ready", "Ramassage au camion · on vous avertit quand c'est prêt")}
            {truckHours?.closesAt ? ` · ${tri(`营业到 ${truckHours.closesAt}`, `open until ${truckHours.closesAt}`, `ouvert jusqu'à ${truckHours.closesAt}`)}` : ""}
          </div>
        )
      )}

      <div className="mv-shell mx-auto w-full max-w-[440px] px-5 py-6 md:max-w-[1440px]">
        {loaded && dishes.length === 0 && (
          <p className="py-20 text-center text-sm text-ink-faint">{tri("菜单还没准备好。", "The menu isn't ready yet.", "Le menu n'est pas encore prêt.")}</p>
        )}

        {/* togo: pickup-vs-delivery chooser + up-front address (postal-first).
            Pickup mode is always pickup — no chooser. */}
        {togoMode && !pickupMode && dishes.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-ink">{t("chooseMode")}</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTogoType("togo")}
                className={`rounded-xl border-2 px-3 py-3 text-left transition ${
                  !isDelivery ? "border-jade bg-jade-wash" : "border-slate-200 bg-white"
                }`}
              >
                <div className={`text-[15px] font-semibold ${!isDelivery ? "text-jade" : "text-ink"}`}>🛍️ {t("pickup")}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{t("pickupHint")}</div>
              </button>
              <button
                onClick={() => setTogoType("delivery")}
                className={`rounded-xl border-2 px-3 py-3 text-left transition ${
                  isDelivery ? "border-jade bg-jade-wash" : "border-slate-200 bg-white"
                }`}
              >
                <div className={`text-[15px] font-semibold ${isDelivery ? "text-jade" : "text-ink"}`}>🛵 {t("delivery")}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-faint">{t("deliveryHint")}</div>
              </button>
            </div>

            {isDelivery && (
              <div className="mt-3 rounded-xl border border-[#ECE7DF] bg-white p-4">
                <div className="mb-2 text-[13px] font-semibold text-ink">{t("addrTitle")}</div>
                {renderAddress()}
                <button
                  onClick={() => setZoneOpen((o) => !o)}
                  className="mt-3 text-xs font-medium text-jade underline-offset-2 hover:underline"
                >
                  {t("zoneList")} {zoneOpen ? "▴" : "▾"}
                </button>
                {zoneOpen && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...zoneFsas].sort().map((f) => (
                      <span key={f} className="rounded-full bg-jade-wash px-2.5 py-1 text-[11px] font-medium text-jade">
                        {f}
                        {FSA_NAMES[f] && <span className="ml-1 text-jade/70">{FSA_NAMES[f][lang2]}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
              <div className="mv-grid grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">{results.map(renderDish)}</div>
            )}
          </section>
        ) : (
        <>
        <div className="flex gap-3">
          {/* left category rail — all categories visible, tap to jump (美团 / 大众点评 style) */}
          {cats.length > 1 && (
            <nav
              ref={railRef}
              className="mv-rail sticky top-[68px] z-[5] max-h-[calc(100vh-88px)] w-[88px] flex-none self-start overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:w-44"
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
                    {catLabel(g.category, lang2)}
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
                  {catLabel(g.category, lang2)}<span className="text-xs font-normal text-ink-faint">{g.items.length}</span>
                </h2>
                <div className="mv-grid grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">{g.items.map(renderDish)}</div>
              </section>
            ))}
          </div>

          {/* desktop/iPad: persistent order panel — live order while browsing.
              Always in DOM; CSS `md:` (+ [data-view] override) controls visibility. */}
          <aside className="mv-desktop sticky top-[68px] hidden max-h-[calc(100vh-88px)] w-80 flex-none flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white md:flex">
            {renderOrderPanel()}
          </aside>
        </div>
        </>
        )}
      </div>

      {/* slim bottom checkout bar — one row, no dish list (美团 pattern) */}
      {(count > 0 || placedTotal > 0) && !open && !sheetDish && (
        <div className="mv-phone fixed inset-x-0 bottom-0 z-20 px-3 pb-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="mx-auto flex w-full max-w-[440px] items-center justify-between rounded-full bg-jade py-3 pl-5 pr-2 text-white shadow-[0_6px_24px_rgba(17,122,101,0.35)] transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold">
              {/* white stroke cart (emoji renders murky on the jade bg) */}
              <span className="relative leading-none">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="20" r="1.6" fill="white" stroke="none" />
                  <circle cx="17.5" cy="20" r="1.6" fill="white" stroke="none" />
                  <path d="M2.5 3.5h2.5l2.5 12h10.6l2.4-8.5H6" />
                </svg>
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-jade shadow">
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
              {count > 0 ? (togoMode ? (PAYMENTS_LIVE ? t("goPay") : t("sendOrder")) : t("submit")) : t("cart")} →
            </span>
          </button>
        </div>
      )}

      {/* 多规格 size selector — tap 选规格 opens this */}
      {sidesOpen && hotpotSides.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 md:items-center" onClick={() => setSidesOpen(false)}>
          <div className="mx-auto flex max-h-[82vh] w-full max-w-[440px] flex-col rounded-t-2xl md:rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            {/* sticky header — the top-right action is ALWAYS visible (no scroll to skip/finish) */}
            <div className="flex flex-none items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-lg font-bold text-ink">🍲 {tri("火锅配菜", "Hot-pot sides", "Accompagnements fondue")}</div>
                <div className="mt-0.5 text-xs text-ink-faint">{tri("加点更丰富 · 可跳过", "Optional add-ons", "Extras (optionnel)")}</div>
              </div>
              <button
                onClick={() => setSidesOpen(false)}
                className={`flex-none rounded-full px-4 py-2 text-sm font-semibold transition ${sidesCount > 0 ? "bg-jade text-white hover:opacity-90" : "border border-slate-300 text-ink-soft hover:bg-slate-50"}`}
              >
                {sidesCount > 0 ? `${tri("完成", "Done", "Terminé")} · ${sidesCount} ${t("items")}` : tri("跳过", "Skip", "Passer")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2">
              {hotpotSides.map((d) => {
                const hasV = (d.variants?.length ?? 0) > 0;
                const q = hasV ? dishQty(d.id) : cart[d.id] ?? 0;
                const market = !!d.is_market && !hasV && !(Number(d.price) > 0);
                return (
                  <div key={d.id} className={`flex flex-col justify-between rounded-xl border p-3 ${q > 0 ? "border-jade bg-jade-wash" : "border-slate-200 bg-white"}`}>
                    <div>
                      <div className="text-[15px] font-semibold leading-snug text-ink">{lang === "zh" ? d.name_zh : d.name_en || d.name_zh}</div>
                      {secondaryName(d) && <div className="truncate text-xs text-ink-faint">{secondaryName(d)}</div>}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className={`text-sm font-bold ${market ? "text-gold" : "text-jade"}`}>{hasV ? fmtPrice(displayPrice(d)) : market ? t("market") : fmtPrice(d.price)}</span>
                      {hasV ? (
                        <button onClick={() => setSheetDish(d)} className="relative flex-none rounded-full border-[1.5px] border-jade bg-white px-2.5 py-1 text-xs font-medium text-jade">
                          {tri("规格", "Size", "Taille")} ›
                          {q > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-jade px-0.5 text-[10px] font-bold text-white">{q}</span>}
                        </button>
                      ) : q === 0 ? (
                        <button onClick={() => inc(d.id, 1)} className="grid h-8 w-8 flex-none place-items-center rounded-full bg-jade text-lg font-bold text-white">＋</button>
                      ) : (
                        <div className="flex flex-none items-center gap-1">
                          <button onClick={() => inc(d.id, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-ink">－</button>
                          <span className="w-4 text-center text-sm font-semibold text-ink">{q}</span>
                          <button onClick={() => inc(d.id, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* staff per-PORTION 备注 + 加价/减价 editor — a note can apply to just one of several portions */}
      {staffEditKey && (() => {
        const { id, vi } = parseCartKey(staffEditKey);
        const d = byId[id];
        if (!d) return null;
        const base = d.is_market && !(unitPrice(d, vi) > 0) ? 0 : unitPrice(d, vi);
        // Bare number defaults to + (add). "-5" subtracts. Kept as the signed delta so
        // the live preview + printed bill can show "+$5.00" / "−$5.00" explicitly.
        const deltaOf = (s: string) => (s.trim() === "" ? 0 : parseFloat(s) || 0);
        const priceOf = (s: string) => Math.max(0, Math.round((base + deltaOf(s)) * 100) / 100);
        const signed = (n: number) => (n >= 0 ? "+" : "−") + fmtPrice(Math.abs(n));
        const setUnit = (i: number, patch: Partial<{ note: string; adjust: string }>) => setEditUnits((us) => us.map((u, k) => (k === i ? { ...u, ...patch } : u)));
        const setN = (n: number) => setEditUnits((us) => Array.from({ length: Math.max(1, Math.min(20, n)) }, (_, i) => us[i] ?? { note: "", adjust: "" }));
        const n = editUnits.length;
        return (
          <div className="fixed inset-0 z-40 flex items-end bg-black/40 md:items-center" onClick={() => setStaffEditKey(null)}>
            <div className="mx-auto flex max-h-[84vh] w-full max-w-[440px] flex-col rounded-t-2xl md:rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
              {/* sticky header: dish name + 份数 stepper */}
              <div className="flex flex-none items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0 truncate text-lg font-bold text-ink">{lang === "zh" ? d.name_zh : d.name_en || d.name_zh}</div>
                <div className="flex flex-none items-center gap-2">
                  <span className="text-xs text-ink-faint">{tri("份数", "Qty", "Qté")}</span>
                  <button onClick={() => setN(n - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-ink">－</button>
                  <span className="w-5 text-center text-base font-bold text-ink">{n}</span>
                  <button onClick={() => setN(n + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-300 text-ink">＋</button>
                </div>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
                {n > 1 && (
                  <button onClick={() => setEditUnits((us) => us.map(() => ({ note: us[0]?.note ?? "", adjust: us[0]?.adjust ?? "" })))}
                    className="w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-ink-soft transition hover:bg-slate-50">
                    {tri("把第 1 份应用到全部", "Apply portion 1 to all", "Appliquer la 1re à toutes")}
                  </button>
                )}
                {editUnits.map((u, i) => {
                  const hasNote = u.note.trim() !== "";
                  const hasAdj = u.adjust.trim() !== "" && (parseFloat(u.adjust) || 0) !== 0;
                  const tag = hasNote && hasAdj ? tri("已备注 · 改价", "Note · price", "Note · prix") : hasNote ? tri("已备注", "Note", "Note") : hasAdj ? tri("改价", "Price", "Prix") : "";
                  return (
                  <div key={i} className={`rounded-xl border p-3 ${tag ? "border-gold/50 bg-gold/[0.06]" : "border-slate-100"}`}>
                    {(n > 1 || tag) && (
                      <div className="mb-1.5 flex items-center justify-between">
                        {n > 1 && <span className="text-xs font-semibold text-ink-soft">{lang === "zh" ? `第 ${i + 1} 份` : `Portion ${i + 1}`}</span>}
                        {tag && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">{tag}</span>}
                      </div>
                    )}
                    <input value={u.note} onChange={(e) => setUnit(i, { note: e.target.value })} placeholder={tri("备注 例：加一条鱼", "Note, e.g. add a fish", "Note ex. ajouter un poisson")} className="input mb-2 w-full text-sm" />
                    <div className="flex items-center gap-2">
                      <span className="flex-none text-xs text-ink-faint">{tri("加/减价 $", "Adjust $", "Ajust. $")}</span>
                      <input type="number" inputMode="decimal" value={u.adjust} onChange={(e) => setUnit(i, { adjust: e.target.value })} placeholder="+15 / -5" className="input min-h-9 flex-1 text-sm" />
                      <span className="flex-none text-right text-sm font-bold text-jade">
                        {deltaOf(u.adjust) !== 0 && <span className="mr-1 text-xs font-semibold text-gold">{signed(deltaOf(u.adjust))}</span>}
                        {fmtPrice(priceOf(u.adjust))}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="flex-none border-t border-slate-100 p-4">
                <button
                  onClick={() => {
                    const units = editUnits.map((u) => {
                      const a = u.adjust.trim() === "" ? 0 : parseFloat(u.adjust) || 0;
                      return { note: u.note.trim() || undefined, adjust: a || undefined };
                    });
                    setItemMeta((mm) => ({ ...mm, [staffEditKey]: { units } }));
                    setCart((c) => ({ ...c, [staffEditKey]: n }));
                    setStaffEditKey(null);
                  }}
                  className="w-full rounded-lg bg-jade py-3 font-medium text-white"
                >
                  {tri("完成", "Done", "Terminé")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {sheetDish && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 md:items-center" onClick={() => setSheetDish(null)}>
          <div className="mx-auto max-h-[78vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* language-aware: EN mode leads with the English name */}
                <div className="text-lg font-bold text-ink" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
                  {lang === "zh" ? sheetDish.name_zh : sheetDish.name_en || sheetDish.name_zh}
                </div>
                <div className="text-xs text-ink-faint">{lang === "zh" ? sheetDish.name_en : sheetDish.name_zh}</div>
              </div>
              <button onClick={() => setSheetDish(null)} className="flex-none text-ink-faint">✕</button>
            </div>
            <div className="mb-1 text-xs text-ink-soft">
              {isChoiceDish(sheetDish)
                ? tri("请选择", "Choose one", "Choisir un")
                : tri("选择大小", "Choose a size", "Choisir une taille")}
            </div>
            <div className="divide-y divide-slate-100">
              {sheetDish.variants.map((v, vi) => {
                const key = cartKey(sheetDish.id, vi);
                const q = cart[key] ?? 0;
                return (
                  <div key={vi} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-ink" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
                        {lang === "zh" ? (
                          <>{v.label_zh}{v.label_en && <span className="ml-1.5 text-xs font-normal text-ink-faint">{v.label_en}</span>}</>
                        ) : (
                          <>{v.label_en || v.label_zh}<span className="ml-1.5 text-xs font-normal text-ink-faint">{v.label_zh}</span></>
                        )}
                      </div>
                    </div>
                    <span className={`font-bold tabular-nums ${sheetDish.is_market ? "text-gold" : "text-jade"}`}>{sheetDish.is_market ? t("market") : fmtPrice(v.price)}</span>
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
              {tri("完成", "Done", "Terminé")}{count > 0 ? ` · ${count} ${t("items")}` : ""}
            </button>
          </div>
        </div>
      )}

      {/* cart sheet */}
      {open && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/40 md:items-center" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
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
                        <div className={`text-xs ${x.isMarket ? "font-semibold text-gold" : "text-ink-faint"}`}>
                          {x.isMarket ? t("market") : x.customized ? `${fmtPrice(x.lineTotal)}${x.qty > 1 ? ` · ${x.qty} ${t("items")}` : ""}` : fmtPrice(x.unit) || t("market")}
                          {x.customized && <span className="ml-1 text-gold">✎</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => inc(x.key, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-slate-300">－</button>
                        <span className="w-5 text-center font-semibold">{x.qty}</span>
                        <button onClick={() => inc(x.key, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-jade text-white">＋</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* hot-pot add-on: opens the full 配菜 sheet (auto-opens on first hotpot) */}
                {hasHotpot && hotpotSides.length > 0 && (
                  <button
                    onClick={() => setSidesOpen(true)}
                    className="mt-4 flex w-full items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium text-amber-800">🍲 {tri("加火锅配菜", "Add hot-pot sides", "Ajouter des accompagnements")}</span>
                    <span className="text-sm font-semibold text-amber-700">
                      {sidesCount > 0 ? `${sidesCount} ${tri("份 ›", "· edit ›", "· modifier ›")}` : tri("查看全部 ›", "See all ›", "Voir tout ›")}
                    </span>
                  </button>
                )}

                {/* togo: pickup/delivery toggle + delivery address.
                    Pickup mode is pickup-only (no toggle), keeps the email field. */}
                {togoMode && (
                  <div className="mt-4 grid gap-2">
                    {!pickupMode && (
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
                    )}
                    {isDelivery && (
                      <>
                        {renderAddress()}
                        {addrErr && <p className="text-xs text-red-600">{addrErr}</p>}
                      </>
                    )}
                    {/* Scheduled pickup: order from class now, pick up after it ends.
                        ASAP keeps the original flow (staff set the ETA on accept). */}
                    {pickupMode && (
                      <div>
                        <div className="mb-1.5 text-sm font-medium text-ink">
                          🕐 {tri("什么时候来取？", "When will you pick it up?", "Quand viendrez-vous ?")}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {([["asap", tri("尽快", "ASAP", "Au plus vite")], [15, "+15 min"], [30, "+30 min"], [45, "+45 min"]] as const).map(([v, label]) => (
                            <button
                              key={String(v)}
                              type="button"
                              onClick={() => { setPickupWhen(v); setPickupErr(""); }}
                              className={`min-h-11 rounded-full px-3.5 text-sm font-medium transition ${pickupWhen === v ? "bg-jade text-white" : "border border-slate-200 bg-white text-ink-soft"}`}
                            >
                              {label}
                            </button>
                          ))}
                          {/* Visibly labeled custom time (10A) — never a bare blank pill.
                              min/max bound it to now→closing so errors surface on pick. */}
                          <label className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm ${typeof pickupWhen === "string" && pickupWhen !== "asap" ? "border-jade bg-jade-wash font-semibold text-jade" : "border-slate-200 bg-white text-ink-soft"}`}>
                            {tri("指定时间", "Specific time", "Heure précise")}
                            <input
                              type="time"
                              min={new Date().toTimeString().slice(0, 5)}
                              max={truckHours?.closesAt ?? undefined}
                              value={typeof pickupWhen === "string" && pickupWhen !== "asap" ? pickupWhen : ""}
                              onChange={(e) => { if (e.target.value) { setPickupWhen(e.target.value); setPickupErr(""); } }}
                              className="bg-transparent outline-none"
                            />
                          </label>
                        </div>
                        {typeof pickupWhen === "number" && (
                          <p className="mt-1 text-xs text-ink-faint">
                            ≈ {fmtClock(new Date(Date.now() + pickupWhen * 60_000).toISOString())}
                          </p>
                        )}
                        {pickupErr && <p className="mt-1 text-xs text-red-600">{pickupErr}</p>}
                      </div>
                    )}
                    <input className="input" type="email" inputMode="email" placeholder={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                )}

                <div className={`grid gap-2 ${togoMode ? "mt-2" : "mt-4"}`}>
                  {!togoMode && !noTables && (lockedTable ? (
                    <div className="rounded-lg border border-jade/30 bg-jade-wash px-3 py-2 text-sm font-medium text-jade">
                      🪑 {tri(`${displayTable(lockedTable)} 号桌`, `Table ${displayTable(lockedTable)}`, `Table ${displayTable(lockedTable)}`)}
                    </div>
                  ) : (
                    <div>
                      <input
                        className={`input w-full ${tableErr ? "border-red-400 ring-2 ring-red-200" : ""}`}
                        placeholder={t("table")}
                        value={tableNo}
                        list="bento-tables"
                        autoComplete="off"
                        onChange={(e) => { setTableNo(e.target.value); if (tableErr) setTableErr(false); }}
                      />
                      <datalist id="bento-tables">{tables.map((n) => <option key={n} value={n} />)}</datalist>
                      {tableErr && <p className="mt-1 text-xs text-[#C0392B]">{tri("请选择列表中已有的桌号", "Pick a table from the list", "Choisissez une table dans la liste")}</p>}
                    </div>
                  ))}
                  <div>
                    <div className="flex gap-2">
                      <select
                        className="input !w-28 flex-none"
                        value={phoneCode}
                        onChange={(e) => { setPhoneCode(e.target.value); if (phoneErr) setPhoneErr(false); }}
                        aria-label={tri("区号", "Country code", "Indicatif")}
                      >
                        <option value="1">🇨🇦 +1</option>
                        <option value="86">🇨🇳 +86</option>
                        <option value="852">🇭🇰 +852</option>
                        <option value="886">🇹🇼 +886</option>
                      </select>
                      <input
                        className={`input min-w-0 flex-1 ${phoneErr ? "border-red-400 ring-2 ring-red-200" : ""}`}
                        type="tel"
                        inputMode="tel"
                        placeholder={phoneRequired ? t("phone") : tri("电话号码（可选）", "Phone (optional)", "Téléphone (facultatif)")}
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); if (phoneErr) setPhoneErr(false); }}
                      />
                    </div>
                    {phoneErr && (
                      <p className="mt-1 text-xs text-red-600">
                        {phoneCode === "1" ? t("phoneErr") : tri("请填写有效电话号码", "Please enter a valid phone number", "Entrez un numéro de téléphone valide")}
                      </p>
                    )}
                  </div>
                  <input className="input" placeholder={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>

                <div className="mt-4">
                  {togoMode && !pickupMode ? (
                    /* takeout/delivery: full price breakdown — HST + mandatory delivery tip */
                    <div className="mb-3 space-y-1 text-sm tabular-nums">
                      <div className="flex justify-between text-ink-soft"><span>{t("subtotal")}</span><span>${pricing.subtotal.toFixed(2)}</span></div>
                      <div className="flex justify-between text-ink-soft"><span>{t("hst")}</span><span>${(pricing.gst + pricing.pst).toFixed(2)}</span></div>
                      {isDelivery && PAYMENTS_LIVE && (
                        <div className="flex justify-between text-ink-soft"><span>{t("tipLine")}</span><span>${pricing.tip.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-ink"><span>{t("total")}</span><span>${pricing.grandTotal.toFixed(2)}</span></div>
                      {!PAYMENTS_LIVE && (
                        <p className="text-right text-[11px] text-ink-faint">{t("estNote")}</p>
                      )}
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
                    <div className="mb-3">
                      <div className="flex justify-between text-base font-bold text-ink">
                        <span>{t("total")}</span>
                        <span className="tabular-nums">${total.toFixed(2)}{hasMarketItems && <span className="ml-1 text-xs font-semibold text-gold">+ {t("market")}</span>}</span>
                      </div>
                      {hasMarketItems && (
                        <p className="mt-1 text-right text-[11px] text-ink-faint">
                          {tri("时价菜品按当日报价，结账时确认", "Market-price items charged at today's rate, confirmed at checkout", "Les articles à prix du jour sont facturés au tarif du jour, confirmé à la commande")}
                        </p>
                      )}
                    </div>
                  )}
                  {/* callbackHint copy is fulai-specific (togo/delivery callback flow);
                      pickup gets its own truck-appropriate line instead */}
                  {togoMode && !pickupMode && !PAYMENTS_LIVE && (
                    <p className="mb-2 rounded-lg bg-jade-wash px-3 py-2 text-center text-xs font-medium text-jade">📞 {t("callbackHint")}</p>
                  )}
                  {pickupMode && (
                    <p className="mb-2 rounded-lg bg-jade-wash px-3 py-2 text-center text-xs font-medium text-jade">
                      💵 {tri("到餐车出示取餐号，取餐时付款", "Show your code at the truck · pay when you pick up", "Montrez votre code au camion · payez au retrait")}
                    </p>
                  )}
                  {togoMode && !isDelivery && addrErr && (
                    <p className="mb-2 text-center text-xs text-red-600">{addrErr}</p>
                  )}
                  <button
                    onClick={submit}
                    disabled={submitting || (togoMode && isDelivery && shortfall > 0) || (pickupMode && !!truckHours && !truckHours.open && !truckHours.unconfigured)}
                    className="w-full rounded-lg bg-jade py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting
                      ? t("submitting")
                      : togoMode
                        ? PAYMENTS_LIVE
                          ? `${t("goPay")} · $${pricing.grandTotal.toFixed(2)}`
                          : t("sendOrder")
                        : t("submit")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* pay-first: checkout method sheet for togo/delivery */}
      {payingOrder && (
        <CheckoutSheet
          orderId={payingOrder.id}
          amount={payingOrder.amount}
          lang={lang2}
          onClose={() => setPayingOrder(null)}
          onPaid={() => {
            const po = payingOrder;
            setPayingOrder(null);
            setPlaced(true);
            if (po) setPlacedOrders((p) => [...p, { lines: po.lines, total: po.amount }]);
            setCart({});
            setTableNo(lockedTable ?? "");
            setPhone("");
            setNote("");
          }}
        />
      )}

      {/* placed confirmation */}
      {placed && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 px-6" onClick={() => { setPlaced(false); setOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl">✅</div>
            <p className="mt-3 font-medium text-ink">{togoMode && !PAYMENTS_LIVE ? t("sentCallback") : t("placed")}</p>
            <button onClick={() => { setPlaced(false); setOpen(false); }} className="inline-flex items-center justify-center rounded-lg bg-jade font-medium text-white transition hover:opacity-90 mt-5 px-6 py-2.5">{t("another")}</button>
          </div>
        </div>
      )}

      {/* discreet but findable: links to the BentoOS landing page + privacy */}
      <footer className="flex flex-col items-center gap-1.5 pb-8 text-center">
        <a
          href="/"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] text-ink-faint transition hover:bg-white hover:text-jade"
          title={tri("BentoOS — 小商家的轻量后台", "BentoOS — lightweight back-office for small merchants", "BentoOS — arrière-guichet léger pour petits commerçants")}
        >
          <BentoMark className="h-3.5 w-3.5" /> Powered by <span className="font-semibold underline decoration-dotted underline-offset-2">BentoOS</span>
        </a>
        <a href="/privacy" className="text-[11px] text-ink-faint underline decoration-dotted underline-offset-2 transition hover:text-jade">
          {tri("隐私", "Privacy", "Confidentialité")}
        </a>
      </footer>
    </main>
  );
}
