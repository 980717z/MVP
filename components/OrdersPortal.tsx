"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listOrders, setOrderStatus, type Order } from "@/lib/orders";
import { price as fmtPrice } from "@/lib/format";

const STATUS: Record<Order["status"], { label: string; cls: string }> = {
  new: { label: "新单", cls: "bg-amber-100 text-amber-700" },
  preparing: { label: "备餐中", cls: "bg-blue-100 text-blue-700" },
  done: { label: "已完成", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", cls: "bg-slate-100 text-ink-faint" },
};

const NEXT: Partial<Record<Order["status"], { to: Order["status"]; label: string }>> = {
  new: { to: "preparing", label: "开始备餐" },
  preparing: { to: "done", label: "标记完成" },
};

export default function OrdersPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    listOrders(slug).then(setOrders);
  }, [slug, tick]);

  const advance = async (o: Order, to: Order["status"]) => {
    await setOrderStatus(o.id, to);
    setTick((t) => t + 1);
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
          <span className="pill bg-amber-100 text-amber-700">{active.length} 单待处理</span>
          <button onClick={() => setTick((t) => t + 1)} className="btn-ghost border border-slate-300 text-sm">刷新</button>
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
                  {o.phone && <a href={`tel:${o.phone}`} className="text-sm text-brand hover:underline">📞 {o.phone}</a>}
                </div>
                <span className="text-xs text-ink-faint">{fmtTime(o.created_at)}</span>
              </div>

              <div className="divide-y divide-slate-100">
                {o.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-ink">{it.name_zh} <span className="text-ink-faint">×{it.qty}</span></span>
                    <span className="text-ink-soft">{fmtPrice((Number(it.price) || 0) * it.qty)}</span>
                  </div>
                ))}
              </div>

              {o.note && <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-ink-soft">备注：{o.note}</div>}

              <div className="mt-3 flex items-center justify-between">
                <span className="font-semibold text-ink">合计 {fmtPrice(o.total)}</span>
                <div className="flex gap-2">
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
    </main>
  );
}
