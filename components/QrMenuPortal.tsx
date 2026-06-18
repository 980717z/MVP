"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listMenuItems } from "@/lib/menu";

const qrSrc = (url: string, size = 300) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(url)}`;

type Mode = "single" | "tables";

export default function QrMenuPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const [origin, setOrigin] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [tables, setTables] = useState(8);

  useEffect(() => {
    setOrigin(window.location.origin);
    listMenuItems(slug).then((d) => setCount(d.length));
  }, [slug]);

  const baseUrl = `${origin}/menu/${slug}`;
  const tableUrl = (n: number) => `${baseUrl}?t=${n}`;

  const copy = () => {
    navigator.clipboard.writeText(baseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>

      <header className="mt-3 mb-5">
        <h1 className="text-2xl font-bold text-ink">{mod.icon} {mod.label.zh}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
      </header>

      {/* mode switch */}
      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "single" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("single")}
        >
          🏪 整店一个二维码
        </button>
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "tables" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("tables")}
        >
          🪑 每桌一个二维码
        </button>
      </div>

      {mode === "single" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col items-center p-8 text-center">
            <div className="rounded-2xl border border-slate-200 p-3">
              {origin ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc(baseUrl)} alt="菜单二维码" className="h-56 w-56" />
              ) : (
                <div className="h-56 w-56 animate-pulse rounded bg-slate-100" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">顾客扫码即看菜单</p>
            <p className="text-xs text-ink-faint">桌号由顾客下单时选填</p>
            <div className="mt-5 w-full">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-ink-soft">{baseUrl}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={copy} className="btn-ghost flex-1 border border-slate-300">{copied ? "已复制 ✓" : "复制链接"}</button>
                <a href={baseUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">打开预览</a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">这张菜单从哪来？</div>
              <p className="mt-2 text-sm text-ink-soft">
                实时读取「🍽️ 菜单设置」里的菜品 —— 当前共 <b className="text-ink">{count ?? "…"}</b> 道。
                改名 / 改价 / 换图，扫码页立即同步，无需重印。
              </p>
              <Link href={`/${slug}/m/menu-generator`} className="mt-3 inline-block text-sm text-brand hover:underline">去编辑菜单 →</Link>
            </div>
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">适合</div>
              <p className="mt-2 text-sm text-ink-soft">外卖自取、档口、快餐 —— 一张码贴在门口/收银台即可。需要分桌结账就用右边「每桌一个二维码」。</p>
            </div>
          </section>
        </div>
      ) : (
        <div>
          <div className="card mb-4 flex flex-wrap items-center gap-4 p-4">
            <div>
              <label className="label">桌数</label>
              <input
                type="number"
                min={1}
                max={100}
                className="input !w-28"
                value={tables}
                onChange={(e) => setTables(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              />
            </div>
            <p className="max-w-md text-sm text-ink-soft">
              为每张桌生成一个二维码。顾客在几号桌扫码，下单就自动标记「几号桌」——
              后台订单和结账时一眼看清是哪桌点的，不用再问。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: tables }, (_, i) => i + 1).map((n) => (
              <div key={n} className="card flex flex-col items-center p-3 text-center">
                <div className="text-sm font-bold text-ink">{n} 号桌</div>
                {origin ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc(tableUrl(n), 200)} alt={`${n}号桌二维码`} className="my-2 h-32 w-32" />
                ) : (
                  <div className="my-2 h-32 w-32 animate-pulse rounded bg-slate-100" />
                )}
                <a href={tableUrl(n)} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">预览</a>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ink-faint">
            打印：可整页打印这一屏，剪开摆到各桌；或右键单个二维码另存为图片。
          </p>
        </div>
      )}
    </main>
  );
}
