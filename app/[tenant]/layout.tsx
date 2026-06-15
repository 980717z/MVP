"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { getTenant, type Tenant } from "@/lib/store";
import { CATEGORIES, MODULE_BY_ID } from "@/lib/catalog";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const slug = params.tenant as string;
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    getTenant(slug).then((t) => {
      if (!alive) return;
      setTenant(t);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [slug, pathname]);

  if (ready && !tenant) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="text-ink-soft">找不到这个商家。</p>
          <Link href="/" className="btn-primary mt-4">返回首页</Link>
        </div>
      </div>
    );
  }

  const enabled = tenant?.enabled ?? [];

  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="hidden w-64 flex-none border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-200 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">A</div>
            <span className="text-sm font-semibold">Alpine</span>
          </Link>
          <div className="mt-3">
            <div className="text-sm font-semibold text-ink">{tenant?.name.zh}</div>
            <div className="text-xs text-ink-faint">{tenant?.address}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <NavLink href={`/${slug}`} active={pathname === `/${slug}`}>
            🏠 总览 Dashboard
          </NavLink>

          {CATEGORIES.map((c) => {
            const mods = enabled.map((id) => MODULE_BY_ID[id]).filter((m) => m && m.category === c.id);
            if (mods.length === 0) return null;
            return (
              <div key={c.id} className="mt-4">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  {c.label.zh}
                </div>
                {mods.map((m) => (
                  <NavLink
                    key={m.id}
                    href={`/${slug}/m/${m.id}`}
                    active={pathname === `/${slug}/m/${m.id}`}
                  >
                    {m.icon} {m.label.zh}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-3 py-3">
          <NavLink href={`/${slug}/settings`} active={pathname === `/${slug}/settings`}>
            ⚙️ 设置 · 员工 · 功能
          </NavLink>
        </div>
      </aside>

      {/* main */}
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`mb-0.5 block rounded-lg px-2.5 py-2 text-sm transition ${
        active ? "bg-brand-wash font-medium text-brand" : "text-ink-soft hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
