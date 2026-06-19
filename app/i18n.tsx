"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en" | "fr";
export type Dict = { zh: string; en: string; fr: string };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (d: Dict) => string }>({
  lang: "en",
  setLang: () => {},
  t: (d) => d.en,
});

/** App-wide language provider. One preference shared across landing, pricing, demo, get-started. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bento_lang");
      if (saved === "zh" || saved === "en" || saved === "fr") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("bento_lang", l);
    } catch {
      /* ignore */
    }
  };

  const t = (d: Dict) => d[lang];

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

const OPTS: { k: Lang; label: string }[] = [
  { k: "en", label: "EN" },
  { k: "fr", label: "FR" },
  { k: "zh", label: "中" },
];

/** Three-way segmented language picker: EN / FR / 中. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-[11px] font-medium ${className ?? ""}`}>
      {OPTS.map((o) => (
        <button
          key={o.k}
          onClick={() => setLang(o.k)}
          aria-label={`switch language to ${o.k}`}
          className={`rounded-full px-2 py-0.5 transition ${
            lang === o.k ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
