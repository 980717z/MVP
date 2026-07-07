"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
//  Clover hosted-iframe card form. The card fields are Clover-hosted iframes
//  (PCI: the card number never touches our page or server). On pay we tokenize
//  client-side (public key) → POST {orderId, token} to /api/pay/charge, which
//  re-prices and charges server-side. Diner-facing → follows DESIGN.md (jade/paper).
// ─────────────────────────────────────────────────────────────────────────

const sdkUrl = (env: string) =>
  ["prod", "production", "live"].includes(env)
    ? "https://checkout.clover.com/sdk.js"
    : "https://checkout.sandbox.dev.clover.com/sdk.js";

let sdkPromise: Promise<void> | null = null;
function loadCloverSdk(env: string): Promise<void> {
  if (typeof window !== "undefined" && (window as any).Clover) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = sdkUrl(env);
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("SDK load failed"));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export default function CloverPayment({
  orderId,
  amount,
  lang,
  onPaid,
  onClose,
}: {
  orderId: string;
  amount: number;
  lang: "zh" | "en";
  onPaid: (info: { last4?: string; brand?: string }) => void;
  onClose: () => void;
}) {
  const cloverRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);

  useEffect(() => {
    let cancelled = false;
    const env = process.env.NEXT_PUBLIC_CLOVER_ENV || "sandbox";
    const pub = process.env.NEXT_PUBLIC_CLOVER_PUBLIC_KEY;
    const mid = process.env.NEXT_PUBLIC_CLOVER_MERCHANT_ID;
    if (!pub || !mid) {
      setErr(t("在线支付尚未开通", "Online payment isn't set up yet"));
      return;
    }
    loadCloverSdk(env)
      .then(() => {
        if (cancelled) return;
        const Clover = (window as any).Clover;
        const clover = new Clover(pub, { merchantId: mid });
        cloverRef.current = clover;
        const elements = clover.elements();
        const style = { input: { fontSize: "16px", fontFamily: '"General Sans","Noto Sans SC",sans-serif' } };
        elements.create("CARD_NUMBER", style).mount("#cc-number");
        elements.create("CARD_DATE", style).mount("#cc-date");
        elements.create("CARD_CVV", style).mount("#cc-cvv");
        elements.create("CARD_POSTAL_CODE", style).mount("#cc-postal");
        setReady(true);
      })
      .catch(() => !cancelled && setErr(t("支付组件加载失败，请刷新重试", "Couldn't load the card form — please refresh")));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    if (!cloverRef.current) return;
    setErr(null);
    setPaying(true);
    try {
      const result = await cloverRef.current.createToken();
      if (result?.errors) {
        setErr(Object.values(result.errors).filter(Boolean).join("；") || t("卡信息有误", "Card details are invalid"));
        setPaying(false);
        return;
      }
      const token = result?.token;
      if (!token) {
        setErr(t("请检查卡号、有效期和 CVV", "Please check the card number, expiry and CVV"));
        setPaying(false);
        return;
      }
      const res = await fetch("/api/pay/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        onPaid({ last4: data.last4, brand: data.brand });
      } else {
        setErr(data.error || t("支付失败，请重试", "Payment failed — please try again"));
        setPaying(false);
      }
    } catch {
      setErr(t("网络错误，请重试", "Network error — please try again"));
      setPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="mx-auto w-full max-w-[440px] rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-bold text-ink">{t("在线支付", "Pay online")}</div>
          <button onClick={onClose} className="text-ink-faint" aria-label="close">✕</button>
        </div>
        <div className="mb-3 flex items-baseline justify-between rounded-lg bg-jade-wash px-3 py-2">
          <span className="text-sm text-ink-soft">{t("应付", "Amount due")}</span>
          <span className="text-xl font-bold tabular-nums text-jade">${amount.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          <div id="cc-number" className="min-h-[46px] rounded-lg border border-slate-300 px-3 py-3" />
          <div className="grid grid-cols-2 gap-2">
            <div id="cc-date" className="min-h-[46px] rounded-lg border border-slate-300 px-3 py-3" />
            <div id="cc-cvv" className="min-h-[46px] rounded-lg border border-slate-300 px-3 py-3" />
          </div>
          <div id="cc-postal" className="min-h-[46px] rounded-lg border border-slate-300 px-3 py-3" />
        </div>
        {!ready && !err && <p className="mt-2 text-center text-xs text-ink-faint">{t("正在加载安全支付…", "Loading secure form…")}</p>}
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button
          onClick={pay}
          disabled={!ready || paying}
          className="mt-4 w-full rounded-lg bg-jade py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {paying ? t("支付中…", "Processing…") : `${t("确认支付", "Pay")} $${amount.toFixed(2)}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          🔒 {t("由 Clover 安全处理，本店不保存卡号", "Secured by Clover — your card is never stored")}
        </p>
      </div>
    </div>
  );
}
