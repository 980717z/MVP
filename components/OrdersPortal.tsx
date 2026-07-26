"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listOrders, setOrderStatus, claimOrderDone, acceptPickup, markPickupReady, claimPickedUp, cancelOrderItem, deleteOrder, reprintOrder, reprintActiveOrders, requestBill, updateOrderItems, type Order, type OrderItem } from "@/lib/orders";
import { postOrderSales, recordOrderSale, syncMemberFromOrder, getTenant, setTrackPayments as saveTrackPayments, type Tenant } from "@/lib/store";
import { type OrderMode } from "@/lib/orderModes";
import TableFloor from "@/components/TableFloor";
import MarketPricePanel from "@/components/MarketPricePanel";
import StaffOrderPicker from "@/components/StaffOrderPicker";
import { supabase } from "@/lib/supabase";
import { currentPushState, enablePush, disablePush, type PushState } from "@/lib/push";
import { listMenuItems } from "@/lib/menu";
import { price as fmtPrice, displayTable } from "@/lib/format";
import KitchenTicket from "@/components/KitchenTicket";
import { useLang, type Dict } from "@/app/i18n";

// Trilingual UI chrome (EN default, + 中 / FR). Merchant DATA (dish names, store
// name, table numbers) is never translated — only labels/buttons/hints/dialogs.
const T: Record<string, Dict> = {
  // STATUS labels
  stNew: { en: "New", zh: "新单", fr: "Nouveau" },
  stPreparing: { en: "Preparing", zh: "备餐中", fr: "En préparation" },
  stDelivering: { en: "Delivering", zh: "配送中", fr: "En livraison" },
  stDone: { en: "Done", zh: "已完成", fr: "Terminé" },
  stCancelled: { en: "Cancelled", zh: "已取消", fr: "Annulé" },
  // NEXT-action labels
  nextPreparing: { en: "Start preparing", zh: "开始备餐", fr: "Commencer" },
  nextDone: { en: "Mark done", zh: "标记完成", fr: "Marquer terminé" },
  nextDelivered: { en: "Delivered", zh: "已送达", fr: "Livré" },
  // Header
  overview: { en: "Overview", zh: "总览", fr: "Aperçu" },
  newOrdersPill: { en: "{n} new orders", zh: "{n} 个新订单", fr: "{n} nouvelles commandes" },
  pendingPill: { en: "{n} pending", zh: "{n} 单待处理", fr: "{n} en attente" },
  enableSoundTitle: { en: "New-order sound alert", zh: "新订单提示音", fr: "Alerte sonore des nouvelles commandes" },
  enableSound: { en: "🔔 Enable sound", zh: "🔔 开启提示音", fr: "🔔 Activer le son" },
  pushTitle: {
    en: "Push notifications — get a system alert on new orders even when this app is closed",
    zh: "推送通知 — 即使关闭本应用,来新订单也会收到系统通知",
    fr: "Notifications push — recevez une alerte système à chaque commande même app fermée",
  },
  pushEnable: { en: "🔔 Enable push", zh: "🔔 开启推送", fr: "🔔 Activer push" },
  pushOn: { en: "🔔 Push on", zh: "🔔 推送已开", fr: "🔔 Push activé" },
  pushDenied: {
    en: "Notifications are blocked. Allow them in the browser/OS settings, then retry.",
    zh: "通知被浏览器/系统屏蔽了。请到设置里允许本站通知后重试。",
    fr: "Notifications bloquées. Autorisez-les dans les réglages, puis réessayez.",
  },
  pushUnsupported: {
    en: "Push needs the installed app. Add to Home Screen / Install first, then open it.",
    zh: "推送需要先「安装/添加到主屏幕」,从安装后的图标打开本应用再开启。",
    fr: "Le push nécessite l'app installée. Ajoutez à l'écran d'accueil, puis rouvrez.",
  },
  sampleTicketTitle: { en: "See what the ticket looks like", zh: "看看小票长什么样", fr: "Voir à quoi ressemble le ticket" },
  sampleTicket: { en: "🖨️ Sample ticket", zh: "🖨️ 出单样张", fr: "🖨️ Ticket d'exemple" },
  reprintAllTitle: {
    en: "After network or printer recovers, reprint all in-progress orders in one tap",
    zh: "网络或打印机恢复后,一键重打所有进行中的订单",
    fr: "Après reprise du réseau ou de l'imprimante, réimprimer toutes les commandes en cours en un clic",
  },
  reprintAll: { en: "🖨️ Reprint all", zh: "🖨️ 补打全部", fr: "🖨️ Tout réimprimer" },
  refresh: { en: "Refresh", zh: "刷新", fr: "Actualiser" },
  trackPay: { en: "Payment methods", zh: "记录付款方式", fr: "Modes de paiement" },
  trackPayOn: { en: "On", zh: "开", fr: "Activé" },
  trackPayOff: { en: "Off", zh: "关", fr: "Désactivé" },
  trackPayHint: { en: "Off → no cash/EMT/card choice; everything is plain sales.", zh: "关闭后 → 结账不选现金/EMT/刷卡,一律计为销售额。", fr: "Désactivé → aucun choix comptant/virement/carte; tout est en ventes." },
  more: { en: "More", zh: "更多", fr: "Plus" },
  newOrder: { en: "New order", zh: "新建单", fr: "Nouvelle commande" },
  close: { en: "Close", zh: "关闭", fr: "Fermer" },
  viewDine: { en: "Tables", zh: "桌面", fr: "Salle" },
  viewTogo: { en: "Pickup", zh: "自取", fr: "À emporter" },
  viewDelivery: { en: "Delivery", zh: "外送", fr: "Livraison" },
  viewMarket: { en: "Market price", zh: "时价", fr: "Prix du jour" },
  nextDepart: { en: "Out for delivery", zh: "出发配送", fr: "En route" },
  deliverTo: { en: "Deliver to", zh: "送至", fr: "Livrer à" },
  emptyTogo: { en: "No pickup orders yet.", zh: "还没有自取订单。", fr: "Aucune commande à emporter." },
  emptyDelivery: { en: "No delivery orders yet.", zh: "还没有外送订单。", fr: "Aucune commande de livraison." },
  // Empty state as a FEATURE (design review 1A): heading + context + one primary
  // action, replacing the bare "No items." card. Headings drop the trailing 。
  // because they're titles, not sentences.
  emptyTogoTitle: { en: "No takeout orders yet", zh: "还没有自取订单", fr: "Aucune commande à emporter" },
  emptyDeliveryTitle: { en: "No delivery orders yet", zh: "还没有外送订单", fr: "Aucune commande de livraison" },
  emptyHint: {
    en: "Orders appear here automatically when customers order from the QR menu. You can also take one by phone.",
    zh: "顾客通过二维码菜单下单后,订单会实时出现在这里。也可以直接帮电话订单下单。",
    fr: "Les commandes apparaissent ici dès qu'un client commande via le menu QR. Vous pouvez aussi en saisir une par téléphone.",
  },
  // Campus order-ahead pickup (🚚) — distinct from fulai's takeout (自取)
  viewPickup: { en: "Order-ahead", zh: "取餐", fr: "Sur commande" },
  emptyPickup: { en: "No order-ahead pickups yet.", zh: "还没有取餐订单。", fr: "Aucune commande à ramasser." },
  puAcceptHint: { en: "Accept · prep time", zh: "接单 · 预计时间", fr: "Accepter · délai" },
  puReady: { en: "✅ Ready", zh: "✅ 可取餐", fr: "✅ Prêt" },
  puPickedUp: { en: "🎉 Picked up", zh: "🎉 已取餐", fr: "🎉 Récupéré" },
  puDone: { en: "Picked up", zh: "已取餐", fr: "Récupéré" },
  puReadyBadge: { en: "READY", zh: "可取餐", fr: "PRÊT" },
  puEta: { en: "~{n} min", zh: "约 {n} 分钟", fr: "~{n} min" },
  puReadyPush: { en: "Customer notified 🔔", zh: "已通知顾客 🔔", fr: "Client averti 🔔" },
  puWhenTitle: {
    en: "Customer's chosen pickup time — have it ready by then",
    zh: "顾客选择的取餐时间——按这个时间备好",
    fr: "Heure de retrait choisie par le client — à préparer pour cette heure",
  },
  puPickupWord: { en: "pickup", zh: "取餐", fr: "retrait" },
  puConfirmFor: { en: "✓ Confirm for {t}", zh: "✓ 按 {t} 接单", fr: "✓ Confirmer pour {t}" },
  puMin: { en: "{n} min", zh: "{n} 分钟", fr: "{n} min" },
  // Empty state
  emptyOrders: {
    en: "No orders yet. Once customers order via the “📱 QR menu”, they show up here in real time.",
    zh: "还没有订单。顾客通过「📱 二维码菜单」下单后,会实时出现在这里。",
    fr: "Aucune commande. Dès qu'un client commande via le « 📱 menu QR », elle apparaît ici en temps réel.",
  },
  // Tab title flash
  newOrdersTitle: { en: "{n} new orders", zh: "{n} 新订单", fr: "{n} nouvelles commandes" },
  // Card
  table: { en: "Table", zh: "桌号", fr: "Table" },
  notePrefix: { en: "Note: ", zh: "备注:", fr: "Note : " },
  tableRounds: {
    en: "{n} rounds at this table · total {sum} (tap “Print bill” for one merged table bill)",
    zh: "本桌共 {n} 单加餐 · 合计 {sum}(点「打印账单」出整桌合并总单)",
    fr: "{n} tournées à cette table · total {sum} (touchez « Imprimer l'addition » pour une addition combinée)",
  },
  cardTotal: { en: "Total {sum}", zh: "合计 {sum}", fr: "Total {sum}" },
  // Item row
  marketPending: { en: "Market price pending", zh: "时价待录入", fr: "Prix du jour à saisir" },
  marketPendingTitle: {
    en: "Enter today's actual price before completing the order",
    zh: "完成订单前需录入当日实价",
    fr: "Saisir le prix réel du jour avant de terminer la commande",
  },
  itemCancel: { en: "Cancel", zh: "取消", fr: "Annuler" },
  itemCancelled: { en: "Cancelled", zh: "已取消", fr: "Annulé" },
  // ⋯ menu
  moreActions: { en: "More actions", zh: "更多操作", fr: "Plus d'actions" },
  ticketPreview: { en: "🖨️ Ticket preview", zh: "🖨️ 出单预览", fr: "🖨️ Aperçu du ticket" },
  printTableBill: { en: "🧾 Print table bill", zh: "🧾 打印整桌账单", fr: "🧾 Imprimer l'addition de table" },
  printBill: { en: "🧾 Print bill", zh: "🧾 打印账单", fr: "🧾 Imprimer l'addition" },
  reprintKitchen: { en: "Reprint kitchen ticket", zh: "重打厨房单", fr: "Réimprimer le ticket cuisine" },
  cancelOrder: { en: "Cancel order", zh: "取消订单", fr: "Annuler la commande" },
  deleteOrder: { en: "Delete", zh: "删除", fr: "Supprimer" },
  // Dialogs / alerts
  confirmRefund: {
    en: "This order was paid online for ${amt}. Cancelling will auto-refund the customer. Are you sure?",
    zh: "该订单已在线支付 ${amt},取消将自动退款给顾客。确定吗?",
    fr: "Cette commande a été payée en ligne pour {amt} $. L'annulation remboursera automatiquement le client. Confirmer ?",
  },
  refundFailed: { en: "Refund failed, order not cancelled: ", zh: "退款失败,未取消订单:", fr: "Remboursement échoué, commande non annulée : " },
  refundRetry: { en: "please try again", zh: "请重试", fr: "veuillez réessayer" },
  marketPrompt: {
    en: "Market price: today's unit price for “{name}” ($)",
    zh: "时价录入:「{name}」今日单价($)",
    fr: "Prix du jour : prix unitaire d'aujourd'hui pour « {name} » ($)",
  },
  invalidPrice: { en: "Enter a valid price; order not completed.", zh: "请输入有效价格,订单未完成。", fr: "Saisissez un prix valide ; commande non terminée." },
  savePriceFailed: { en: "Failed to save market price: ", zh: "保存时价失败:", fr: "Échec de l'enregistrement du prix : " },
  statusFailed: { en: "Status update failed, please retry: ", zh: "状态更新失败,请重试:", fr: "Échec de la mise à jour du statut, réessayez : " },
  noActive: { en: "No in-progress orders", zh: "没有进行中的订单", fr: "Aucune commande en cours" },
  confirmReprintAll: {
    en: "Resend {n} in-progress orders to the printer? (use after network/printer recovers)",
    zh: "把 {n} 张进行中的订单重新发给打印机?(网络/打印机恢复后用)",
    fr: "Renvoyer {n} commandes en cours à l'imprimante ? (à utiliser après reprise du réseau/de l'imprimante)",
  },
  reprintedN: {
    en: "{n} resent; the printer will print them over the next few seconds.",
    zh: "已补打 {n} 张,打印机将在几秒内陆续打印。",
    fr: "{n} renvoyées ; l'imprimante les imprimera dans les prochaines secondes.",
  },
  printBillFailed: { en: "Print bill failed: ", zh: "打印账单失败:", fr: "Échec de l'impression de l'addition : " },
  confirmDelete: { en: "Delete this order?", zh: "确定删除这个订单?", fr: "Supprimer cette commande ?" },
};

const STATUS: Record<Order["status"], { key: string; cls: string }> = {
  new: { key: "stNew", cls: "bg-amber-100 text-amber-700" },
  preparing: { key: "stPreparing", cls: "bg-blue-100 text-blue-700" },
  delivering: { key: "stDelivering", cls: "bg-violet-100 text-violet-700" },
  done: { key: "stDone", cls: "bg-green-100 text-green-700" },
  cancelled: { key: "stCancelled", cls: "bg-slate-100 text-ink-faint" },
};

// Next action per order, order-type aware. Delivery gets the extra 出发配送
// (preparing → delivering) step so a driver leg is trackable; togo/dine-in skip it.
function nextStep(o: Order): { to: Order["status"]; key: string } | null {
  if (o.status === "new") return { to: "preparing", key: "nextPreparing" };
  if (o.status === "preparing") return o.order_type === "delivery" ? { to: "delivering", key: "nextDepart" } : { to: "done", key: "nextDone" };
  if (o.status === "delivering") return { to: "done", key: "nextDelivered" };
  return null;
}

const POLL_MS = 8000;

/** Display phone as (XXX) XXX-XXXX; falls back to raw if not 10 digits. */
function fmtPhone(p: string) {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

// A representative order so staff can preview/tune the ticket with no live orders.
const SAMPLE_ORDER = {
  id: "sample-a1b2c3",
  tenant_slug: "fulai",
  items: [
    { id: "1", name_zh: "游水青斑火锅", name_en: "Live Green Bass Hot Pot", price: 65.99, qty: 2 },
    { id: "2", name_zh: "大补走地鸡窝（半）", name_en: "Free Range Chicken (Half)", price: 35.99, qty: 1 },
    { id: "3", name_zh: "白饭", name_en: "Steamed Rice", price: 1.5, qty: 3 },
  ],
  total: 172.47,
  table_no: "8A",
  phone: "5143574178",
  note: "走地鸡不要辣，多加姜",
  status: "new",
  created_at: new Date().toISOString(),
  order_type: "dine_in",
  payment_status: "unpaid",
  payment_method: "",
  tip: 0,
  subtotal: null,
  gst: null,
  pst: null,
  customer_email: null,
  address: null,
  eta_minutes: null,
  paid_at: null,
} as unknown as Order;

export default function OrdersPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const { t } = useLang();
  const [orders, setOrders] = useState<Order[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [preview, setPreview] = useState<Order | null>(null); // kitchen-ticket preview
  const [menuFor, setMenuFor] = useState<string | null>(null); // order id whose ⋯ overflow menu is open
  // starts as the slug, replaced by the tenant's real name once fetched —
  // never default to one merchant's name inside another merchant's portal
  const [shopName, setShopName] = useState(slug);
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [view, setView] = useState<"dine" | "togo" | "delivery" | "pickup" | "market">("dine");
  const [headerMenu, setHeaderMenu] = useState(false); // ⋯ overflow for the header's utility actions
  const [newOrder, setNewOrder] = useState(false); // manual takeout/delivery order composer
  // Non-blocking error toast. Status failures used to fire window.alert(), which
  // freezes the whole portal behind an OS dialog staff must dismiss one-handed
  // mid-service (and Chrome then offers "suppress dialogs", which would hide
  // every future error). Inline + auto-dismissing per DESIGN-PLATFORM.md.
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 8000);
    return () => clearTimeout(id);
  }, [toast]);
  const [trackPay, setTrackPay] = useState(true); // record cash/EMT/card at checkout + method stats (tenant setting)
  const toggleTrackPay = () => { const next = !trackPay; setTrackPay(next); saveTrackPayments(slug, next).catch(() => {}); };

  useEffect(() => {
    getTenant(slug).then((tt) => { if (tt) { setTenant(tt); setTrackPay(tt.trackPayments); if (tt.name?.zh) setShopName(tt.name.zh); } }).catch(() => {});
  }, [slug]);

  // Restore/persist the selected view.
  useEffect(() => {
    try { const v = localStorage.getItem("bento_orders_view"); if (v === "dine" || v === "togo" || v === "delivery" || v === "pickup" || v === "market") setView(v); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("bento_orders_view", view); } catch { /* ignore */ }
  }, [view]);
  // Clamp the active tab into what the vendor offers: a stored "dine" (or the
  // default) on a pickup-only truck would render an empty tab. Snap to the
  // first offered mode once the tenant loads.
  useEffect(() => {
    if (tenant?.orderModes && !tenant.orderModes.includes(view)) {
      setView(tenant.orderModes[0] as typeof view);
    }
  }, [tenant, view]);

  const seen = useRef<Set<string>>(new Set()); // order IDs we've already shown
  const inited = useRef(false); // first successful fetch seeds `seen`, no alert
  const audioCtx = useRef<AudioContext | null>(null);
  const baseTitle = useRef<string>("");
  const soundRef = useRef(false);

  useEffect(() => {
    try {
      const on = localStorage.getItem("bento_order_sound") === "on";
      setSoundOn(on);
      soundRef.current = on;
    } catch {
      /* ignore */
    }
  }, []);

  // Web Push: reflect the current subscription state, and toggle on click. When
  // ON, /api/push/send delivers an OS notification per new order even if this
  // app is closed / the device is locked (see lib/push.ts + public/sw.js).
  const [pushState, setPushState] = useState<PushState>("off");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    currentPushState().then(setPushState).catch(() => {});
  }, []);
  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const next = pushState === "on" ? await disablePush() : await enablePush(slug);
      setPushState(next);
      if (next === "denied") alert(t(T.pushDenied));
      else if (next === "unsupported") alert(t(T.pushUnsupported));
    } catch {
      /* surfaced via state; keep the screen alive */
    } finally {
      setPushBusy(false);
    }
  };

  const beep = useCallback(() => {
    const ctx = audioCtx.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    } catch {
      /* playback can still be rejected — degrade silently */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await listOrders(slug);
      setOrders(data);
      const ids = data.map((o) => o.id);
      if (!inited.current) {
        // seed from the FIRST successful fetch so mount doesn't alert for existing orders
        seen.current = new Set(ids);
        inited.current = true;
        return;
      }
      const fresh = data.filter((o) => !seen.current.has(o.id));
      ids.forEach((id) => seen.current.add(id));
      const freshActive = fresh.filter((o) => o.status === "new" || o.status === "preparing");
      if (freshActive.length > 0) {
        setUnread((u) => u + freshActive.length);
        if (soundRef.current) beep();
      }
    } catch {
      // Keep the last good list — a transient/auth error must not blank the kitchen screen.
    }
  }, [slug, beep]);

  // Poll while visible; pause when hidden; refetch immediately on return.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(load, POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    load();
    start();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        setUnread(0); // staff is looking at the screen
        load();
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // Flash the tab title while there are unread new orders; always restore it.
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title;
    if (unread <= 0) {
      document.title = baseTitle.current;
      return;
    }
    let on = false;
    const flip = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 ${t(T.newOrdersTitle).replace("{n}", String(unread))}` : baseTitle.current;
    }, 1000);
    return () => {
      clearInterval(flip);
      document.title = baseTitle.current;
    };
  }, [unread]);

  const enableSound = () => {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = new Ctor();
      audioCtx.current.resume?.();
      beep(); // unlock + confirm via the user gesture
      setSoundOn(true);
      soundRef.current = true;
      localStorage.setItem("bento_order_sound", "on");
    } catch {
      /* ignore */
    }
  };

  const refresh = () => {
    setUnread(0);
    load();
  };

  // orders with an advance() in flight — blocks double-tap double-posting
  const advancing = useRef<Set<string>>(new Set());

  const advance = async (o: Order, to: Order["status"]) => {
    if (advancing.current.has(o.id)) return;
    advancing.current.add(o.id);
    try {
      // Cancelling a PAID online order must return the money first (the DB gate
      // lets a paid order be cancelled, so an un-refunded cancel keeps the
      // diner's cash). Refund server-side, then fall through to set 'cancelled'.
      if (to === "cancelled" && o.payment_status === "paid" && (o.order_type === "togo" || o.order_type === "delivery")) {
        if (!confirm(t(T.confirmRefund).replace("{amt}", Number(o.total).toFixed(2)))) return;
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/pay/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
          body: JSON.stringify({ orderId: o.id }),
        });
        const rd = await res.json().catch(() => ({ ok: false }));
        if (!rd.ok) {
          alert(t(T.refundFailed) + (rd.error ?? t(T.refundRetry)));
          return;
        }
      }
      // 时价 gate: an order can't be completed until every market-priced item has
      // its actual price entered (today's 时价 from the menu prefills the prompt).
      let items = o.items;
      if (to === "done" && o.status !== "done") {
        const needPricing = items.filter((it) => it.market && !(Number(it.price) > 0) && !(it as any).cancelled);
        if (needPricing.length > 0) {
          // today's reference prices from 菜单设置 (时价更新 panel)
          const menu = await listMenuItems(slug).catch(() => []);
          const menuPrice = new Map(menu.map((m) => [m.id, m.price]));
          const updated = [...items];
          for (const it of needPricing) {
            const def = menuPrice.get(it.id);
            const raw = window.prompt(
              t(T.marketPrompt).replace("{name}", it.name_zh),
              def != null && def > 0 ? String(def) : "",
            );
            if (raw == null) return; // staff cancelled — abort completion
            const p = parseFloat(raw);
            if (!(p > 0)) {
              alert(t(T.invalidPrice));
              return;
            }
            const idx = updated.indexOf(it);
            updated[idx] = { ...it, price: Math.round(p * 100) / 100 };
          }
          const newTotal = updated
            .filter((it: any) => !it.cancelled)
            .reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
          const res = await updateOrderItems(o.id, updated as OrderItem[], Math.round(newTotal * 100) / 100);
          if (res.error) {
            alert(t(T.savePriceFailed) + res.error);
            return;
          }
          items = updated;
        }
      }

      if (to === "done") {
        // CAS: exactly ONE device/tap wins the done-transition, so ledger,
        // dish counts and member spend post exactly once. Pickup orders claim
        // via picked_up_at (also stamps the pickup time) — same single-winner.
        const { claimed, error } = o.order_type === "pickup"
          ? await claimPickedUp(o.id)
          : await claimOrderDone(o.id);
        if (error) {
          setToast(t(T.statusFailed) + error);
          return;
        }
        if (claimed) {
          // Billing is explicit (打印账单), NOT auto-on-complete — otherwise a
          // table's rounds completing one by one would each print a partial bill
          // instead of one merged bill at checkout.
          const activeItems = items.filter((it: any) => !it.cancelled);
          const activeTotal = activeItems.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
          try {
            await Promise.all([
              postOrderSales(slug, activeItems),
              recordOrderSale(slug, { id: o.id, total: activeTotal, items: activeItems, source: "qr" }),
              o.phone ? syncMemberFromOrder(slug, o.phone, "", activeTotal) : Promise.resolve(),
            ]);
          } catch (e) {
            console.error("post order sale", e);
          }
        }
      } else {
        const { error } = await setOrderStatus(o.id, to);
        if (error) setToast(t(T.statusFailed) + error);
        // Tell the student their pickup order died — otherwise the tracker
        // shows "Order received" forever (design review 5A).
        if (!error && to === "cancelled" && o.order_type === "pickup") await notifyPickup(o.id, "cancelled");
      }
      load();
    } finally {
      advancing.current.delete(o.id);
    }
  };

  // Pickup: accept (new → preparing). ASAP orders take a prep ETA (which stamps
  // the single target clock = now + eta); student-scheduled orders CONFIRM with
  // eta null — their chosen time stays the only clock (design review 7A).
  const acceptPickupOrder = async (o: Order, eta: number | null) => {
    if (advancing.current.has(o.id)) return;
    advancing.current.add(o.id);
    try {
      const { error } = await acceptPickup(o.id, eta);
      if (error) setToast(t(T.statusFailed) + error);
      load();
    } finally {
      advancing.current.delete(o.id);
    }
  };

  // Best-effort diner push (READY or CANCELLED); tracker still updates on poll.
  const notifyPickup = async (orderId: string, kind: "ready" | "cancelled") => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      await fetch("/api/pickup/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
        body: JSON.stringify({ order_id: orderId, kind }),
      });
    } catch (e) {
      console.error("pickup notify", e);
    }
  };

  // Pickup: mark READY (CAS on ready_at). The winner fires the consumer push
  // (Slice 5) — for now the tracker flips to "可取餐" on its next ~8s poll.
  const readyPickupOrder = async (o: Order) => {
    if (advancing.current.has(o.id)) return;
    advancing.current.add(o.id);
    try {
      const { readied, error } = await markPickupReady(o.id);
      if (error) setToast(t(T.statusFailed) + error);
      // Only the CAS winner pushes, so the diner gets the "ready" alert once.
      if (readied) await notifyPickup(o.id, "ready");
      load();
    } finally {
      advancing.current.delete(o.id);
    }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const active = orders.filter((o) => o.status === "new" || o.status === "preparing");

  // Buckets by order type — dine-in goes to the floor plan; togo/delivery/pickup to lists.
  const togoOrders = orders.filter((o) => o.order_type === "togo");
  const deliveryOrders = orders.filter((o) => o.order_type === "delivery");
  // 新建订单 has two homes (design review 1A): centered as the empty tab's primary
  // action, docked in the toolbar the moment there are orders to read. Only the
  // takeout/delivery tabs can be "empty with nothing to do" — the floor plan and
  // 时价 panel always have content, so they keep the toolbar button.
  const ctaIsCentered =
    (view === "togo" && togoOrders.length === 0) ||
    (view === "delivery" && deliveryOrders.length === 0);

  /** Empty state as a feature: heading, context, one primary action. Replaces the
   *  bare "No items." card DESIGN-PLATFORM.md explicitly forbids. */
  const renderEmptyWithCta = (title: string) => (
    <div className="card flex flex-col items-center px-6 py-16 text-center sm:py-24">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{t(T.emptyHint)}</p>
      <button
        onClick={() => setNewOrder(true)}
        className="btn-primary mt-6 inline-flex min-h-12 items-center gap-2 px-7 text-base"
      >
        ＋ {t(T.newOrder)}
      </button>
    </div>
  );
  // Pickup tab works in TARGET-TIME order: what has to be ready soonest, first.
  // ASAP orders target their creation time; scheduled ones their requested time.
  const pickupOrders = orders
    .filter((o) => o.order_type === "pickup")
    .sort((a, b) =>
      new Date(a.requested_pickup_at ?? a.created_at).getTime() -
      new Date(b.requested_pickup_at ?? b.created_at).getTime());
  const pickupActive = pickupOrders.filter((o) => !o.picked_up_at && o.status !== "cancelled").length;
  const dineUnpaid = orders.filter((o) => o.order_type === "dine_in" && o.payment_status === "unpaid").length;
  const togoActive = togoOrders.filter((o) => o.status === "new" || o.status === "preparing").length;
  const deliveryActive = deliveryOrders.filter((o) => o.status === "new" || o.status === "preparing" || o.status === "delivering").length;
  // dine-in unpaid rounds carrying an un-priced 时价 item — needs pricing before checkout
  const marketPending = orders.filter(
    (o) => o.order_type === "dine_in" && o.payment_status === "unpaid" && o.status !== "cancelled" &&
      (o.items ?? []).some((it: any) => it.market && !(Number(it.price) > 0) && !it.cancelled),
  ).length;
  // Only show the tabs for modes this vendor offers. A campus truck is
  // pickup-only, so it never sees Tables / Delivery / Market price. tenant is
  // undefined until loaded → show all (unchanged for existing restaurants).
  const offeredModes = tenant?.orderModes;
  const ALL_VIEWS: { key: OrderMode; label: string; icon: string; count: number }[] = [
    { key: "dine", label: t(T.viewDine), icon: "🗺️", count: dineUnpaid },
    { key: "togo", label: t(T.viewTogo), icon: "📦", count: togoActive },
    { key: "delivery", label: t(T.viewDelivery), icon: "🚴", count: deliveryActive },
    { key: "pickup", label: t(T.viewPickup), icon: "🚚", count: pickupActive },
    { key: "market", label: t(T.viewMarket), icon: "💰", count: marketPending },
  ];
  const VIEWS = ALL_VIEWS.filter((v) => !offeredModes || offeredModes.includes(v.key));

  // Active dine-in orders grouped by table — for the COMBINED BILL and the
  // "本桌共 N 单" hint. Cards stay PER-ROUND (the kitchen fires per round); only
  // the BILL merges by table, on 打印账单 / checkout — never the kitchen cards.
  const tableSiblings = new Map<string, Order[]>();
  for (const o of orders) {
    if ((o.status === "new" || o.status === "preparing") && o.order_type === "dine_in" && (o.table_no || "").trim() !== "") {
      const k = (o.table_no || "").trim();
      const arr = tableSiblings.get(k);
      if (arr) arr.push(o); else tableSiblings.set(k, [o]);
    }
  }
  const siblingsOf = (o: Order): Order[] => {
    if (o.order_type !== "dine_in" || !(o.table_no || "").trim()) return [o];
    return tableSiblings.get((o.table_no || "").trim()) ?? [o];
  };

  const itemRow = (o: Order, it: any, i: number) => (
    <div key={i} className={`flex items-center justify-between py-1.5 text-sm ${it.cancelled ? "opacity-40" : ""}`}>
      <span className={it.cancelled ? "line-through text-ink-faint" : "text-ink"}>
        {it.name_zh} <span className="text-ink-faint">×{it.qty}</span>
      </span>
      <span className="flex items-center gap-2">
        {it.market && !(Number(it.price) > 0) ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-700" title={t(T.marketPendingTitle)}>{t(T.marketPending)}</span>
        ) : (
          <span className={it.cancelled ? "line-through text-ink-faint" : "text-ink-soft"}>{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
        )}
        {!it.cancelled && o.status !== "done" && o.status !== "cancelled" && (
          <button className="text-xs text-ink-faint hover:text-red-600" onClick={async () => { await cancelOrderItem(o.id, i); load(); }}>{t(T.itemCancel)}</button>
        )}
        {it.cancelled && <span className="text-xs text-red-400">{t(T.itemCancelled)}</span>}
      </span>
    </div>
  );

  // One row in the ⋯ overflow menu — full-width, ≥44px tap target.
  const MenuItem = ({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) => (
    <button
      onClick={() => { setMenuFor(null); onClick(); }}
      className={`flex w-full items-center gap-2 px-3.5 py-3 text-left text-sm ${danger ? "text-red-600 hover:bg-red-50" : "text-ink hover:bg-slate-50"}`}
    >
      {children}
    </button>
  );

  // Pickup card primary action: new → accept → Ready → Picked up.
  // ONE TIME CONTRACT (7A): student-scheduled orders get a single
  // "Confirm for 12:15" (their time IS the clock); ASAP orders get prep-ETA
  // chips which stamp the target clock. 44px targets, worded labels (10A).
  const ETA_CHIPS = [5, 10, 15, 20];
  const pickupPrimary = (o: Order) => {
    if (o.status === "cancelled") return null;
    if (o.picked_up_at) return <span className="pill bg-green-100 text-green-700">✓ {t(T.puDone)}</span>;
    if (o.ready_at) return <button onClick={() => advance(o, "done")} className="btn-primary px-4 text-sm">{t(T.puPickedUp)}</button>;
    if (o.status === "preparing") return <button onClick={() => readyPickupOrder(o)} className="btn-primary px-4 text-sm">{t(T.puReady)}</button>;
    // status "new", student-scheduled → single confirm toward their time
    if (o.requested_pickup_at) {
      const hhmm = new Date(o.requested_pickup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return (
        <button onClick={() => acceptPickupOrder(o, null)} className="btn-primary min-h-11 px-4 text-sm">
          {t(T.puConfirmFor).replace("{t}", hhmm)}
        </button>
      );
    }
    // status "new", ASAP → accept + prep ETA in one tap
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-ink-faint">{t(T.puAcceptHint)}</span>
        <div className="flex items-center gap-1.5">
          {ETA_CHIPS.map((m) => (
            <button
              key={m}
              onClick={() => acceptPickupOrder(o, m)}
              className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              {t(T.puMin).replace("{n}", String(m))}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCard = (o: Order) => {
    const sibs = siblingsOf(o);          // this table's active rounds (self if none)
    const multi = sibs.length > 1;       // part of a multi-round tab (加餐)
    const tableTotal = sibs.reduce((s, x) => s + Number(x.total || 0), 0);
    return (
      <div key={o.id} className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`pill ${STATUS[o.status].cls}`}>{t(T[STATUS[o.status].key])}</span>
            {o.order_type === "pickup" && o.pickup_code && (
              <span className="pill bg-emerald-50 font-bold tracking-wider text-emerald-700">🎫 {o.pickup_code}</span>
            )}
            {/* target pickup time — cook so it's READY at this moment. Meaning is
                visible text, not a hover tooltip (design review 10A). */}
            {o.order_type === "pickup" && o.requested_pickup_at && !o.picked_up_at && (
              <span className="pill bg-amber-100 font-bold text-amber-700" title={t(T.puWhenTitle)}>
                🕐 {new Date(o.requested_pickup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {t(T.puPickupWord)}
              </span>
            )}
            {o.order_type === "pickup" && o.ready_at && !o.picked_up_at && (
              <span className="pill bg-green-100 font-bold text-green-700">{t(T.puReadyBadge)}</span>
            )}
            {o.order_type === "pickup" && o.status === "preparing" && !o.ready_at && o.eta_minutes && (
              <span className="text-xs text-ink-faint">{t(T.puEta).replace("{n}", String(o.eta_minutes))}</span>
            )}
            {o.table_no && <span className="text-sm font-medium text-ink">{t(T.table)} {displayTable(o.table_no)}</span>}
            {o.phone && o.phone !== "N/A" ? (
              <a href={`tel:${o.phone.replace(/[^0-9+]/g, "")}`} className="text-sm text-brand hover:underline">📞 {fmtPhone(o.phone)}</a>
            ) : o.phone === "N/A" ? (
              <span className="text-sm text-slate-400">📞 N/A</span>
            ) : null}
          </div>
          <span className="text-xs text-ink-faint">{fmtTime(o.created_at)}</span>
        </div>
        {o.order_type === "delivery" && o.address && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent([o.address.street, o.address.unit, o.address.city, o.address.postal].filter(Boolean).join(", "))}`}
            target="_blank"
            rel="noreferrer"
            className="mb-2 block rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 transition hover:bg-sky-100"
          >
            📍 {t(T.deliverTo)}: {[o.address.street, o.address.unit].filter(Boolean).join(" ")}{o.address.city ? `, ${o.address.city}` : ""} {o.address.postal}
          </a>
        )}
        <div className="divide-y divide-slate-100">{o.items.map((it: any, i: number) => itemRow(o, it, i))}</div>
        {o.note && <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-ink-soft">{t(T.notePrefix)}{o.note}</div>}
        {multi && o.status !== "cancelled" && (
          <div className="mt-2 rounded bg-brand-wash px-2 py-1 text-xs text-brand-ink">{t(T.tableRounds).replace("{n}", String(sibs.length)).replace("{sum}", fmtPrice(tableTotal))}</div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-semibold text-ink">{t(T.cardTotal).replace("{sum}", fmtPrice(o.total))}</span>
          <div className="flex items-center gap-2">
            {o.order_type === "pickup" ? pickupPrimary(o) : (() => {
              const n = nextStep(o);
              return n ? <button onClick={() => advance(o, n.to)} className="btn-primary px-4 text-sm">{t(T[n.key])}</button> : null;
            })()}
            {/* secondary actions collapse into a ⋯ menu so the row never crowds on a phone */}
            <div className="relative">
              <button
                onClick={() => setMenuFor(menuFor === o.id ? null : o.id)}
                aria-label={t(T.moreActions)}
                aria-expanded={menuFor === o.id}
                className="grid h-11 w-11 flex-none place-items-center rounded-lg border border-slate-200 text-lg leading-none text-ink-soft hover:bg-slate-50"
              >
                ⋯
              </button>
              {menuFor === o.id && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuFor(null)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <MenuItem onClick={() => setPreview(o)}>{t(T.ticketPreview)}</MenuItem>
                    {o.status !== "cancelled" && (
                      <MenuItem onClick={async () => { const r = await requestBill(sibs.map((s) => s.id)); if (r.error) alert(t(T.printBillFailed) + r.error); }}>
                        {multi ? t(T.printTableBill) : t(T.printBill)}
                      </MenuItem>
                    )}
                    <MenuItem onClick={async () => { await reprintOrder(o.id); load(); }}>{t(T.reprintKitchen)}</MenuItem>
                    {o.status !== "cancelled" && o.status !== "done" && (
                      <MenuItem danger onClick={() => advance(o, "cancelled")}>{t(T.cancelOrder)}</MenuItem>
                    )}
                    <MenuItem danger onClick={async () => { if (confirm(t(T.confirmDelete))) { await deleteOrder(o.id); load(); } }}>{t(T.deleteOrder)}</MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← {t(T.overview)}</Link>
      <header className="mt-3 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{mod.icon} {mod.label.zh}</h1>
          <p className="mt-1 text-sm text-ink-soft">{mod.pain.zh}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {unread > 0 && <span className="pill bg-red-100 text-red-700">🔔 {t(T.newOrdersPill).replace("{n}", String(unread))}</span>}
          <span className="pill bg-amber-100 text-amber-700">{t(T.pendingPill).replace("{n}", String(active.length))}</span>
          {!soundOn && (
            <button onClick={enableSound} className="btn-ghost border border-slate-300 text-sm" title={t(T.enableSoundTitle)}>
              {t(T.enableSound)}
            </button>
          )}
          {pushState !== "unsupported" && (
            <button
              onClick={togglePush}
              disabled={pushBusy}
              title={t(T.pushTitle)}
              className={`text-sm ${pushState === "on" ? "btn-ghost border border-brand bg-brand-wash text-brand-ink" : "btn-ghost border border-slate-300"}`}
            >
              {pushState === "on" ? t(T.pushOn) : t(T.pushEnable)}
            </button>
          )}
          <button onClick={refresh} className="btn-ghost border border-slate-300 text-sm">{t(T.refresh)}</button>
          {/* payment-method tracking mode — off hides cash/EMT/card everywhere, all as sales */}
          <button
            onClick={toggleTrackPay}
            role="switch"
            aria-checked={trackPay}
            title={t(T.trackPayHint)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${trackPay ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-300 text-ink-soft hover:bg-slate-50"}`}
          >
            <span>💳 {t(T.trackPay)}</span>
            <span className={`inline-flex h-5 w-9 flex-none items-center rounded-full px-0.5 transition ${trackPay ? "justify-end bg-brand" : "justify-start bg-slate-300"}`}>
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </span>
            <span className="text-xs">{trackPay ? t(T.trackPayOn) : t(T.trackPayOff)}</span>
          </button>
          {/* rarely-used utilities collapse into a ⋯ menu so the header never crowds/clips */}
          <div className="relative">
            <button
              onClick={() => setHeaderMenu((v) => !v)}
              aria-label={t(T.more)}
              aria-expanded={headerMenu}
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-lg leading-none text-ink-soft hover:bg-slate-50"
            >
              ⋯
            </button>
            {headerMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setHeaderMenu(false)} />
                <div className="absolute right-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <button onClick={() => { setHeaderMenu(false); setPreview(SAMPLE_ORDER); }} className="flex w-full items-center px-3.5 py-3 text-left text-sm text-ink hover:bg-slate-50">{t(T.sampleTicket)}</button>
                  <button
                    onClick={async () => {
                      setHeaderMenu(false);
                      if (active.length === 0) { alert(t(T.noActive)); return; }
                      if (!confirm(t(T.confirmReprintAll).replace("{n}", String(active.length)))) return;
                      const n = await reprintActiveOrders(slug);
                      load();
                      alert(t(T.reprintedN).replace("{n}", String(n)));
                    }}
                    className="flex w-full items-center px-3.5 py-3 text-left text-sm text-ink hover:bg-slate-50"
                  >
                    {t(T.reprintAll)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* view switch: dine-in floor plan · togo list · delivery list — with a
          manual-order composer for phone/walk-in takeout & delivery orders */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition ${view === v.key ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}
            >
              <span aria-hidden>{v.icon}</span>{v.label}
              {v.count > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-700">{v.count}</span>}
            </button>
          ))}
        </div>
        {/* Docked when there's live work on screen; the centered empty-state CTA
            below owns the action when the tab is empty (design review 1A). One
            home during service, so muscle memory holds mid-rush. */}
        {!ctaIsCentered && (
          <button onClick={() => setNewOrder(true)} className="btn-primary inline-flex min-h-11 items-center gap-1.5 px-4 text-sm">
            ＋ {t(T.newOrder)}
          </button>
        )}
      </div>

      {view === "dine" && (
        <TableFloor slug={slug} orders={orders} tables={tenant?.tables ?? []} layout={tenant?.tableLayout ?? []} trackPayments={trackPay} dayStartHour={tenant?.dayStartHour ?? 0} onChanged={load} />
      )}

      {view === "togo" && (
        togoOrders.length === 0 ? (
          renderEmptyWithCta(t(T.emptyTogoTitle))
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{togoOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {view === "delivery" && (
        deliveryOrders.length === 0 ? (
          renderEmptyWithCta(t(T.emptyDeliveryTitle))
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{deliveryOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {view === "pickup" && (
        pickupOrders.length === 0 ? (
          <div className="card p-10 text-center text-sm text-ink-faint">{t(T.emptyPickup)}</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{pickupOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {view === "market" && <MarketPricePanel slug={slug} />}

      {preview && <KitchenTicket order={preview} shopName={shopName} onClose={() => setPreview(null)} />}

      {/* Takeout/delivery order entry runs the SAME customer menu staff already
          use for table orders (design review D2) — one ordering surface, so what
          staff see matches what the diner sees. The menu pings us via postMessage
          when the order lands; we close and refresh. */}
      {newOrder && (
        <StaffOrderPicker
          slug={slug}
          mode="togo"
          // The tab staff came from already answered 自取 vs 配送; carry it in so
          // the menu doesn't ask again. Any other tab starts on 自取.
          orderType={view === "delivery" ? "delivery" : "togo"}
          onClose={() => setNewOrder(false)}
          onPlaced={(orderType) => {
            setNewOrder(false);
            // Land on the tab the order went to, so staff see what they just made.
            if (orderType === "togo" || orderType === "delivery") setView(orderType);
            load();
          }}
        />
      )}

      {/* Error toast — replaces window.alert() on status failures. Sits above the
          content, never blocks the order list, auto-dismisses after 8s, and is
          announced to screen readers. Staff can keep working while it's up. */}
      {toast && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
            <span aria-hidden className="text-lg leading-none">⚠️</span>
            <p className="flex-1 text-sm text-red-700">{toast}</p>
            <button
              onClick={() => setToast("")}
              aria-label={t(T.close)}
              className="-my-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg leading-none text-red-700 hover:bg-red-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
