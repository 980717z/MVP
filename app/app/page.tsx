"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant, loadTenants } from "@/lib/store";
import { useAuth, signOut } from "@/lib/useAuth";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AppGate() {
  const router = useRouter();
  const { session, loading, email } = useAuth();
  const [checking, setChecking] = useState(true);

  // store-naming form state
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // gate: not logged in → login; already has a store → go straight to it
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    loadTenants().then((tenants) => {
      if (tenants.length > 0) {
        router.replace(`/${tenants[0].slug}`);
      } else {
        setChecking(false);
      }
    });
  }, [session, loading, router]);

  const slug = slugify(handleTouched ? handle : name);

  const create = async () => {
    if (!name.trim()) {
      setErr("请填写店铺名称");
      return;
    }
    if (!slug) {
      setErr("专属网址需要字母或数字，请在下方填一个英文名（如 fulai）");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await createTenant({ name: name.trim(), slug });
    if (res.slug) {
      router.replace(`/${res.slug}`);
    } else {
      setBusy(false);
      setErr(res.error ?? "创建失败，请重试");
    }
  };

  if (loading || !session || checking) {
    return <main className="grid min-h-screen place-items-center text-ink-faint">载入中…</main>;
  }

  // ── forced store-naming step (no other buttons) ──────────────────────────
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="text-2xl">🍱</span>
          <span className="text-lg font-bold tracking-tight">BentoOS</span>
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold text-ink">先给你的店铺起个名字</h1>
          <p className="mt-1 text-sm text-ink-soft">
            这是你专属后台的入口。命名后，你和你的员工都通过这个网址进入。
          </p>

          <label className="label mt-5">店铺名称</label>
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="如：富来小厨 / Fulai"
          />

          <label className="label mt-4">专属网址</label>
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 focus-within:border-brand">
            <span className="select-none text-sm text-ink-faint">bentoos.io/</span>
            <input
              className="w-full bg-transparent py-2 text-sm outline-none"
              value={handleTouched ? handle : slug}
              onChange={(e) => {
                setHandleTouched(true);
                setHandle(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="fulai"
            />
          </div>
          <p className="mt-1 text-xs text-ink-faint">只能用字母、数字（建议用拼音或英文）。</p>

          {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

          <button className="btn-primary mt-5 w-full disabled:opacity-50" onClick={create} disabled={busy}>
            {busy ? "创建中…" : "创建我的后台 →"}
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-ink-faint">
          {email} · <button onClick={() => signOut().then(() => router.replace("/login"))} className="hover:text-ink">退出</button>
        </div>
      </div>
    </main>
  );
}
