"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listMenuItems, updateMenuItem, type MenuItem } from "@/lib/menu";
import { price as fmtPrice } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

const T: Record<string, Dict> = {
  hint: {
    zh: "开市先设今日海鲜价 —— 下单时顾客可见，结账自动带出。称重活鲜可留空，结账时再录。",
    en: "Set today's market prices at open — diners see them when ordering, and checkout fills them in. Leave weighed live seafood blank and price it at checkout.",
    fr: "Fixez les prix du jour à l'ouverture — visibles à la commande, repris à l'encaissement. Laissez vide le vivant pesé, à saisir à l'encaissement.",
  },
  none: { zh: "没有时价菜品。在「菜单设置」把菜标为时价后会出现在这里。", en: "No market-price dishes. Mark a dish as 时价 in Menu settings and it shows up here.", fr: "Aucun plat à prix du jour. Marquez-en un dans les réglages du menu." },
  save: { zh: "保存", en: "Save", fr: "Enregistrer" },
  saved: { zh: "已保存", en: "Saved", fr: "Enregistré" },
  today: { zh: "今日价", en: "Today's price", fr: "Prix du jour" },
  clear: { zh: "清空", en: "Clear", fr: "Effacer" },
};

export default function MarketPricePanel({ slug }: { slug: string }) {
  const { t } = useLang();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Last value persisted per dish. Blur-save compares against this so tabbing
  // through a row you didn't touch doesn't fire a pointless write, and so a
  // background refresh can tell "clean" fields from ones being typed into.
  const persisted = useRef<Record<string, string>>({});

  // The list is is_market-filtered on every load, so a dish newly marked 时价 in
  // 菜单设置 shows up here on its own — there is no second list to maintain.
  const load = useCallback(
    () =>
      listMenuItems(slug)
        .then((all) => {
          const mkt = all.filter((m) => m.is_market);
          const fresh = Object.fromEntries(
            mkt.map((m) => [m.id, m.price != null && m.price > 0 ? String(m.price) : ""]),
          );
          setItems(mkt);
          setDraft((prev) => {
            // Never clobber a field someone is mid-way through typing: keep any
            // draft that diverges from what we last persisted, take the server's
            // value for everything else.
            const next = { ...fresh };
            for (const [id, val] of Object.entries(prev)) {
              if (val !== (persisted.current[id] ?? "")) next[id] = val;
            }
            return next;
          });
          persisted.current = fresh;
        })
        .catch(() => {}),
    [slug],
  );

  useEffect(() => { load(); }, [load]);

  // Prices get set at open, often from a phone, while this tab sits open on the
  // till. Without this the till shows a stale list — a dish marked 时价 an hour
  // ago simply isn't there until someone reloads the page.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  const save = async (m: MenuItem) => {
    const raw = (draft[m.id] ?? "").trim();
    // Nothing changed since the last write — blur fires on every field you tab
    // through, so bail before hitting the network.
    if (raw === (persisted.current[m.id] ?? "")) return;
    const price = raw === "" ? null : Math.round(parseFloat(raw) * 100) / 100;
    if (raw !== "" && !(Number(price) >= 0)) return;
    setSavingId(m.id);
    await updateMenuItem(m.id, { price });
    persisted.current = { ...persisted.current, [m.id]: raw };
    setSavingId(null);
    setSavedId(m.id);
    setTimeout(() => setSavedId((s) => (s === m.id ? null : s)), 1500);
  };

  return (
    <div>
      <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">💰 {t(T.hint)}</div>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-faint">{t(T.none)}</div>
      ) : (
        <div className="grid gap-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{m.name_zh}</div>
                {m.name_en && m.name_en !== m.name_zh && <div className="truncate text-xs text-ink-faint">{m.name_en}</div>}
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="text-sm text-ink-faint">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft[m.id] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                  // Blur-saves, so opening prices can be typed straight down the
                  // list on the keyboard without reaching for 保存 each time.
                  // The button stays for anyone who expects to press it.
                  onBlur={() => save(m)}
                  onKeyDown={(e) => e.key === "Enter" && save(m)}
                  placeholder={t(T.today)}
                  className="input min-h-11 w-28"
                />
                <button onClick={() => save(m)} disabled={savingId === m.id} className="btn-primary min-h-11 px-4 text-sm disabled:opacity-50">
                  {savedId === m.id ? `✓ ${t(T.saved)}` : t(T.save)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
