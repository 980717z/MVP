"use client";

// In-app replacement for window.confirm() in the service surfaces. A native
// confirm freezes the whole portal (and its 8s order poll) behind an OS dialog
// staff must dismiss one-handed mid-rush — and Chrome eventually offers
// "suppress dialogs", which would silently kill every future confirmation.
// This sheet blocks only the action it guards, never the screen behind it.
import { useEffect, useRef } from "react";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  cancel: { zh: "取消", en: "Cancel", fr: "Annuler" },
  close: { zh: "关闭", en: "Close", fr: "Fermer" },
};

export default function ConfirmSheet({
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
}: {
  body: string;
  confirmLabel: string;
  /** Destructive actions (delete / cancel order / refund) render the confirm red. */
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLang();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus starts on CANCEL (never the destructive action), Esc backs out.
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" role="alertdialog" aria-modal="true" aria-label={body}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <p className="text-sm leading-relaxed text-ink">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-ink-soft">
            {t(T.cancel)}
          </button>
          <button
            onClick={onConfirm}
            className={`min-h-11 rounded-lg px-5 text-sm font-semibold text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-brand hover:bg-brand-strong"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
