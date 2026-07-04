"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listOrders, setOrderStatus, cancelOrderItem, deleteOrder, reprintOrder, type Order } from "@/lib/orders";
import { postOrderSales, recordOrderSale, syncMemberFromOrder, getTenant } from "@/lib/store";
import { price as fmtPrice } from "@/lib/format";
import KitchenTicket from "@/components/KitchenTicket";

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  new: { label: "新单", cls: "bg-amber-100 text-amber-700" },
  preparing: { label: "备餐中", cls: "bg-blue-100 text-blue-700" },
  delivering: { label: "配送中", cls: "bg-violet-100 text-violet-700" },
  done: { label: "已完成", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", cls: "bg-slate-100 text-ink-faint" },
};

const NEXT: Partial<Record<Order["status"], { to: Order["status"]; label: string }>> = {
  new: { to: "preparing", label: "开始备餐" },
  preparing: { to: "done", label: "标记完成" }, // delivery orders get 开始配送 instead (T7)
  delivering: { to: "done", label: "已送达" },
};

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [preview, setPreview] = useState<Order | null>(null); // kitchen-ticket preview
  const [shopName, setShopName] = useState("富来小厨");

  useEffect(() => {
    getTenant(slug).then((t) => t?.name?.zh && setShopName(t.name.zh)).catch(() => {});
  }, [slug]);

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
      document.title = on ? `🔔 ${unread} 新订单` : baseTitle.current;
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

  const advance = async (o: Order, to: Order["status"]) => {
    await setOrderStatus(o.id, to);
    // Post sales into 菜品销量与毛利 once, only on the transition into "done".
    if (to === "done" && o.status !== "done") {
      const activeItems = o.items.filter((it: any) => !it.cancelled);
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
    load();
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const active = orders.filter((o) => o.status === "new" || o.status === "preparing");

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>
      <header className="mt-3 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{mod.icon} {mod.label.zh}</h1>
          <p className="mt-1 text-sm text-ink-soft">{mod.pain.zh}</p>
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && <span className="pill bg-red-100 text-red-700">🔔 {unread} 个新订单</span>}
          <span className="pill bg-amber-100 text-amber-700">{active.length} 单待处理</span>
          {!soundOn && (
            <button onClick={enableSound} className="btn-ghost border border-slate-300 text-sm" title="新订单提示音">
              🔔 开启提示音
            </button>
          )}
          <button onClick={() => setPreview(SAMPLE_ORDER)} className="btn-ghost border border-slate-300 text-sm" title="看看小票长什么样">🖨️ 出单样张</button>
          <button onClick={refresh} className="btn-ghost border border-slate-300 text-sm">刷新</button>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-faint">
          还没有订单。顾客通过「📱 二维码菜单」下单后，会实时出现在这里。
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => (
            <div key={o.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`pill ${STATUS[o.status].cls}`}>{STATUS[o.status].label}</span>
                  {o.table_no && <span className="text-sm font-medium text-ink">桌号 {o.table_no}</span>}
                  {o.phone && (
                    <a href={`tel:${o.phone.replace(/[^0-9+]/g, "")}`} className="text-sm text-brand hover:underline">
                      📞 {fmtPhone(o.phone)}
                    </a>
                  )}
                </div>
                <span className="text-xs text-ink-faint">{fmtTime(o.created_at)}</span>
              </div>

              <div className="divide-y divide-slate-100">
                {o.items.map((it: any, i: number) => (
                  <div key={i} className={`flex items-center justify-between py-1.5 text-sm ${it.cancelled ? "opacity-40" : ""}`}>
                    <span className={it.cancelled ? "line-through text-ink-faint" : "text-ink"}>
                      {it.name_zh} <span className="text-ink-faint">×{it.qty}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={it.cancelled ? "line-through text-ink-faint" : "text-ink-soft"}>
                        {fmtPrice((Number(it.price) || 0) * it.qty)}
                      </span>
                      {!it.cancelled && o.status !== "done" && o.status !== "cancelled" && (
                        <button
                          className="text-xs text-ink-faint hover:text-red-600"
                          onClick={async () => {
                            await cancelOrderItem(o.id, i);
                            load();
                          }}
                        >
                          取消
                        </button>
                      )}
                      {it.cancelled && <span className="text-xs text-red-400">已取消</span>}
                    </span>
                  </div>
                ))}
              </div>

              {o.note && <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-ink-soft">备注：{o.note}</div>}

              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-ink">合计 {fmtPrice(o.total)}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPreview(o)} className="rounded-full bg-brand-wash px-3 py-1.5 text-xs font-semibold text-brand-ink">🖨️ 出单预览</button>
                  <button
                    onClick={async () => { await reprintOrder(o.id); load(); }}
                    className="text-xs text-ink-faint hover:text-brand-ink"
                    title="让打印机重新出这单"
                  >
                    重打
                  </button>
                  <button
                    className="text-xs text-ink-faint hover:text-red-600"
                    onClick={async () => { if (confirm("确定删除这个订单？")) { await deleteOrder(o.id); load(); } }}
                  >
                    删除
                  </button>
                  {o.status !== "cancelled" && o.status !== "done" && (
                    <button onClick={() => advance(o, "cancelled")} className="text-xs text-ink-faint hover:text-red-600">取消</button>
                  )}
                  {NEXT[o.status] && (
                    <button onClick={() => advance(o, NEXT[o.status]!.to)} className="btn-primary px-3 py-1.5 text-xs">
                      {NEXT[o.status]!.label}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && <KitchenTicket order={preview} shopName={shopName} onClose={() => setPreview(null)} />}
    </main>
  );
}
