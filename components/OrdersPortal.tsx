"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listOrders, setOrderStatus, claimOrderDone, acceptPickup, markPickupReady, claimPickedUp, cancelOrderItem, deleteOrder, reprintOrder, reprintActiveOrders, requestBill, updateOrderItems, type Order, type OrderItem } from "@/lib/orders";
import { postOrderSales, recordOrderSale, syncMemberFromOrder, adjustOrderSale, deleteOrderSale, getTenant, setTrackPayments as saveTrackPayments, type Tenant } from "@/lib/store";
import { type OrderMode } from "@/lib/orderModes";
import TableFloor from "@/components/TableFloor";
import MarketPricePanel from "@/components/MarketPricePanel";
import StaffOrderPicker from "@/components/StaffOrderPicker";
import OrderEditor from "@/components/OrderEditor";
import MarketPriceSheet, { type MarketLine } from "@/components/MarketPriceSheet";
import ConfirmSheet from "@/components/ConfirmSheet";
import { supabase } from "@/lib/supabase";
import { currentPushState, enablePush, disablePush, type PushState } from "@/lib/push";
import { listMenuItems } from "@/lib/menu";
import { price as fmtPrice, displayTable } from "@/lib/format";
import KitchenTicket from "@/components/KitchenTicket";
import OrderLineup from "@/components/OrderLineup";
import { useFocus } from "@/components/FocusMode";
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
  // Spoken new-order announcement (like Alipay's "到账" voice). Tap cycles the
  // device through Off → 中文 → English; the selected language is spoken.
  voiceTitle: { en: "Spoken new-order announcement", zh: "新订单语音播报", fr: "Annonce vocale des nouvelles commandes" },
  voiceOff: { en: "🔊 Voice: Off", zh: "🔊 播报:关", fr: "🔊 Voix : Arrêt" },
  voiceZh: { en: "🔊 Voice: 中文", zh: "🔊 播报:中文", fr: "🔊 Voix : 中文" },
  voiceEn: { en: "🔊 Voice: English", zh: "🔊 播报:English", fr: "🔊 Voix : English" },
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
  scheduledFor: { en: "for", zh: "预约", fr: "prévu" },
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
  editOrder: { en: "✏️ Edit order", zh: "✏️ 编辑订单", fr: "✏️ Modifier" },
  // 加菜到「已完成」的自取/取餐单(未完成的单用「编辑订单」加菜即可)。
  addDishDone: { en: "＋ Add dish", zh: "＋ 加菜到本单", fr: "＋ Ajouter un plat" },
  mergeOrder: { en: "🔗 Merge order", zh: "🔗 合并订单", fr: "🔗 Fusionner" },
  cancelOrder: { en: "Cancel order", zh: "取消订单", fr: "Annuler la commande" },
  deleteOrder: { en: "Delete", zh: "删除", fr: "Supprimer" },
  // Merge picker
  mergeTitle: { en: "Merge {no} into…", zh: "把 {no} 合并到…", fr: "Fusionner {no} dans…" },
  mergeHint: {
    en: "Its dishes move onto the order you pick; this one is then removed. Sales totals stay correct.",
    zh: "这张单的菜会并入你选择的单,本单随后删除。营业额与菜品销量保持不变。",
    fr: "Ses plats sont déplacés vers la commande choisie ; celle-ci est ensuite supprimée. Les totaux restent corrects.",
  },
  mergeNone: {
    en: "No other order to merge into — need a same-type order in the same state (both done, or both open).",
    zh: "没有可合并的另一张单 —— 需要同类型、且状态相同(都已完成,或都未完成)的单。",
    fr: "Aucune commande compatible — même type et même état (toutes deux terminées ou toutes deux ouvertes).",
  },
  mergeFailed: { en: "Merge failed, retry: ", zh: "合并失败,请重试:", fr: "Échec de la fusion, réessayez : " },
  // Dialogs / alerts
  confirmRefund: {
    en: "This order was paid online for ${amt}. Cancelling will auto-refund the customer. Are you sure?",
    zh: "该订单已在线支付 ${amt},取消将自动退款给顾客。确定吗?",
    fr: "Cette commande a été payée en ligne pour {amt} $. L'annulation remboursera automatiquement le client. Confirmer ?",
  },
  refundFailed: { en: "Refund failed, order not cancelled: ", zh: "退款失败,未取消订单:", fr: "Remboursement échoué, commande non annulée : " },
  refundRetry: { en: "please try again", zh: "请重试", fr: "veuillez réessayer" },
  // First-load states (the [] before the first fetch must never render as the
  // real empty state — see firstLoaded).
  loadFailedTitle: { en: "Couldn't load orders. Check the connection.", zh: "订单加载失败,请检查网络。", fr: "Impossible de charger les commandes. Vérifiez la connexion." },
  loadRetry: { en: "Try again", zh: "重试", fr: "Réessayer" },
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
  billQueued: { en: "Bill sent to the printer.", zh: "账单已送打印机。", fr: "Addition envoyée à l'imprimante." },
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
  // First-load state: [] before the first fetch resolves must render as LOADING,
  // never as the real "no orders yet" empty state (a truck on flaky LTE would
  // read that as "no orders exist"). After the first success, errors keep the
  // last good list silently (the poll recovers on its own).
  const [firstLoaded, setFirstLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"off" | "zh" | "en">("off"); // spoken new-order announcement
  const [preview, setPreview] = useState<Order | null>(null); // kitchen-ticket preview
  const [menuFor, setMenuFor] = useState<string | null>(null); // order id whose ⋯ overflow menu is open
  const [editOrder, setEditOrder] = useState<Order | null>(null); // order open in the back-office editor
  const [mergeFrom, setMergeFrom] = useState<Order | null>(null); // source order being merged INTO another
  // 时价录入 sheet: the order being completed + its un-priced market lines
  // (keys are item indexes). Replaces the old window.prompt-per-item loop.
  const [pricing, setPricing] = useState<{ order: Order; lines: MarketLine[] } | null>(null);
  // 专注模式 right rail: the time-ordered queue. Its open/closed state persists
  // per device so a station iPad reopens the way staff left it.
  const { focus, scale } = useFocus();
  const [railOpen, setRailOpen] = useState(true);
  useEffect(() => {
    try { setRailOpen(localStorage.getItem("bento_lineup_open") !== "off"); } catch { /* ignore */ }
  }, []);
  const toggleRail = (v: boolean) => {
    setRailOpen(v);
    try { localStorage.setItem("bento_lineup_open", v ? "on" : "off"); } catch { /* ignore */ }
  };
  // Ticking clock so the rail's wait labels advance between the 8s polls.
  const [railNow, setRailNow] = useState(() => Date.now());
  useEffect(() => {
    if (!focus) return;
    const id = setInterval(() => setRailNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [focus]);
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
  const [toast, setToast] = useState<{ msg: string; kind: "err" | "ok" } | null>(null);
  const toastErr = (msg: string) => setToast({ msg, kind: "err" });
  const toastOk = (msg: string) => setToast({ msg, kind: "ok" });
  // One pending in-app confirmation (replaces window.confirm — which froze the
  // whole portal + its poll behind an OS dialog).
  const [confirmAsk, setConfirmAsk] = useState<{ body: string; label: string; danger?: boolean; action: () => void | Promise<void> } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 8000);
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
  const voiceRef = useRef<"off" | "zh" | "en">("off"); // mirror of voiceLang for the poll callback

  useEffect(() => {
    try {
      const on = localStorage.getItem("bento_order_sound") === "on";
      setSoundOn(on);
      soundRef.current = on;
      const v = localStorage.getItem("bento_order_voice");
      if (v === "zh" || v === "en") { setVoiceLang(v); voiceRef.current = v; }
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
      if (next === "denied") toastErr(t(T.pushDenied));
      else if (next === "unsupported") toastErr(t(T.pushUnsupported));
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

  // Spoken announcement via the browser's built-in speech synthesis (no audio
  // files, works offline with the OS voices). `lang` picks the utterance's
  // language so the right voice + pronunciation is used.
  const speak = useCallback((lang: "zh" | "en") => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel(); // don't let announcements pile up if orders arrive in a burst
      const phrase = lang === "zh" ? "叮咚，您有新订单" : "New order received";
      const u = new SpeechSynthesisUtterance(phrase);
      u.lang = lang === "zh" ? "zh-CN" : "en-US";
      const match = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang === "zh" ? "zh" : "en"));
      if (match) u.voice = match;
      synth.speak(u);
    } catch {
      /* speech can be blocked/unavailable — degrade silently */
    }
  }, []);

  // Tap cycles Off → 中文 → English → Off. The click is also the user gesture
  // iOS/Safari needs to unlock speech, so we speak the confirmation immediately.
  const cycleVoice = () => {
    const next = voiceLang === "off" ? "zh" : voiceLang === "zh" ? "en" : "off";
    setVoiceLang(next);
    voiceRef.current = next;
    try { localStorage.setItem("bento_order_voice", next); } catch { /* ignore */ }
    if (next !== "off") speak(next);
    else try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  };

  const load = useCallback(async () => {
    try {
      const data = await listOrders(slug);
      setOrders(data);
      setFirstLoaded(true);
      setLoadErr(false);
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
        if (voiceRef.current !== "off") speak(voiceRef.current);
      }
    } catch {
      // After the first successful load: keep the last good list — a transient
      // error must not blank the kitchen screen. BEFORE it: flag the failure,
      // because rendering the real "no orders yet" empty state while the fetch
      // is failing tells staff on a flaky connection that no orders exist.
      if (!inited.current) setLoadErr(true);
    }
  }, [slug, beep, speak]);

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
  // paid orders whose refund-cancel the staff already confirmed in the sheet
  const refundOk = useRef<Set<string>>(new Set());

  const advance = async (o: Order, to: Order["status"]) => {
    if (advancing.current.has(o.id)) return;
    advancing.current.add(o.id);
    try {
      // Cancelling a PAID online order must return the money first (the DB gate
      // lets a paid order be cancelled, so an un-refunded cancel keeps the
      // diner's cash). Refund server-side, then fall through to set 'cancelled'.
      if (to === "cancelled" && o.payment_status === "paid" && (o.order_type === "togo" || o.order_type === "delivery")) {
        // In-app confirm (was window.confirm): first pass opens the sheet and
        // returns; confirming marks the order and re-enters advance(), which
        // then proceeds to the refund below. Same continuation pattern as the
        // 时价 gate.
        if (!refundOk.current.has(o.id)) {
          setConfirmAsk({
            body: t(T.confirmRefund).replace("{amt}", Number(o.total).toFixed(2)),
            label: t(T.cancelOrder),
            danger: true,
            action: () => { refundOk.current.add(o.id); advance(o, "cancelled"); },
          });
          return;
        }
        refundOk.current.delete(o.id);
        const { data: sess } = await supabase.auth.getSession();
        const res = await fetch("/api/pay/refund", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
          body: JSON.stringify({ orderId: o.id }),
        });
        const rd = await res.json().catch(() => ({ ok: false }));
        if (!rd.ok) {
          toastErr(t(T.refundFailed) + (rd.error ?? t(T.refundRetry)));
          return;
        }
      }
      // 时价 gate: an order can't be completed until every market-priced item has
      // its actual price entered. Un-priced items open the MarketPriceSheet (all
      // dishes at once, today's board price prefilled) instead of the old
      // window.prompt-per-item loop, which froze the iPad and the order poll.
      // The sheet's save re-enters advance() with the priced items, so this gate
      // passes on the second run and completion continues normally.
      const items = o.items;
      if (to === "done" && o.status !== "done") {
        const needPricing = items.filter((it) => it.market && !(Number(it.price) > 0) && !(it as any).cancelled);
        if (needPricing.length > 0) {
          // today's reference prices from 菜单设置 (时价更新 panel)
          const menu = await listMenuItems(slug).catch(() => []);
          const menuPrice = new Map(menu.map((m) => [m.id, m.price]));
          setPricing({
            order: o,
            lines: needPricing.map((it) => ({
              key: `${items.indexOf(it)}`,
              name_zh: it.name_zh,
              name_en: it.name_en,
              qty: it.qty,
              prefill: menuPrice.get(it.id),
            })),
          });
          return; // completion resumes from the sheet's onSave
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
          toastErr(t(T.statusFailed) + error);
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
        if (error) toastErr(t(T.statusFailed) + error);
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
      if (error) toastErr(t(T.statusFailed) + error);
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
      if (error) toastErr(t(T.statusFailed) + error);
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

  const orderLabel = (o: Order) => (o.order_no ? `#${o.order_no}` : `#${o.id.slice(0, 4)}`);

  // Orders `src` can merge into: SAME order_type, not cancelled, and the SAME
  // posted-state (both 已完成, or both still open). That restriction is exactly
  // when the merge needs NO sales rewrite — a done order already posted its own
  // dishes + revenue, an open one posts the union at completion — so combining
  // never double-counts or drops a sale (see doMerge).
  const mergeCandidates = (src: Order) =>
    orders.filter(
      (o) =>
        o.id !== src.id &&
        o.order_type === src.order_type &&
        o.status !== "cancelled" &&
        (o.status === "done") === (src.status === "done"),
    );

  // Merge `src` INTO `target`: fold src's active items onto target (summing
  // identical lines so the bill stays tidy), rewrite target's items + total, then
  // delete src. No sales writes — see mergeCandidates for why that's correct.
  const doMerge = async (src: Order, target: Order) => {
    const keyOf = (it: any) => `${it.id}#${it.vi ?? ""}#${it.note ?? ""}`;
    const merged: OrderItem[] = [];
    const idx = new Map<string, number>();
    for (const it of [...(target.items ?? []), ...(src.items ?? [])] as any[]) {
      if (it.cancelled) continue;
      const k = keyOf(it);
      const at = idx.get(k);
      if (at != null) merged[at] = { ...merged[at], qty: merged[at].qty + it.qty };
      else { idx.set(k, merged.length); merged.push({ ...it }); }
    }
    const total = Math.round(merged.reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0) * 100) / 100;
    const { error } = await updateOrderItems(target.id, merged, total);
    if (error) { toastErr(t(T.mergeFailed) + error); return; }
    // Fold the sales ledger when merging two ALREADY-DONE orders (candidates are
    // same-state, so if src is done, target is too): rewrite the survivor's sale
    // row to the merged total and drop src's row — otherwise the day double-counts
    // src's revenue. 菜品销量 is left alone (both dish sets already counted once).
    // Two OPEN orders have no sale rows yet; the survivor posts the union when it
    // completes, so nothing to fold there.
    if (target.status === "done") {
      try {
        await adjustOrderSale(slug, { id: target.id, total, items: merged, source: "qr" });
        await deleteOrderSale(slug, src.id);
      } catch { /* non-blocking: items already merged; ledger self-heals on next edit */ }
    }
    await deleteOrder(src.id);
    setMergeFrom(null);
    load();
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
            {o.order_no && (
              <span className="pill bg-ink text-base font-bold tracking-wider text-white">#{o.order_no}</span>
            )}
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
            {/* Scheduled togo/delivery time (null = ASAP → no badge). Have it ready by then. */}
            {(o.order_type === "togo" || o.order_type === "delivery") && o.requested_pickup_at && (
              <span className="pill bg-amber-100 font-bold text-amber-700" title={t(T.puWhenTitle)}>
                🕐 {t(T.scheduledFor)} {new Date(o.requested_pickup_at).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}
              </span>
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
                    {o.status !== "cancelled" && o.status !== "done" && (
                      <MenuItem onClick={() => setEditOrder(o)}>{t(T.editOrder)}</MenuItem>
                    )}
                    {/* 加菜到「已完成」的自取/取餐单:同一张单继续加菜,补计入统计
                        (见 OrderEditor)。未完成的单用上面的「编辑订单」即可加菜。 */}
                    {(o.order_type === "togo" || o.order_type === "pickup") && o.status === "done" && (
                      <MenuItem onClick={() => setEditOrder(o)}>{t(T.addDishDone)}</MenuItem>
                    )}
                    {/* 合并订单:把顾客拆成两张的自取/取餐/外送单并成一张。 */}
                    {(o.order_type === "togo" || o.order_type === "pickup" || o.order_type === "delivery") && o.status !== "cancelled" && (
                      <MenuItem onClick={() => setMergeFrom(o)}>{t(T.mergeOrder)}</MenuItem>
                    )}
                    {o.status !== "cancelled" && (
                      <MenuItem onClick={async () => { const r = await requestBill(sibs.map((s) => s.id)); if (r.error) toastErr(t(T.printBillFailed) + r.error); else toastOk(t(T.billQueued)); }}>
                        {multi ? t(T.printTableBill) : t(T.printBill)}
                      </MenuItem>
                    )}
                    <MenuItem onClick={async () => { await reprintOrder(o.id); load(); }}>{t(T.reprintKitchen)}</MenuItem>
                    {o.status !== "cancelled" && o.status !== "done" && (
                      <MenuItem danger onClick={() => advance(o, "cancelled")}>{t(T.cancelOrder)}</MenuItem>
                    )}
                    <MenuItem danger onClick={() => setConfirmAsk({ body: t(T.confirmDelete), label: t(T.deleteOrder), danger: true, action: async () => { await deleteOrder(o.id); load(); } })}>{t(T.deleteOrder)}</MenuItem>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const body = (
    <main className={focus ? "min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8" : "px-6 py-8 lg:px-10"}>
      {/* the shell's back-link is redundant in 专注模式 (there's no nav to go back
          to on screen); the exit-fullscreen button is the way out */}
      {!focus && <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← {t(T.overview)}</Link>}
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
          <button
            onClick={cycleVoice}
            title={t(T.voiceTitle)}
            className={`text-sm ${voiceLang !== "off" ? "btn-ghost border border-brand bg-brand-wash text-brand-ink" : "btn-ghost border border-slate-300"}`}
          >
            {voiceLang === "zh" ? t(T.voiceZh) : voiceLang === "en" ? t(T.voiceEn) : t(T.voiceOff)}
          </button>
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
                      if (active.length === 0) { toastOk(t(T.noActive)); return; }
                      setConfirmAsk({
                        body: t(T.confirmReprintAll).replace("{n}", String(active.length)),
                        label: t(T.reprintAll),
                        action: async () => {
                          const n = await reprintActiveOrders(slug);
                          load();
                          toastOk(t(T.reprintedN).replace("{n}", String(n)));
                        },
                      });
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

      {/* FIRST LOAD: skeleton, not the real empty states — and a failed first
          load says so with a retry, instead of masquerading as "no orders". */}
      {!firstLoaded && (
        loadErr ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <p className="text-sm text-ink-soft">{t(T.loadFailedTitle)}</p>
            <button onClick={() => { setLoadErr(false); load(); }} className="btn-primary mt-4 min-h-11 px-6 text-sm">
              {t(T.loadRetry)}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2" aria-label="loading" aria-busy>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4">
                <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="mb-2 h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        )
      )}

      {firstLoaded && view === "dine" && (
        <TableFloor slug={slug} orders={orders} tables={tenant?.tables ?? []} layout={tenant?.tableLayout ?? []} trackPayments={trackPay} dayStartHour={tenant?.dayStartHour ?? 0} onChanged={load} />
      )}

      {firstLoaded && view === "togo" && (
        togoOrders.length === 0 ? (
          renderEmptyWithCta(t(T.emptyTogoTitle))
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{togoOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {firstLoaded && view === "delivery" && (
        deliveryOrders.length === 0 ? (
          renderEmptyWithCta(t(T.emptyDeliveryTitle))
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{deliveryOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {firstLoaded && view === "pickup" && (
        pickupOrders.length === 0 ? (
          <div className="card p-10 text-center text-sm text-ink-faint">{t(T.emptyPickup)}</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">{pickupOrders.map((o) => renderCard(o))}</div>
        )
      )}

      {firstLoaded && view === "market" && <MarketPricePanel slug={slug} />}

      {preview && <KitchenTicket order={preview} shopName={shopName} onClose={() => setPreview(null)} />}

      {/* Takeout/delivery order entry runs the SAME customer menu staff already
          use for table orders (design review D2) — one ordering surface, so what
          staff see matches what the diner sees. The menu pings us via postMessage
          when the order lands; we close and refresh. */}
      {/* 时价录入 — all un-priced market dishes of the completing order in one
          sheet, prefilled from today's board prices. Save applies the prices and
          re-enters advance(), which now passes the gate and completes the order. */}
      {pricing && (
        <MarketPriceSheet
          lines={pricing.lines}
          onCancel={() => setPricing(null)}
          onSave={async (prices) => {
            const p = pricing;
            const updated = (p.order.items ?? []).map((it, i) =>
              prices[String(i)] != null ? { ...it, price: prices[String(i)] } : it,
            );
            const newTotal = updated
              .filter((it: any) => !it.cancelled)
              .reduce((s, it) => s + (Number(it.price) || 0) * it.qty, 0);
            const res = await updateOrderItems(p.order.id, updated as OrderItem[], Math.round(newTotal * 100) / 100);
            if (res.error) throw new Error(res.error); // sheet shows it inline, stays open
            setPricing(null);
            await advance({ ...p.order, items: updated as OrderItem[] }, "done");
          }}
        />
      )}

      {editOrder && (
        <OrderEditor
          slug={slug}
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => { setEditOrder(null); load(); }}
        />
      )}

      {/* Merge picker: pick which order to fold `mergeFrom` INTO. Candidates are
          same-type + same-state so no sales rewrite is needed (see doMerge). */}
      {mergeFrom && (() => {
        const cands = mergeCandidates(mergeFrom);
        return (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:items-center md:justify-center" onClick={() => setMergeFrom(null)}>
            <div className="max-h-[85vh] w-full overflow-hidden rounded-t-2xl bg-white md:max-w-lg md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-lg font-bold text-ink">{t(T.mergeTitle).replace("{no}", orderLabel(mergeFrom))}</h3>
                <button onClick={() => setMergeFrom(null)} aria-label={t(T.close)} className="grid h-9 w-9 place-items-center rounded-full text-ink-faint hover:bg-slate-100">✕</button>
              </div>
              <p className="px-5 pt-3 text-sm text-ink-soft">{t(T.mergeHint)}</p>
              <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
                {cands.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-faint">{t(T.mergeNone)}</p>
                ) : (
                  <div className="grid gap-2">
                    {cands.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => doMerge(mergeFrom, c)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand hover:bg-brand-wash"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            {c.order_no && <span className="pill bg-ink text-sm font-bold tracking-wider text-white">#{c.order_no}</span>}
                            <span className={`pill ${STATUS[c.status].cls}`}>{t(T[STATUS[c.status].key])}</span>
                            <span className="text-xs text-ink-faint">{fmtTime(c.created_at)}</span>
                          </span>
                          <span className="font-semibold text-ink">{fmtPrice(c.total)}</span>
                        </div>
                        <div className="mt-1 truncate text-sm text-ink-soft">
                          {(c.items ?? []).filter((it: any) => !it.cancelled).map((it: any) => `${it.name_zh}×${it.qty}`).join("、")}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
          <div className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${toast.kind === "err" ? "border-red-200 bg-red-50" : "border-brand/30 bg-brand-wash"}`}>
            <span aria-hidden className="text-lg leading-none">{toast.kind === "err" ? "⚠️" : "✅"}</span>
            <p className={`flex-1 text-sm ${toast.kind === "err" ? "text-red-700" : "text-brand-ink"}`}>{toast.msg}</p>
            <button
              onClick={() => setToast(null)}
              aria-label={t(T.close)}
              className={`-my-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg leading-none ${toast.kind === "err" ? "text-red-700 hover:bg-red-100" : "text-brand-ink hover:bg-brand-wash"}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* In-app confirmation (was window.confirm) — blocks only the guarded
          action, never the screen or the order poll behind it. */}
      {confirmAsk && (
        <ConfirmSheet
          body={confirmAsk.body}
          confirmLabel={confirmAsk.label}
          danger={confirmAsk.danger}
          onCancel={() => setConfirmAsk(null)}
          onConfirm={() => { const a = confirmAsk; setConfirmAsk(null); a.action(); }}
        />
      )}
    </main>
  );

  // Normal mode: unchanged. 专注模式: content + the time-ordered queue rail,
  // side by side, filling the viewport the shell just freed up.
  if (!focus) return body;
  return (
    // Height is divided by the 大字 zoom: the shell zooms this subtree, so a
    // plain 100% would render at 118% of the viewport and force a scrollbar.
    // Dividing first means it lands at exactly one screen either way.
    <div className="flex min-h-0 w-full" style={{ height: `${100 / scale}dvh` }}>
      {body}
      <OrderLineup orders={orders} now={railNow} open={railOpen} onToggle={toggleRail} />
    </div>
  );
}
