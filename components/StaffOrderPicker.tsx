"use client";

import { useEffect, useRef, useState } from "react";
import { displayTable } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

// Staff ordering reuses the REAL customer menu (in an iframe) so it's identical
// pixel-for-pixel — no separate picker to keep in sync. `?t=<table>` locks the
// order to the table (dine-in, phone optional); `?m=togo` takes takeout/delivery;
// `?staff=1` makes the menu ping us when the order lands (or fails) so we can
// close, refresh, and surface errors OUT here where staff are actually looking.
const T: Record<string, Dict> = {
  title: { zh: "点单 · 桌", en: "Order · Table", fr: "Commander · Table" },
  titleTogo: { zh: "新建订单", en: "New order", fr: "Nouvelle commande" },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
  loading: { zh: "正在打开菜单…", en: "Opening the menu…", fr: "Ouverture du menu…" },
  loadFailed: {
    zh: "菜单加载失败,请检查网络后重试。",
    en: "The menu didn't load. Check the connection and try again.",
    fr: "Le menu n'a pas pu se charger. Vérifiez la connexion et réessayez.",
  },
  retry: { zh: "重试", en: "Try again", fr: "Réessayer" },
  orderFailed: { zh: "下单失败:", en: "Order failed: ", fr: "Échec de la commande : " },
};

/** If the menu hasn't loaded in this long, treat it as broken and offer a retry
 *  rather than leaving staff staring at a blank rectangle mid-service. */
const LOAD_TIMEOUT_MS = 15_000;

/**
 * Two entry points, one ordering surface (design review D2/D4):
 *   • `tableNo` → dine-in, locked to that table (`?t=`), opened from the floor plan.
 *   • `mode="togo"` → takeout/delivery (`?m=togo`), opened from 新建订单.
 * Both run the REAL customer menu, so staff see exactly what the diner sees.
 */
export default function StaffOrderPicker({
  slug,
  tableNo,
  mode = "dine",
  orderType,
  onClose,
  onPlaced,
}: {
  slug: string;
  tableNo?: string;
  mode?: "dine" | "togo";
  /** Preselects 自取 vs 配送 so staff aren't asked a question the tab they came
   *  from already answered. They can still switch inside the menu. */
  orderType?: "togo" | "delivery";
  onClose: () => void;
  /** `orderType` is what the menu actually created (togo / delivery / dine_in),
   *  so the caller can jump to the matching tab. Optional — the dine-in caller
   *  ignores it. */
  onPlaced: (orderType?: string) => void;
}) {
  const { t } = useLang();
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [submitErr, setSubmitErr] = useState("");
  // Bumping this remounts the iframe, which is how "try again" re-fetches.
  const [attempt, setAttempt] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      // Same-origin embed: ignore anything from another origin so a stray window
      // can't fake "order placed" and make us close on an order that never was.
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "bento-staff-order-placed") onPlaced(e.data.orderType);
      else if (e.data?.type === "bento-staff-order-failed") {
        setSubmitErr(String(e.data.message ?? ""));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onPlaced]);

  // Esc closes, and focus starts on the close button so keyboard users aren't
  // dropped straight into the iframe with no way out.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A menu that never loads must not look like a menu that's still loading.
  useEffect(() => {
    if (phase !== "loading") return;
    const id = setTimeout(() => setPhase("error"), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [phase, attempt]);

  const retry = () => { setSubmitErr(""); setPhase("loading"); setAttempt((n) => n + 1); };

  const src =
    mode === "togo"
      ? `/menu/${encodeURIComponent(slug)}?m=togo&staff=1${orderType ? `&type=${orderType}` : ""}`
      : `/menu/${encodeURIComponent(slug)}?t=${encodeURIComponent(tableNo ?? "")}&staff=1`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true">
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <span className="text-base font-bold text-ink">
          {mode === "togo" ? t(T.titleTogo) : `${t(T.title)} ${displayTable(tableNo ?? "")}`}
        </span>
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label={t(T.close)}
          className="grid h-11 w-11 place-items-center rounded-lg text-lg text-ink-faint hover:bg-slate-50"
        >
          ✕
        </button>
      </div>

      {/* Submit failure, surfaced OUT here. Inside the iframe it would be an
          alert the parent never sees, leaving the picker looking healthy while
          the order silently didn't happen. */}
      {submitErr && (
        <div role="alert" className="flex flex-none items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-3">
          <span aria-hidden className="text-lg leading-none">⚠️</span>
          <p className="flex-1 text-sm text-red-700">{t(T.orderFailed)}{submitErr}</p>
          <button
            onClick={() => setSubmitErr("")}
            aria-label={t(T.close)}
            className="-my-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg leading-none text-red-700 hover:bg-red-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {phase !== "error" && (
          <iframe
            key={attempt}
            src={src}
            title="staff order"
            onLoad={() => setPhase("ready")}
            className="h-full w-full border-0"
          />
        )}

        {/* Loading: skeleton shaped like the menu (rail + dish rows), not a
            spinner on blank — staff can see WHAT is coming. */}
        {phase === "loading" && (
          <div className="absolute inset-0 flex gap-3 bg-white p-4" aria-hidden>
            <div className="hidden w-28 flex-none flex-col gap-2 sm:flex">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
                  <div className="h-9 w-9 flex-none animate-pulse rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
        )}
        {phase === "loading" && (
          <p role="status" aria-live="polite" className="absolute inset-x-0 bottom-6 text-center text-sm text-ink-faint">
            {t(T.loading)}
          </p>
        )}

        {/* Error: say what happened and give one way out. Never a blank box. */}
        {phase === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-white px-6">
            <div role="alert" className="max-w-sm text-center">
              <p className="text-sm text-ink-soft">{t(T.loadFailed)}</p>
              <button onClick={retry} className="btn-primary mt-4 inline-flex min-h-11 items-center px-6 text-sm">
                {t(T.retry)}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
