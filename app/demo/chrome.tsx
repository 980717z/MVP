"use client";

import Link from "next/link";
import { useLang, LangToggle } from "./lang";

export function DemoChrome() {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
      <span className="h-3 w-3 rounded-full bg-red-400" />
      <span className="h-3 w-3 rounded-full bg-amber-400" />
      <span className="h-3 w-3 rounded-full bg-emerald-400" />
      <span className="ml-3 text-xs text-slate-400">app.bentoos.io</span>
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{t({ zh: "演示", en: "Demo", fr: "Démo" })}</span>
        <LangToggle />
        <Link href="/" className="hidden text-xs text-slate-500 transition hover:text-slate-800 sm:inline">
          {t({ zh: "← 返回官网", en: "← Back to site", fr: "← Retour au site" })}
        </Link>
        <Link
          href="/get-started"
          className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:from-emerald-600 hover:to-emerald-700"
        >
          {t({ zh: "免费开始", en: "Get started", fr: "Commencer" })}
        </Link>
      </div>
    </div>
  );
}

export function DemoFootnote() {
  const { t } = useLang();
  return (
    <p className="mt-3 text-center text-xs text-slate-400">
      {t({ zh: "演示用示例数据，数字仅供参考。", en: "Sample data for demonstration — numbers are illustrative.", fr: "Données d'exemple — chiffres illustratifs." })}
    </p>
  );
}
