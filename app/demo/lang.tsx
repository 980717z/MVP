"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";
export type Dict = { zh: string; en: string };

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (d: Dict) => string }>({
  lang: "en",
  setLang: () => {},
  t: (d) => d.en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bento_demo_lang");
      if (saved === "zh" || saved === "en") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("bento_demo_lang", l);
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

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
      aria-label="switch language"
    >
      {lang === "zh" ? "EN" : "中文"}
    </button>
  );
}
