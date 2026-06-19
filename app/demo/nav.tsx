"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./data";

function useIsActive() {
  const path = usePathname();
  return (href: string) => (href === "/demo" ? path === "/demo" : path.startsWith(href));
}

export function DemoSidebar() {
  const isActive = useIsActive();
  return (
    <aside className="hidden w-52 shrink-0 border-r border-slate-100 bg-slate-50/40 p-3 lg:block">
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-sky-500 text-sm shadow-sm">🍱</span>
        <span className="font-bold tracking-tight text-slate-900">BentoOS</span>
      </div>
      <nav className="space-y-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
              isActive(n.href) ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="text-base">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function DemoTabs() {
  const isActive = useIsActive();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-2 lg:hidden">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition ${
            isActive(n.href) ? "bg-emerald-100 font-medium text-emerald-700" : "text-slate-500"
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
