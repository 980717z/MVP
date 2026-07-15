"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listMenuItems } from "@/lib/menu";
import { displayTable } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { menuUrl, qrLockErrorMessage, tableUrl as qrTableUrl, togoUrl as qrTogoUrl } from "@/lib/qrContract";
import DeliveryZoneEditor from "@/components/DeliveryZoneEditor";

const qrSrc = (url: string, size = 300) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(url)}`;

type Mode = "single" | "tables" | "togo";

// 富来小厨's default physical tables; overridden by tenants.tables when set.
const FALLBACK_TABLES = ["1", "2", "2A", "3", "4", "5", "6", "7", "8", "8A", "8B", "10", "11", "12"];

export default function QrMenuPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const [origin, setOrigin] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<Mode>("tables");
  const [tables, setTables] = useState<string[]>(FALLBACK_TABLES);
  // 永久 QR 合约锁（supabase/qr-lock.sql）：锁定后 slug/桌号由 DB 触发器保护
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    listMenuItems(slug).then((d) => setCount(d.length));
    // Named table list lives on the tenant row (supabase/orders-payment.sql)
    supabase
      .from("tenants")
      .select("tables, qr_locked_at")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        const t = data?.tables;
        if (Array.isArray(t) && t.length > 0) setTables(t.map(String));
        setLockedAt((data as any)?.qr_locked_at ?? null);
      });
  }, [slug]);

  // 锁定是一次有意识的决定；解锁只能在 Supabase SQL 编辑器（DB 触发器强制）。
  const lockNow = async () => {
    if (!window.confirm("锁定后：店铺网址标识和已有桌号将不可修改（可新增桌号），店铺不可删除。\n解锁只能在 Supabase 后台操作。\n\n牌子已经印好了吗？确认锁定？")) return;
    setLocking(true);
    const { error } = await supabase.from("tenants").update({ qr_locked_at: new Date().toISOString() }).eq("slug", slug);
    setLocking(false);
    if (error) {
      alert(qrLockErrorMessage(error.message, "zh") ?? `锁定失败：${error.message}`);
      return;
    }
    setLockedAt(new Date().toISOString());
  };

  // URL 形状统一走 lib/qrContract（守卫测试锁死 —— 这些印在物理牌子上）
  const baseUrl = menuUrl(origin, slug);
  const tableUrl = (t: string) => qrTableUrl(origin, slug, t);
  const togoUrl = qrTogoUrl(origin, slug);

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const [zipping, setZipping] = useState(false);
  // Generate a high-res (print-quality) labelled QR PNG for one URL.
  const makeQrPng = async (QRCode: any, url: string, label: string): Promise<Blob> => {
    const SIZE = 1024;
    const dataUrl = await QRCode.toDataURL(url, { width: SIZE, margin: 2, errorCorrectionLevel: "M" });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("image decode failed")); });
    const pad = 56;
    const labelH = 150;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE + pad * 2;
    canvas.height = SIZE + pad + labelH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad, pad, SIZE, SIZE);
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.font = "700 76px 'Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif";
    ctx.fillText(label, canvas.width / 2, SIZE + pad + 90);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b as Blob), "image/png"));
  };

  // One-click: bundle every table QR (+ the togo QR) into a ZIP for the sign vendor.
  const downloadAll = async () => {
    if (!origin) return;
    setZipping(true);
    try {
      const [{ default: JSZip }, QRCodeMod] = await Promise.all([import("jszip"), import("qrcode")]);
      const QRCode = (QRCodeMod as any).default ?? QRCodeMod;
      const zip = new JSZip();
      for (const tName of tables) {
        zip.file(`${displayTable(tName)}号桌.png`, await makeQrPng(QRCode, tableUrl(tName), `${displayTable(tName)}号桌`));
      }
      zip.file(`外卖配送.png`, await makeQrPng(QRCode, togoUrl, "外卖 / 配送"));
      // a plain text list of which URL each sign points to, for the vendor's reference
      const manifest = [
        ...tables.map((tName) => `${displayTable(tName)}号桌\t${tableUrl(tName)}`),
        `外卖/配送\t${togoUrl}`,
      ].join("\n");
      zip.file("对照表.txt", `${slug} 二维码对照表\n\n${manifest}\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-二维码-${tables.length + 1}张.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("downloadAll", e);
      alert("下载失败，请重试");
    } finally {
      setZipping(false);
    }
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>

      <header className="mt-3 mb-5">
        <h1 className="text-2xl font-bold text-ink">{mod.label.zh}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
      </header>

      {/* mode switch */}
      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "tables" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("tables")}
        >
          每桌一码（堂食）
        </button>
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "togo" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("togo")}
        >
          外卖 / 自取码
        </button>
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "single" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("single")}
        >
          整店一码
        </button>
      </div>

      {mode === "single" && (
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
                <button onClick={() => copy(baseUrl)} className="btn-ghost flex-1 border border-slate-300">{copied ? "已复制 ✓" : "复制链接"}</button>
                <a href={baseUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">打开预览</a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">这张菜单从哪来？</div>
              <p className="mt-2 text-sm text-ink-soft">
                实时读取「菜单设置」里的菜品 —— 当前共 <b className="text-ink">{count ?? "…"}</b> 道。
                改名 / 改价 / 换图，扫码页立即同步，无需重印。
              </p>
              <Link href={`/${slug}/m/menu-generator`} className="mt-3 inline-block text-sm text-brand hover:underline">去编辑菜单 →</Link>
            </div>
          </section>
        </div>
      )}

      {mode === "tables" && (
        <div>
          {/* permanent-code notice — important before ordering custom signs */}
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <div className="text-sm text-amber-900">
                <div className="font-bold">这些二维码是永久固定的，做牌子放心用</div>
                <p className="mt-1 leading-relaxed">
                  每个码指向的网址永远不变（如 <code className="rounded bg-amber-100 px-1">bentoos.io/menu/{slug}?t=8A</code>），
                  改菜品、改价格、换图都不会影响它。<b>只要不做这两件事，牌子可以一直用：</b>
                </p>
                <ul className="mt-1 list-disc pl-5">
                  <li>不要更改店铺网址标识「<b>{slug}</b>」</li>
                  <li>不要更改桌号（{tables.map(displayTable).join("、")}）—— 已做成牌子的桌号请保持不变</li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {lockedAt ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      已锁定 —— 网址与桌号受数据库保护（可新增桌号；解锁需在 Supabase 操作）
                    </span>
                  ) : (
                    <>
                      <button onClick={lockNow} disabled={locking} className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
                        {locking ? "锁定中…" : "牌子已印好，锁定保护"}
                      </button>
                      <span className="text-xs text-amber-800/80">锁定后上面两条由数据库强制执行，不再只靠自觉</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-4 p-4">
            <p className="text-sm text-ink-soft">
              每张桌一个专属二维码（共 <b className="text-ink">{tables.length}</b> 桌：{tables.map(displayTable).join("、")}）。
              顾客在几号桌扫码，订单自动标记该桌 —— 后台和结账一眼看清，无需再问。
              整页打印后剪开，贴到对应桌面。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
            {tables.map((t) => (
              <div key={t} className="card flex flex-col items-center p-3 text-center">
                <div className="text-base font-bold text-ink">{displayTable(t)} 号桌</div>
                {origin ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc(tableUrl(t), 200)} alt={`${displayTable(t)}号桌二维码`} className="my-2 h-32 w-32" />
                ) : (
                  <div className="my-2 h-32 w-32 animate-pulse rounded bg-slate-100" />
                )}
                <div className="text-[11px] text-ink-faint">堂食 · 扫码点餐</div>
                <a href={tableUrl(t)} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand hover:underline print:hidden">预览</a>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
            <button onClick={downloadAll} disabled={zipping} className="btn-primary disabled:opacity-60">
              {zipping ? "生成中…" : "一键下载全部二维码（高清 ZIP）"}
            </button>
            <button onClick={() => window.print()} className="btn-ghost border border-slate-300">打印整页</button>
            <p className="w-full text-xs text-ink-faint sm:w-auto">
              下载的是高清带桌号的 PNG（每张 1024px）+ 一份网址对照表，打包成 ZIP，直接发给做牌子的商家即可。桌号列表可在数据库 tenants.tables 修改。
            </p>
          </div>
        </div>
      )}

      {mode === "togo" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col items-center border-jade/30 p-8 text-center">
            <span className="mb-2 rounded-full bg-jade-wash px-3 py-1 text-xs font-bold text-jade">外卖 / 自取 专用</span>
            <div className="rounded-2xl border-2 border-jade/40 p-3">
              {origin ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc(togoUrl)} alt="外卖自取二维码" className="h-56 w-56" />
              ) : (
                <div className="h-56 w-56 animate-pulse rounded bg-slate-100" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">贴在门口 / 收银台 / 传单上</p>
            <p className="text-xs text-ink-faint">顾客选自取或配送，须在线支付后订单才进厨房</p>
            <div className="mt-5 w-full">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-ink-soft">{togoUrl}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => copy(togoUrl)} className="btn-ghost flex-1 border border-slate-300">{copied ? "已复制 ✓" : "复制链接"}</button>
                <a href={togoUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">打开预览</a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">和堂食码有什么不同？</div>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                <li>• 顾客选 <b className="text-ink">自取</b> 或 <b className="text-ink">配送</b>（不选桌号）</li>
                <li>• 配送仅限市中心（按邮编验证），满 $30 起送，含 10% 配送小费</li>
                <li>• <b className="text-ink">须先在线支付</b>，付款成功订单才进厨房打印</li>
                <li>• 堂食桌码不受影响，仍可叫服务员买单</li>
              </ul>
            </div>
            <div className="card border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-800">⏳ 在线支付即将开通</div>
              <p className="mt-1 text-sm text-amber-800/80">
                Clover 支付接入完成前，这个码先不要贴出去 —— 顾客能看菜单，但暂时无法提交外卖/配送订单。
              </p>
            </div>
          </section>

          {/* delivery zone map — spans both columns */}
          <div className="lg:col-span-2">
            <DeliveryZoneEditor slug={slug} />
          </div>
        </div>
      )}
    </main>
  );
}
