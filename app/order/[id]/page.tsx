"use client";

// ─────────────────────────────────────────────────────────────────────────
//  Order-ahead PICKUP tracking screen (approved mockup: variant A).
//  URL: /order/[id]?t=<tracking_token>. Anonymous — reads via the token-gated
//  get_order_tracking RPC (public fields only). Polls every 8s; stops when the
//  tab is hidden or the order is picked up. Brand: DESIGN.md (jade / paper).
//
//    received ──▶ preparing ──▶ READY ──▶ picked-up
//      (1)          (2)        (3,ready_at) (4,picked_up_at)
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getTracking, pickupStep, subscribePickupPush, type Tracking, type PickupPushState } from "@/lib/pickup";

const STEPS = [
  { zh: "已接单", en: "Received" },
  { zh: "制作中", en: "Preparing" },
  { zh: "可取餐", en: "Ready" },
  { zh: "已取餐", en: "Picked up" },
];

export default function PickupTracking() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? "";
  const token = search?.get("t") ?? "";

  const [track, setTrack] = useState<Tracking | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");
  const [push, setPush] = useState<PickupPushState | "idle" | "asking">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enableNotify = async () => {
    setPush("asking");
    setPush(await subscribePickupPush(id, token));
  };

  useEffect(() => {
    if (!id || !token) { setState("notfound"); return; }
    let alive = true;

    const poll = async () => {
      const t = await getTracking(id, token);
      if (!alive) return;
      if (!t) { setState("notfound"); return; }
      setTrack(t);
      setState("ok");
      // Stop once picked up; pause while the tab is hidden (save the poll).
      if (t.picked_up_at) return;
      const delay = document.visibilityState === "hidden" ? 30_000 : 8_000;
      timer.current = setTimeout(poll, delay);
    };
    poll();

    const onVis = () => { if (document.visibilityState === "visible") { if (timer.current) clearTimeout(timer.current); poll(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); document.removeEventListener("visibilitychange", onVis); };
  }, [id, token]);

  const step = track ? pickupStep(track) : 1;
  const ready = step >= 3;
  const done = step === 4;
  const total = (track?.items ?? []).reduce((n, it) => n + (Number(it.qty) || 1), 0);

  return (
    <main className="min-h-screen bg-paper px-4 py-8" style={{ fontFamily: '"General Sans", "Noto Sans SC", system-ui, sans-serif' }}>
      <link href="https://api.fontshare.com/v2/css?f[]=general-sans@500,600,700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@500;600;700&display=swap" rel="stylesheet" />

      <div className="mx-auto max-w-[440px] overflow-hidden rounded-2xl border border-[#ECE7DF] bg-white shadow-sm">
        {state === "loading" && <p className="py-24 text-center text-sm text-ink-faint">加载中… Loading…</p>}

        {state === "notfound" && (
          <div className="px-6 py-20 text-center">
            <div className="text-3xl">🔍</div>
            <p className="mt-3 font-semibold text-ink">找不到这张订单 Order not found</p>
            <p className="mt-1 text-sm text-ink-faint">链接可能过期或不完整。The link may be expired or incomplete.</p>
          </div>
        )}

        {state === "ok" && track && (
          <>
            <div className="border-b border-[#ECE7DF] px-6 pt-6 pb-5 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-jade">取餐号 · Your pickup code</div>
              <div className="mt-1 text-6xl font-bold leading-none text-jade" style={{ fontVariantNumeric: "tabular-nums" }}>
                {track.pickup_code || "—"}
              </div>
              {/* student-chosen pickup time (scheduled order-ahead) */}
              {track.requested_pickup_at && !done && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FBF1DE] px-3.5 py-1.5 text-sm font-semibold text-[#8a5a10]">
                  🕐 {new Date(track.requested_pickup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <span className="font-medium">取餐 · pickup time</span>
                </div>
              )}

              {/* 4-step numbered stepper */}
              <div className="mt-6 flex items-start justify-between px-1">
                {STEPS.map((s, i) => {
                  const n = i + 1;
                  const on = n === step;
                  const passed = n < step;
                  return (
                    <div key={s.en} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className={`grid h-8 w-8 place-items-center rounded-full border text-sm font-bold ${on || passed ? "border-jade bg-jade text-white" : "border-slate-300 text-ink-faint"}`}>
                        {passed ? "✓" : n}
                      </span>
                      <span className={`text-center text-[11px] leading-tight ${on ? "font-semibold text-jade" : "text-ink-faint"}`}>{s.zh}<br />{s.en}</span>
                    </div>
                  );
                })}
              </div>
              {/* progress bar */}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E7F1ED]">
                <div className="h-full rounded-full bg-jade transition-all" style={{ width: `${((step - 1) / 3) * 100}%` }} />
              </div>

              {/* headline state */}
              <div className="mt-4">
                {done ? (
                  <p className="text-lg font-bold text-jade">🎉 取餐愉快 · Enjoy!</p>
                ) : ready ? (
                  <p className="text-lg font-bold text-jade">✅ 可以取餐啦 · Ready — come pick up!</p>
                ) : step === 2 ? (
                  <p className="text-sm font-medium text-ink-soft">制作中{track.eta_minutes ? ` · 约 ${track.eta_minutes} 分钟` : ""} · Preparing{track.eta_minutes ? ` · ~${track.eta_minutes} min` : ""}</p>
                ) : (
                  <p className="text-sm font-medium text-ink-soft">已收到订单 · Order received</p>
                )}
              </div>

              {/* Diner opt-in: OS push when it's ready. Hidden once ready/done. */}
              {!ready && (
                push === "on" ? (
                  <p className="mt-4 text-xs font-medium text-jade">🔔 已开启提醒 · You'll be notified when it's ready</p>
                ) : push === "denied" ? (
                  <p className="mt-4 text-xs text-ink-faint">通知已被浏览器屏蔽 · Notifications are blocked in your browser</p>
                ) : push === "unsupported" ? (
                  <p className="mt-4 text-xs text-ink-faint">保持此页开启即可看到进度 · Keep this page open to see updates</p>
                ) : (
                  <button
                    onClick={enableNotify}
                    disabled={push === "asking"}
                    className="mt-4 w-full rounded-xl border border-jade/30 bg-jade/5 py-2.5 text-sm font-semibold text-jade transition hover:bg-jade/10 disabled:opacity-60"
                  >
                    {push === "asking" ? "…" : "🔔 做好通知我 · Notify me when it's ready"}
                    {push === "error" && <span className="ml-1 text-xs font-normal text-ink-faint">(重试 retry)</span>}
                  </button>
                )
              )}
            </div>

            {/* order summary */}
            <div className="px-6 py-4">
              <div className="mb-2 text-xs font-semibold text-ink-faint">{total} 件 · {total} item{total !== 1 ? "s" : ""}</div>
              <div className="space-y-1.5">
                {(track.items ?? []).map((it, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 text-ink">{it.name_zh || it.name_en}{(Number(it.qty) || 1) > 1 && <span className="ml-1 text-ink-faint">×{it.qty}</span>}</span>
                    {it.name_en && it.name_zh && <span className="flex-none text-xs text-ink-faint">{it.name_en}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-[#ECE7DF] bg-[#FAF7F2] px-6 py-3 text-xs text-ink-soft">
              🚚 到餐车取餐 · 有问题我们会电话联系你 · Pick up at the truck — we'll call if there's an issue
            </div>
          </>
        )}
      </div>
    </main>
  );
}
