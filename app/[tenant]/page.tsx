"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTenant, type Tenant } from "@/lib/store";
import { MODULE_BY_ID, type ModuleDef } from "@/lib/catalog";
import { money, num, sum } from "@/lib/format";

export default function Dashboard() {
  const slug = useParams().tenant as string;
  const [tenant, setTenant] = useState<Tenant | undefined>();

  useEffect(() => {
    getTenant(slug).then(setTenant);
  }, [slug]);

  if (!tenant) return null;

  const today = new Date().toISOString().slice(0, 10);
  const kpiModules = tenant.enabled
    .map((id) => MODULE_BY_ID[id])
    .filter((m): m is ModuleDef => !!m && !!m.amountKey);

  return (
    <main className="px-6 py-8 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">总览</h1>
        <p className="text-sm text-ink-soft">
          {tenant.name.zh} · 共 {tenant.enabled.length} 个功能模块 · {tenant.users.length} 个账号
        </p>
      </header>

      {/* KPI cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpiModules.map((m) => {
          const rows = tenant.records[m.id] ?? [];
          const todayRows = rows.filter((r) => r.date === today);
          const useRows = todayRows.length ? todayRows : rows;
          const total = sum(useRows, m.amountKey!);
          return (
            <Link key={m.id} href={`/${slug}/m/${m.id}`} className="card p-5 transition hover:border-brand">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{m.icon}</span>
                <span className="pill bg-slate-100 text-ink-faint">{rows.length} 条</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-ink">
                {m.amountKind === "money" ? money(total) : num(total)}
              </div>
              <div className="text-xs text-ink-faint">{m.amountLabel?.zh ?? m.label.zh}</div>
            </Link>
          );
        })}
        {kpiModules.length === 0 && (
          <div className="text-sm text-ink-faint">已选模块暂无可汇总指标，进入各模块录入数据。</div>
        )}
      </section>

      {/* module grid */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">功能模块</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tenant.enabled.map((id) => {
            const m = MODULE_BY_ID[id];
            if (!m) return null;
            const count = (tenant.records[id] ?? []).length;
            return (
              <Link key={id} href={`/${slug}/m/${id}`} className="card p-4 transition hover:border-brand hover:shadow">
                <div className="mb-1 text-sm font-semibold text-ink">
                  {m.icon} {m.label.zh}
                </div>
                <div className="text-xs text-ink-faint">{m.pain.zh}</div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-ink-faint">{count} 条记录</span>
                  <span className="text-brand">录入 / 查看 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
