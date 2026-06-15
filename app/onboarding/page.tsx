"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, MODULES } from "@/lib/catalog";
import { createTenant } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";

export default function Onboarding() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // guard: must be logged in to create a tenant
  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const create = async () => {
    setBusy(true);
    setErr(null);
    const { slug, error } = await createTenant({
      name: name.trim() || "新商家",
      address: address.trim() || "—",
      enabled: MODULES.filter((m) => picked.has(m.id)).map((m) => m.id),
    });
    if (slug) {
      router.push(`/${slug}`);
    } else {
      setBusy(false);
      setErr(error ?? "创建失败，请重试。");
    }
  };

  if (loading || !session) {
    return <main className="grid min-h-screen place-items-center text-ink-faint">载入中…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-ink-faint hover:text-ink">← 返回</Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-bold text-ink">新建商家后台</h1>
        <p className="mt-1 text-ink-soft">
          先填基本信息，再勾选你最需要的功能 —— 系统会按勾选项生成对应的录入与报表。
        </p>
      </header>

      {/* basic info */}
      <section className="card mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">商家名称</label>
            <input
              className="input"
              placeholder="如：盛记海鲜酒家"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">地址</label>
            <input
              className="input"
              placeholder="如：343 Spadina Ave, Toronto"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* checklist */}
      <section className="space-y-6">
        {CATEGORIES.map((c) => (
          <div key={c.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-ink">{c.label.zh}</h2>
              <span className="text-xs text-ink-faint">{c.label.en}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULES.filter((m) => m.category === c.id).map((m) => {
                const on = picked.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      on
                        ? "border-brand bg-brand-wash"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded border ${
                        on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        {m.icon} {m.label.zh}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-faint">{m.pain.zh}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* sticky footer */}
      <div className="sticky bottom-0 mt-8 -mx-6 border-t border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
        {err && (
          <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            创建失败：{err}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">
            已选 <b className="text-brand">{picked.size}</b> 个功能模块
          </span>
          <button
            onClick={create}
            disabled={picked.size === 0 || busy}
            className="btn-primary px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "生成中…" : "生成后台 →"}
          </button>
        </div>
      </div>
    </main>
  );
}
