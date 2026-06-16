"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadTenants, type Tenant } from "@/lib/store";
import { MODULES, readyByCategory, readyCategories } from "@/lib/catalog";
import { useAuth, signOut } from "@/lib/useAuth";

export default function AppHome() {
  const router = useRouter();
  const { session, loading, email } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    loadTenants().then((t) => {
      setTenants(t);
      setLoaded(true);
    });
  }, [session, loading, router]);

  if (loading || !session) {
    return <main className="grid min-h-screen place-items-center text-ink-faint">载入中…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {/* top bar */}
      <div className="mb-8 flex items-center justify-between text-sm">
        <Link href="/" className="flex items-center gap-2 font-bold text-ink">
          <span className="text-xl">🍱</span> BentoOS
        </Link>
        <div className="flex items-center gap-4 text-ink-faint">
          <span>{email}</span>
          <button onClick={() => signOut().then(() => router.replace("/"))} className="hover:text-ink">
            退出登录
          </button>
        </div>
      </div>

      {/* hero */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">
          勾选你需要的功能，
          <br className="hidden sm:block" />
          一键生成专属后台管理系统
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          每个商家一个主账号，按需勾选功能模块（备货、库存、订单、对账、会员……），
          系统自动生成对应的录入界面与报表输出。可添加员工子账号，按岗位分配权限。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/onboarding" className="btn-primary text-base px-5 py-2.5">
            + 新建商家（勾选功能）
          </Link>
        </div>
      </header>

      {/* existing tenants */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">我的商家</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {tenants.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="card p-4 transition hover:border-brand hover:shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink">{t.name.zh}</div>
                  <div className="text-xs text-ink-faint">{t.address}</div>
                </div>
                <span className="pill bg-brand-wash text-brand">{t.enabled.length} 个模块</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.enabled.slice(0, 6).map((id) => {
                  const m = MODULES.find((x) => x.id === id);
                  return m ? (
                    <span key={id} className="pill bg-slate-100 text-ink-soft">
                      {m.icon} {m.label.zh}
                    </span>
                  ) : null;
                })}
              </div>
            </Link>
          ))}
          {loaded && tenants.length === 0 && (
            <div className="text-sm text-ink-faint">还没有商家，点上面「新建商家」开始。</div>
          )}
        </div>
      </section>

      {/* catalog overview */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
          已上线功能
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {readyCategories().map((c) => (
            <div key={c.id} className="card p-4">
              <div className="mb-2 text-sm font-semibold text-ink">{c.label.zh}</div>
              <ul className="space-y-1">
                {readyByCategory(c.id).map((m) => (
                  <li key={m.id} className="text-sm text-ink-soft">
                    {m.icon} {m.label.zh}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-faint">更多功能正在逐步上线。</p>
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-ink-faint">
        BentoOS · 接入 Supabase（Postgres + Auth + RLS）
      </footer>
    </main>
  );
}
