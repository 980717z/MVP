"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant, loadTenants } from "@/lib/store";
import { useAuth, signOut } from "@/lib/useAuth";
import { isValidSlug } from "@/lib/qrContract";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 店型 → 预选模块（templates/*.json 的浅层镜像；完整 provision 走
// scripts/provision-sql.ts，向导深化见 TODOS「建店向导打磨」）
const SHOP_TYPES = [
  { id: "chinese-restaurant", label: "中餐馆", hint: "堂食桌码 + 外卖", modules: ["menu-generator", "qr-menu", "online-orders"] },
  { id: "counter-service", label: "自取小店", hint: "无桌码 · 重会员", modules: ["menu-generator", "qr-menu", "online-orders", "members"] },
  { id: "custom", label: "自定义", hint: "创建后再选模块", modules: [] as string[] },
];

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
  const [shopType, setShopType] = useState(SHOP_TYPES[0].id);

  const create = async () => {
    if (!name.trim()) {
      setErr("请填写店铺名称");
      return;
    }
    if (!slug) {
      setErr("专属网址需要字母或数字，请在下方填一个英文名（如 fulai）");
      return;
    }
    // QR 合约 gate（lib/qrContract.ts）：格式 + 路由保留字，DB CHECK 同步兜底
    const sv = isValidSlug(slug);
    if (!sv.ok) {
      setErr(sv.reason === "reserved"
        ? `「${slug}」是系统保留字（会和页面路由冲突），请换一个`
        : "专属网址需要 3-30 位小写字母、数字或短横线");
      return;
    }
    setBusy(true);
    setErr(null);
    const enabled = SHOP_TYPES.find((t) => t.id === shopType)?.modules ?? [];
    const res = await createTenant({ name: name.trim(), slug, enabled });
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
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-base font-extrabold text-white">B</span>
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
            placeholder="如：老王面馆 / Golden Wok"
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
          <p className="mt-1 text-xs text-ink-faint">只能用字母、数字（建议用拼音或英文）。做实体牌子后网址不可更改。</p>

          <label className="label mt-4">店铺类型</label>
          <div className="grid grid-cols-3 gap-2">
            {SHOP_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setShopType(t.id)}
                className={`rounded-xl border-2 px-2 py-2.5 text-center transition ${
                  shopType === t.id ? "border-brand bg-brand-wash" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`text-xs font-semibold ${shopType === t.id ? "text-brand" : "text-ink"}`}>{t.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-ink-faint">{t.hint}</div>
              </button>
            ))}
          </div>

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
