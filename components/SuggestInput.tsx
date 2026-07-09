"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/app/i18n";

/** Free-text field with a custom suggestion dropdown remembering past values —
 *  each suggestion has its own ✕ to drop it from the list (native <datalist>
 *  can't do per-item delete). Used anywhere a "select" field should instead
 *  learn its options from what merchants actually type (e.g. 食品安全 类别/记录人,
 *  设备维护 设备). */
export default function SuggestInput({
  value,
  onChange,
  suggestions,
  onRemoveSuggestion,
  placeholder,
  t,
  labelFor,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  onRemoveSuggestion: (s: string) => void;
  placeholder?: string;
  /** Localizer for chrome text (the ✕ button's aria-label). Defaults to zh for single-language pages. */
  t?: (d: Dict) => string;
  /** Display label for a suggestion, when it differs from the stored value
   *  (e.g. a category whose canonical value is always `zh`, translated for
   *  display). Clicking a suggestion still stores the raw value, not the
   *  label. Defaults to showing the value as-is. */
  labelFor?: (value: string) => string;
}) {
  const label = t ?? ((d: Dict) => d.zh);
  const display = labelFor ?? ((s: string) => s);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const filtered = suggestions.filter(
    (s) => !value.trim() || display(s).toLowerCase().includes(value.trim().toLowerCase()),
  );

  return (
    <div className="relative" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map((s) => (
            <div key={s} className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-slate-50">
              <button
                type="button"
                className="flex-1 truncate text-left text-ink-soft"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
              >
                {display(s)}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSuggestion(s);
                }}
                className="ml-2 shrink-0 text-ink-faint hover:text-red-600"
                aria-label={label({ zh: "删除", en: "Delete", fr: "Supprimer" })}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
