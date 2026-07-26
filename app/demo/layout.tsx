import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DemoChrome, DemoFootnote } from "./chrome";
import { DemoSidebar, DemoTabs } from "./nav";

export const metadata: Metadata = {
  title: "Live Demo — Try the Dashboard",
  description:
    "Click through a real BentoOS back-office: live orders, kitchen tickets, sales & tax. See how a restaurant or café runs on BentoOS before you sign up.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "BentoOS Live Demo",
    description: "Click through a real back-office: live orders, kitchen tickets, sales & tax.",
    url: "/demo",
  },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <DemoChrome />
          <DemoTabs />
          <div className="flex">
            <DemoSidebar />
            <section className="min-w-0 flex-1 space-y-5 p-4 sm:p-6">{children}</section>
          </div>
        </div>
        <DemoFootnote />
      </div>
    </main>
  );
}
