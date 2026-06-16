"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { addMenuItem, deleteMenuItem, listMenuItems, uploadMenuImage, type MenuItem } from "@/lib/menu";
import { money } from "@/lib/format";

const CATEGORIES = ["招牌", "海鲜", "热菜", "凉菜", "汤", "主食", "饮品"];

type Tab = "manual" | "photo";

export default function MenuGeneratorPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const [tab, setTab] = useState<Tab>("manual");
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  // new-dish form
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("招牌");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMenuItems(slug).then(setDishes);
  }, [slug, tick]);

  const pickImage = (f: File | null) => {
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : "");
  };

  const resetForm = () => {
    setZh("");
    setEn("");
    setPrice("");
    pickImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const add = async () => {
    if (!zh.trim()) {
      alert("请填写菜名");
      return;
    }
    setBusy(true);
    let image_url = "";
    if (imageFile) {
      const up = await uploadMenuImage(slug, imageFile);
      if (up.error) {
        setBusy(false);
        alert("图片上传失败：" + up.error);
        return;
      }
      image_url = up.url ?? "";
    }
    const { error } = await addMenuItem(slug, { name_zh: zh.trim(), name_en: en.trim(), price, category, image_url });
    setBusy(false);
    if (error) {
      alert("添加失败：" + error);
      return;
    }
    resetForm();
    setTick((t) => t + 1);
  };

  const remove = async (id: string) => {
    await deleteMenuItem(id);
    setTick((t) => t + 1);
  };

  const grouped = CATEGORIES.map((c) => ({
    category: c,
    items: dishes.filter((d) => d.category === c),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{mod.icon} {mod.label.zh}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
        </div>
        <span className="pill bg-brand-wash text-brand">{dishes.length} 道菜</span>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* left: input */}
        <section className="lg:col-span-3">
          <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              className={`flex-1 rounded-md py-1.5 ${tab === "manual" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setTab("manual")}
            >
              ✍️ 手动录入
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 ${tab === "photo" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setTab("photo")}
            >
              📷 上传整张菜单
            </button>
          </div>

          {tab === "manual" ? (
            <>
              <div className="card p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">菜名（中文）*</label>
                    <input className="input" value={zh} onChange={(e) => setZh(e.target.value)} placeholder="如：汽锅鸡" />
                  </div>
                  <div>
                    <label className="label">菜名（English）</label>
                    <input className="input" value={en} onChange={(e) => setEn(e.target.value)} placeholder="Steam Pot Chicken" />
                  </div>
                  <div>
                    <label className="label">价格</label>
                    <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="42" />
                  </div>
                  <div>
                    <label className="label">分类</label>
                    <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* dish image */}
                <div className="mt-3">
                  <label className="label">菜品图片（可选）</label>
                  <div className="flex items-center gap-3">
                    <label className="btn-ghost cursor-pointer border border-slate-300">
                      选择图片
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {imagePreview && (
                      <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="预览" className="h-12 w-12 rounded-lg object-cover" />
                        <button onClick={() => pickImage(null)} className="text-xs text-ink-faint hover:text-red-600">移除</button>
                      </div>
                    )}
                  </div>
                </div>

                <button className="btn-primary mt-4 disabled:opacity-50" onClick={add} disabled={busy}>
                  {busy ? "保存中…" : "+ 添加到菜单"}
                </button>
              </div>

              {/* dish list */}
              <div className="mt-4 space-y-2">
                {dishes.map((d) => (
                  <div key={d.id} className="card flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {d.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.image_url} alt={d.name_zh} className="h-10 w-10 flex-none rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-slate-100 text-ink-faint">🍽️</div>
                      )}
                      <div className="min-w-0">
                        <span className="pill mr-2 bg-slate-100 text-ink-faint">{d.category || "未分类"}</span>
                        <span className="font-medium text-ink">{d.name_zh}</span>
                        {d.name_en && <span className="ml-2 text-xs text-ink-faint">{d.name_en}</span>}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-3">
                      <span className="font-semibold text-ink">{d.price != null ? money(d.price) : "—"}</span>
                      <button onClick={() => remove(d.id)} className="text-xs text-ink-faint hover:text-red-600">删除</button>
                    </div>
                  </div>
                ))}
                {dishes.length === 0 && (
                  <div className="card p-6 text-center text-sm text-ink-faint">还没有菜品，上面添加第一道菜。</div>
                )}
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 p-10 text-center">
              <div className="text-4xl">📷</div>
              <div className="font-medium text-ink">上传现有菜单照片</div>
              <p className="max-w-sm text-sm text-ink-soft">
                拍一张你现在的纸质 / 图片菜单，系统自动识别菜名与价格、补上英文翻译，批量生成菜品。
              </p>
              <button disabled className="btn-primary cursor-not-allowed opacity-40">选择照片（即将开放）</button>
              <p className="text-xs text-ink-faint">AI 识别功能正在接入中</p>
            </div>
          )}
        </section>

        {/* right: live preview */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">菜单预览</div>
            <button disabled className="text-xs text-ink-faint opacity-50">导出 PDF（即将开放）</button>
          </div>
          <div className="card overflow-hidden">
            <div className="bg-ink px-5 py-4 text-center text-white">
              <div className="text-lg font-bold tracking-wide">菜单 MENU</div>
            </div>
            <div className="p-5">
              {grouped.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-faint">添加菜品后这里实时生成菜单</div>
              ) : (
                grouped.map((g) => (
                  <div key={g.category} className="mb-4 last:mb-0">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">{g.category}</div>
                    {g.items.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-2 pt-1 last:border-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {d.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt={d.name_zh} className="h-8 w-8 flex-none rounded object-cover" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-ink">{d.name_zh}</div>
                            {d.name_en && <div className="text-xs text-ink-faint">{d.name_en}</div>}
                          </div>
                        </div>
                        <div className="flex-none font-semibold text-ink">{d.price != null ? money(d.price) : ""}</div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
