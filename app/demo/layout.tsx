import type { ReactNode } from "react";
import Link from "next/link";
import { DemoSidebar, DemoTabs } from "./nav";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* window chrome */}
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs text-slate-400">app.bentoos.io</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Demo</span>
              <Link href="/" className="hidden text-xs text-slate-500 transition hover:text-slate-800 sm:inline">
                ← Back to site
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:from-emerald-600 hover:to-emerald-700"
              >
                Get started
              </Link>
            </div>
          </div>

          <DemoTabs />

          <div className="flex">
            <DemoSidebar />
            <section className="min-w-0 flex-1 space-y-5 p-4 sm:p-6">{children}</section>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">Sample data for demonstration — numbers are illustrative.</p>
      </div>
    </main>
  );
}
