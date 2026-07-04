"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { displayPrice, addMenuItem, deleteMenuItem, getCatOrder, listMenuItemsRaw, orderedCategories, saveCatOrder, updateMenuItem, uploadMenuImage, type MenuItem } from "@/lib/menu";
import { price as fmtPrice } from "@/lib/format";

const CATEGORIES = [
  "招牌精选",
  "滋补菜式",
  "火锅",
  "火锅配菜",
  "海鲜",
  "汤羹",
  "头盘",
  "蔬菜豆腐",
  "猪肉牛肉",
  "鸡鸭",
  "铁板煲仔",
  "芙蓉蛋",
  "炒粉面",
  "煲仔饭",
  "饭类",
  "炒饭",
  "汤粉面",
  "粥类",
  "酒水饮品",
];

type Tab = "manual" | "photo";

export default function MenuGeneratorPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const [tab, setTab] = useState<Tab>("manual");
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [catOrder, setCatOrder] = useState<string[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // new-dish form
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listMenuItemsRaw(slug).then(setDishes);
    getCatOrder(slug).then(setCatOrder);
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
    setDishes((prev) => prev.filter((d) => d.id !== id));
  };

  // live-edit: update local state instantly (preview reacts), persist on commit
  const patchLocal = (id: string, patch: Record<string, any>) =>
    setDishes((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const saveField = (id: string, patch: Record<string, any>) => {
    updateMenuItem(id, patch);
  };

  // ── 多规格 (size variants) editing ──────────────────────────────────────
  const setVariants = (d: MenuItem, next: any[]) => {
    patchLocal(d.id, { variants: next });
    updateMenuItem(d.id, { variants: next });
  };
  const addVariant = (d: MenuItem) => setVariants(d, [...(d.variants ?? []), { label_zh: "", label_en: "", price: "" }]);
  const patchVariant = (d: MenuItem, i: number, patch: Record<string, any>) =>
    patchLocal(d.id, { variants: (d.variants ?? []).map((v: any, idx: number) => (idx === i ? { ...v, ...patch } : v)) });
  // Persist by reading the LATEST state (avoids saving a stale variants array
  // captured in the row's onBlur closure — the cause of sizes not saving).
  const saveVariants = (id: string) =>
    setDishes((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d) updateMenuItem(id, { variants: d.variants ?? [] });
      return prev;
    });
  const rmVariant = (d: MenuItem, i: number) => setVariants(d, (d.variants ?? []).filter((_: any, idx: number) => idx !== i));

  const changeImage = async (id: string, file: File | null) => {
    if (!file) return;
    const up = await uploadMenuImage(slug, file);
    if (up.error) {
      alert("图片上传失败：" + up.error);
      return;
    }
    patchLocal(id, { image_url: up.url ?? "" });
    saveField(id, { image_url: up.url ?? "" });
  };

  const removeImage = (id: string) => {
    patchLocal(id, { image_url: "" });
    saveField(id, { image_url: "" });
  };

  // present categories (have dishes) in the saved custom order
  const presentCats = orderedCategories(
    Array.from(new Set(dishes.map((d) => d.category).filter(Boolean))),
    catOrder,
    CATEGORIES
  );

  const grouped = presentCats.map((c) => ({
    category: c,
    items: dishes.filter((d) => d.category === c),
  }));

  const reorderCat = (from: number, to: number) => {
    if (from === to) return;
    const next = [...presentCats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCatOrder(next);
  };

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

      {/* 今日时价 — quick daily price entry for market-priced dishes */}
      {dishes.some((d) => d.is_market) && (
        <div className="card mb-6 border-amber-200 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">💰 今日时价</span>
            <span className="text-xs text-ink-faint">每天开市填一次 —— 留空 = 菜单只显示「时价」，顾客无法下单，需询问服务员</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dishes.filter((d) => d.is_market).map((d) => (
              <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{d.name_zh}</div>
                  {d.name_en && <div className="truncate text-[11px] text-ink-faint">{d.name_en}</div>}
                </div>
                <div className="flex w-24 flex-none items-center rounded-lg border border-amber-300 bg-amber-50/50 px-2">
                  <span className="text-sm text-amber-700">$</span>
                  <input
                    className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none"
                    type="number"
                    step="0.01"
                    value={d.price ?? ""}
                    placeholder="时价"
                    onChange={(e) => patchLocal(d.id, { price: e.target.value })}
                    onBlur={(e) => saveField(d.id, { price: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* category order */}
      {presentCats.length > 1 && (
        <div className="card mb-6 p-4">
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setOrderOpen((o) => !o)}
          >
            <span className="text-sm font-semibold text-ink">⚙️ 分类顺序</span>
            <span className="text-xs text-ink-faint">
              {orderOpen ? "收起" : "拖动调整顾客菜单上的分类排序 ›"}
            </span>
          </button>
          {orderOpen && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {grouped.map((g, i) => (
                  <div
                    key={g.category}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragIdx !== null && dragIdx !== i) {
                        reorderCat(dragIdx, i);
                        setDragIdx(i);
                      }
                    }}
                    onDragEnd={() => {
                      setDragIdx(null);
                      saveCatOrder(slug, presentCats);
                    }}
                    className={`flex cursor-move select-none items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-sm transition ${
                      dragIdx === i ? "border-brand opacity-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-ink-faint">⠿</span>
                    <span className="text-ink-faint">{i + 1}.</span>
                    <span className="text-ink">{g.category}</span>
                    <span className="text-xs text-ink-faint">{g.items.length}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-faint">拖动卡片调整顺序，松手即保存。</p>
            </>
          )}
        </div>
      )}

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

              {/* dish list — inline editable */}
              <div className="mt-4 flex items-center justify-between px-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  全部菜品（点任意字段直接修改）
                </div>
                <div className="text-xs text-ink-faint">{dishes.length} 道</div>
              </div>
              <div className="mt-2 space-y-2">
                {dishes.map((d) => (
                  <div key={d.id} className="card flex gap-4 p-3">
                    {/* left column: category (top) · image (fills) */}
                    <div className="flex w-32 flex-none flex-col gap-2">
                      <select
                        className="input !py-1.5 !px-2 text-xs"
                        value={d.category || CATEGORIES[0]}
                        onChange={(e) => {
                          patchLocal(d.id, { category: e.target.value });
                          saveField(d.id, { category: e.target.value });
                        }}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <div className="relative min-h-[5rem] w-full flex-1 overflow-hidden rounded-lg">
                        <label className="block h-full w-full cursor-pointer" title={d.image_url ? "点击更换图片" : "点击上传图片"}>
                          {d.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt={d.name_zh} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-slate-100 text-xs text-ink-faint">＋图</div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => changeImage(d.id, e.target.files?.[0] ?? null)}
                          />
                        </label>
                        {d.image_url && (
                          <button
                            type="button"
                            onClick={() => removeImage(d.id)}
                            title="删除图片 Remove photo"
                            aria-label="删除图片"
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px] leading-none text-white transition hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* right column: 中文 · English · 价格 */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        className="input w-full !py-2 text-base font-medium"
                        value={d.name_zh}
                        placeholder="中文名"
                        onChange={(e) => patchLocal(d.id, { name_zh: e.target.value })}
                        onBlur={(e) => saveField(d.id, { name_zh: e.target.value })}
                      />
                      <input
                        className="input w-full !py-2 text-sm text-ink-soft"
                        value={d.name_en}
                        placeholder="English"
                        onChange={(e) => patchLocal(d.id, { name_en: e.target.value })}
                        onBlur={(e) => saveField(d.id, { name_en: e.target.value })}
                      />
                      {(d.variants?.length ?? 0) === 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="flex w-32 items-center rounded-lg border border-slate-300 px-2">
                            <span className="text-sm text-ink-faint">$</span>
                            <input
                              className="w-full bg-transparent py-1.5 text-sm outline-none"
                              type="number"
                              step="0.01"
                              value={d.price ?? ""}
                              placeholder="时价"
                              onChange={(e) => patchLocal(d.id, { price: e.target.value })}
                              onBlur={(e) => saveField(d.id, { price: e.target.value })}
                            />
                          </div>
                          <button onClick={() => addVariant(d)} className="text-xs font-medium text-brand hover:underline">＋ 多规格（大小/份量）</button>
                          <label className="flex cursor-pointer items-center gap-1 text-xs text-ink-soft" title="时价菜：菜单显示金色「时价」标签，价格每天在顶部「今日时价」面板更新">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-amber-600"
                              checked={!!d.is_market}
                              onChange={(e) => {
                                patchLocal(d.id, { is_market: e.target.checked });
                                updateMenuItem(d.id, { is_market: e.target.checked });
                              }}
                            />
                            时价
                          </label>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                          <div className="mb-1.5 text-xs font-medium text-ink-soft">多规格（每个大小一个价）</div>
                          <div className="space-y-1.5">
                            {d.variants.map((v: any, i: number) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <input
                                  className="w-16 rounded border border-slate-300 px-2 py-1 text-sm outline-none"
                                  value={v.label_zh ?? ""}
                                  placeholder="全/位"
                                  onChange={(e) => patchVariant(d, i, { label_zh: e.target.value })}
                                  onBlur={() => saveVariants(d.id)}
                                />
                                <input
                                  className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-ink-soft outline-none"
                                  value={v.label_en ?? ""}
                                  placeholder="Whole/Single"
                                  onChange={(e) => patchVariant(d, i, { label_en: e.target.value })}
                                  onBlur={() => saveVariants(d.id)}
                                />
                                <div className="flex flex-1 items-center rounded border border-slate-300 px-2">
                                  <span className="text-sm text-ink-faint">$</span>
                                  <input
                                    className="w-full bg-transparent py-1 text-sm outline-none"
                                    type="number"
                                    step="0.01"
                                    value={v.price ?? ""}
                                    placeholder="0.00"
                                    onChange={(e) => patchVariant(d, i, { price: e.target.value })}
                                    onBlur={() => saveVariants(d.id)}
                                  />
                                </div>
                                <button onClick={() => rmVariant(d, i)} className="flex-none px-1 text-xs text-ink-faint hover:text-red-600" title="删除这个规格">✕</button>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => addVariant(d)} className="mt-2 text-xs font-medium text-brand hover:underline">＋ 加一个规格</button>
                        </div>
                      )}
                    </div>

                    <button onClick={() => remove(d.id)} className="flex-none self-start px-1 text-xs text-ink-faint hover:text-red-600">删除</button>
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
                        <div className="flex-none font-semibold text-ink">
                          {(d.variants?.length ?? 0) > 0 ? `起 ${fmtPrice(displayPrice(d))}` : fmtPrice(d.price)}
                        </div>
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
