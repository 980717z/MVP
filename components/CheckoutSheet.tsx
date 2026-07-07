"use client";

import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
//  Checkout sheet — the diner picks how to pay, then pays. Two flow families:
//   • INSTANT, in-sheet (Clover): Apple Pay + Google Pay (their own rendered
//     buttons — must stay the real branded buttons) and a card form.
//   • HAND-OFF (AlphaPay): 微信支付 / 支付宝 — deep-link into the app or scan a
//     QR, async confirmation. Wired once the AlphaPay account is live.
//  Cards never touch our page/server (PCI). Diner-facing → DESIGN.md
//  (jade/paper, General Sans + Noto Sans SC, 440px).
//
//  IMPORTANT: the Clover-mounted elements (wallet buttons + card iframes) are
//  mounted ONCE and kept in the DOM; the "select" vs "card" views only toggle
//  their visibility with CSS. Conditionally unmounting them would orphan the
//  iframes and force a re-tokenize.
// ─────────────────────────────────────────────────────────────────────────

// Flip on once the AlphaPay routes + creds are live (like PAYMENTS_LIVE for Clover).
const ALPHAPAY_LIVE = process.env.NEXT_PUBLIC_ALPHAPAY_LIVE === "1";

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

function Mark({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <span className="grid h-9 w-9 flex-none place-items-center rounded-lg text-sm font-bold text-white" style={{ background: bg }}>
      {children}
    </span>
  );
}

function MethodRow({ mark, name, sub, badge, onClick }: { mark: React.ReactNode; name: string; sub: string; badge?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 active:bg-slate-50">
      {mark}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink">{name}</div>
        <div className="text-[11px] text-ink-faint">{sub}</div>
      </div>
      {badge ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-ink-faint">{badge}</span> : <span className="text-ink-faint">›</span>}
    </button>
  );
}

export default function CheckoutSheet({
  orderId,
  amount,
  lang,
  onPaid,
  onClose,
}: {
  orderId: string;
  amount: number;
  lang: "zh" | "en";
  onPaid: (info: { last4?: string; brand?: string; method?: string }) => void;
  onClose: () => void;
}) {
  const cloverRef = useRef<any>(null);
  const [view, setView] = useState<"select" | "card">("select");
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [appleOk, setAppleOk] = useState(false);
  const [googleOk, setGoogleOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Quote-then-pay: the server's authoritative total (cents). We display exactly
  // this and send it back on charge so we're never billed above what's shown.
  const [quote, setQuote] = useState<{ cents: number; amount: number } | null>(null);
  const quoteRef = useRef<{ cents: number; amount: number } | null>(null);
  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const shownAmount = quote?.amount ?? amount; // optimistic prop until the quote lands
  const fieldCls = `h-11 overflow-hidden rounded-lg border border-slate-300 [&_iframe]:!h-11 [&_iframe]:!w-full ${ready ? "" : "animate-pulse bg-slate-50"}`;
  const soon = !ALPHAPAY_LIVE;

  const chargeWithToken = async (token: string, method: string): Promise<boolean> => {
    setErr(null);
    const res = await fetch("/api/pay/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, token, quotedCents: quoteRef.current?.cents }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({ ok: false })) : { ok: false, error: t("网络错误", "Network error") };
    if (data.ok) {
      onPaid({ last4: data.last4, brand: data.brand, method });
      return true;
    }
    // Ambiguous/awaiting-confirmation: money may have moved — do NOT invite a retry.
    if (data.reconcile || data.pending || data.inProgress) {
      setErr(data.error || t("支付确认中，请勿重复支付", "Confirming your payment — please don't pay again"));
      return false;
    }
    setErr(data.error || t("支付失败，请重试", "Payment failed — please try again"));
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    const env = process.env.NEXT_PUBLIC_CLOVER_ENV || "sandbox";
    const pub = process.env.NEXT_PUBLIC_CLOVER_PUBLIC_KEY;
    const mid = process.env.NEXT_PUBLIC_CLOVER_MERCHANT_ID;
    if (!pub || !mid) {
      setErr(t("在线支付尚未开通", "Online payment isn't set up yet"));
      return;
    }
    const onApplePaymentMethod = async (e: any) => {
      try {
        const token = e?.detail?.tokenRecieved?.id || e?.detail?.token;
        if (!token) return;
        const ok = await chargeWithToken(token, "apple_pay");
        cloverRef.current?.updateApplePaymentStatus?.(ok ? "success" : "failed");
      } catch {
        /* card is the fallback */
      }
    };

    // Fetch the authoritative amount first — wallet buttons must carry the real
    // charge total, so we can't build them until the quote lands.
    const fetchQuote = fetch("/api/pay/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: t("网络错误", "Network error") }));

    Promise.all([loadCloverSdk(env), fetchQuote])
      .then(([, q]: [void, any]) => {
        if (cancelled) return;
        if (!q?.ok || typeof q.cents !== "number") {
          setErr(q?.error || t("无法获取金额，请刷新重试", "Couldn't load the amount — please refresh"));
          return;
        }
        const qCents = q.cents as number;
        quoteRef.current = { cents: qCents, amount: q.amount };
        setQuote({ cents: qCents, amount: q.amount });

        const Clover = (window as any).Clover;
        const clover = new Clover(pub, { merchantId: mid });
        cloverRef.current = clover;
        const elements = clover.elements();
        const style = { input: { fontSize: "16px", fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif', color: "#1C1B19" } };
        elements.create("CARD_NUMBER", style).mount("#cc-number");
        elements.create("CARD_DATE", style).mount("#cc-date");
        elements.create("CARD_CVV", style).mount("#cc-cvv");
        elements.create("CARD_POSTAL_CODE", style).mount("#cc-postal");
        setReady(true);

        let any = false;
        try {
          const apReq = clover.createApplePaymentRequest?.({ amount: qCents, countryCode: "CA", currencyCode: "CAD" });
          if (apReq) {
            elements.create("PAYMENT_REQUEST_BUTTON_APPLE_PAY", { applePaymentRequest: apReq, sessionIdentifier: mid }).mount("#apple-pay-button");
            window.addEventListener("paymentMethod", onApplePaymentMethod);
            any = true;
          }
        } catch {
          /* Apple Pay unavailable */
        }
        try {
          const grBtn = elements.create("PAYMENT_REQUEST_BUTTON", {
            paymentReqData: { total: { label: "BentoOS", amount: qCents }, options: { button: { buttonType: "long" } } },
          });
          grBtn.mount("#google-pay-button");
          grBtn.addEventListener?.("paymentMethod", async (d: any) => {
            const token = d?.token || d?.tokenRecieved?.id || d?.detail?.tokenRecieved?.id || d?.detail?.token;
            if (token) await chargeWithToken(token, "google_pay");
          });
          any = true;
        } catch {
          /* Google Pay unavailable */
        }
        if (any) {
          const watch = (id: string, setOk: (v: boolean) => void) => {
            const el = document.getElementById(id);
            if (!el) return null;
            if (el.childElementCount > 0) {
              setOk(true);
              return null;
            }
            const obs = new MutationObserver(() => {
              if (!cancelled && el.childElementCount > 0) {
                setOk(true);
                obs.disconnect();
              }
            });
            obs.observe(el, { childList: true });
            return obs;
          };
          const obsA = watch("apple-pay-button", setAppleOk);
          const obsG = watch("google-pay-button", setGoogleOk);
          // Stop watching after a bit — a wallet that hasn't mounted by now
          // isn't available on this device; its row simply never appears.
          setTimeout(() => {
            obsA?.disconnect();
            obsG?.disconnect();
          }, 4000);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setErr(t("支付组件加载失败，请刷新重试", "Couldn't load the payment form — please refresh"));
      });

    return () => {
      cancelled = true;
      window.removeEventListener("paymentMethod", onApplePaymentMethod);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payCard = async () => {
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
      const ok = await chargeWithToken(token, "card");
      if (!ok) setPaying(false);
    } catch {
      setErr(t("网络错误，请重试", "Network error — please try again"));
      setPaying(false);
    }
  };

  // WeChat / Alipay → AlphaPay hand-off (deep-link on mobile, QR on desktop).
  const payAlpha = (method: "wechat" | "alipay") => {
    if (!ALPHAPAY_LIVE) {
      setNotice(t("微信支付 / 支付宝即将开通，暂请用银行卡或 Apple/Google Pay", "WeChat Pay / Alipay coming soon — please use a card or Apple/Google Pay for now"));
      return;
    }
    window.location.href = `/api/pay/alphapay?orderId=${orderId}&method=${method}`;
  };

  // Reveal a wallet button only once it actually mounts (appleOk/googleOk flip
  // the instant Clover renders it). We never reserve space for a wallet that
  // may not come — no empty placeholder boxes during the check window.
  const walletsVisible = appleOk || googleOk;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div className="mx-auto w-full max-w-[440px] rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-lg font-bold text-ink">
            {view === "card" && (
              <button onClick={() => { setView("select"); setErr(null); }} className="text-2xl leading-none text-ink-faint" aria-label="back">‹</button>
            )}
            {view === "card" ? t("银行卡支付", "Pay by card") : t("选择支付方式", "Choose payment")}
          </div>
          <button onClick={onClose} className="text-ink-faint" aria-label="close">✕</button>
        </div>
        <div className="mb-4 flex items-baseline justify-between rounded-lg bg-jade-wash px-3 py-2">
          <span className="text-sm text-ink-soft">{t("应付", "Amount due")}</span>
          <span className="text-xl font-bold tabular-nums text-jade">${shownAmount.toFixed(2)}</span>
        </div>

        {/* Clover wallet buttons — mounted once, visible only in the select view */}
        <div className={view === "select" && walletsVisible ? "mb-2.5 space-y-2" : "hidden"}>
          <div id="apple-pay-button" className={`h-11 overflow-hidden rounded-lg [&_iframe]:!h-11 [&_iframe]:!w-full ${appleOk ? "" : "hidden"}`} />
          <div id="google-pay-button" className={`h-11 overflow-hidden rounded-lg [&_iframe]:!h-11 [&_iframe]:!w-full ${googleOk ? "" : "hidden"}`} />
        </div>

        {/* Card iframes — mounted once, visible only in the card view */}
        <div className={view === "card" ? "space-y-2.5" : "hidden"}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">{t("卡号", "Card number")}</label>
            <div id="cc-number" className={fieldCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">{t("有效期", "Expiry")}</label>
              <div id="cc-date" className={fieldCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">CVV</label>
              <div id="cc-cvv" className={fieldCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">{t("邮编（可选）", "Postal (optional)")}</label>
            <div id="cc-postal" className={fieldCls} />
          </div>
        </div>

        {/* select-view rows (no iframes → safe to conditionally render) */}
        {view === "select" && (
          <div className="space-y-2.5">
            <MethodRow mark={<Mark bg="#07C160">微</Mark>} name="微信支付" sub="WeChat Pay" badge={soon ? t("即将开通", "Soon") : undefined} onClick={() => payAlpha("wechat")} />
            <MethodRow mark={<Mark bg="#1677FF">支</Mark>} name="支付宝" sub="Alipay" badge={soon ? t("即将开通", "Soon") : undefined} onClick={() => payAlpha("alipay")} />
            <MethodRow mark={<Mark bg="#117A65">💳</Mark>} name={t("银行卡", "Credit / Debit card")} sub="Visa · Mastercard · AMEX" onClick={() => { setView("card"); setNotice(null); }} />
            {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">{notice}</p>}
            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>
        )}

        {/* card-view pay button */}
        {view === "card" && (
          <>
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <button onClick={payCard} disabled={!ready || paying} className="mt-4 w-full rounded-lg bg-jade py-3 font-medium text-white transition hover:opacity-90 disabled:opacity-50">
              {paying ? t("支付中…", "Processing…") : `${t("确认支付", "Pay")} $${shownAmount.toFixed(2)}`}
            </button>
          </>
        )}

        <p className="mt-3 text-center text-[11px] text-ink-faint">
          🔒 {t("由 Clover / AlphaPay 安全处理，本店不保存卡号", "Secured by Clover / AlphaPay — your card is never stored")}
        </p>
      </div>
    </div>
  );
}
