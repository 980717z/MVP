"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { displayPrice, normVariants, addMenuItem, deleteMenuItem, getCatOrder, getMenuLangs, listMenuItemsRaw, orderedCategories, saveCatOrder, updateMenuItem, uploadMenuImage, type MenuItem } from "@/lib/menu";
import { resolveOfferedLangs } from "@/lib/menuLangs";
import { price as fmtPrice } from "@/lib/format";
import { useLang, type Dict } from "@/app/i18n";

// Trilingual UI chrome (EN / 中 / FR). Dish DATA (name_zh/name_en, category
// names) stays as entered — this only translates the editor's own labels.
const T = {
  back: { en: "Overview", zh: "总览", fr: "Aperçu" },
  dishesPill: { en: "dishes", zh: "道菜", fr: "plats" },
  catOrder: { en: "Category order", zh: "分类顺序", fr: "Ordre des catégories" },
  collapse: { en: "Collapse", zh: "收起", fr: "Réduire" },
  catOrderHint: { en: "Drag to reorder categories on the customer menu ›", zh: "拖动调整顾客菜单上的分类排序 ›", fr: "Glissez pour réordonner les catégories du menu client ›" },
  catDragNote: { en: "Drag the cards to reorder — drops save automatically.", zh: "拖动卡片调整顺序,松手即保存。", fr: "Glissez les cartes pour réordonner — l'ordre est enregistré au relâchement." },
  tabManual: { en: "✍️ Enter manually", zh: "✍️ 手动录入", fr: "✍️ Saisie manuelle" },
  tabPhoto: { en: "📷 Upload a menu photo", zh: "📷 上传整张菜单", fr: "📷 Importer une photo du menu" },
  nameZh: { en: "Dish name (Chinese) *", zh: "菜名(中文)*", fr: "Nom du plat (chinois) *" },
  nameZhPh: { en: "e.g. 汽锅鸡", zh: "如:汽锅鸡", fr: "ex. 汽锅鸡" },
  // English-first authoring (VT2): the PRIMARY field follows the shop's first
  // menu language. English-operating vendors see English as the required field;
  // the other language is opt-in (data only — enabling it for customers is a
  // Settings toggle, per design-review D3=B).
  nameEnReq: { en: "Dish name (English) *", zh: "菜名(English)*", fr: "Nom du plat (anglais) *" },
  namePrimaryHint: { en: "This is the name shown to customers.", zh: "顾客菜单上显示的名称。", fr: "Nom affiché aux clients." },
  addChinese: { en: "+ Add Chinese name", zh: "+ 加中文名", fr: "+ Ajouter le nom chinois" },
  addEnglish: { en: "+ Add English name", zh: "+ 加英文名", fr: "+ Ajouter le nom anglais" },
  removeTranslation: { en: "Remove", zh: "移除", fr: "Retirer" },
  nameEn: { en: "Dish name (English)", zh: "菜名(English)", fr: "Nom du plat (anglais)" },
  nameEnPh: { en: "Steam Pot Chicken", zh: "Steam Pot Chicken", fr: "Steam Pot Chicken" },
  price: { en: "Price", zh: "价格", fr: "Prix" },
  category: { en: "Category", zh: "分类", fr: "Catégorie" },
  photoOpt: { en: "Dish photo (optional)", zh: "菜品图片(可选)", fr: "Photo du plat (facultatif)" },
  choosePhoto: { en: "Choose image", zh: "选择图片", fr: "Choisir une image" },
  preview: { en: "Preview", zh: "预览", fr: "Aperçu" },
  remove: { en: "Remove", zh: "移除", fr: "Retirer" },
  saving: { en: "Saving…", zh: "保存中…", fr: "Enregistrement…" },
  addToMenu: { en: "+ Add to menu", zh: "+ 添加到菜单", fr: "+ Ajouter au menu" },
  allDishes: { en: "All dishes (tap any field to edit)", zh: "全部菜品(点任意字段直接修改)", fr: "Tous les plats (touchez un champ pour modifier)" },
  countSuffix: { en: "", zh: "道", fr: "" },
  searchPh: { en: "Search dishes (Chinese or English)", zh: "搜索菜名(中文或英文)", fr: "Rechercher un plat (chinois ou anglais)" },
  noMatchA: { en: "No match for “", zh: "没有找到「", fr: "Aucun résultat pour « " },
  noMatchB: { en: "”", zh: "」", fr: " »" },
  addPhotoTile: { en: "+ photo", zh: "＋图", fr: "+ photo" },
  clickChange: { en: "Click to change photo", zh: "点击更换图片", fr: "Cliquer pour changer la photo" },
  clickUpload: { en: "Click to upload photo", zh: "点击上传图片", fr: "Cliquer pour ajouter une photo" },
  removePhoto: { en: "Remove photo", zh: "删除图片", fr: "Retirer la photo" },
  soldOutTitle: { en: "Sold out: shows as unavailable on the customer menu and can't be ordered; tap again when back in stock.", zh: "沽清:顾客菜单显示售罄、不能下单;有货了再点一下恢复", fr: "Épuisé : affiché comme indisponible sur le menu client; touchez à nouveau une fois réapprovisionné." },
  soldOutOn: { en: "● Sold out · tap to restore", zh: "● 沽清中 · 点击恢复", fr: "● Épuisé · toucher pour rétablir" },
  soldOutMark: { en: "Mark sold out", zh: "标记沽清", fr: "Marquer épuisé" },
  nameZhInline: { en: "Chinese name", zh: "中文名", fr: "Nom chinois" },
  marketTag: { en: "Market price · hidden on the customer menu", zh: "时价 · 顾客菜单不显示价格", fr: "Prix du jour · masqué sur le menu client" },
  addSizes: { en: "+ Sizes (portions)", zh: "＋ 多规格(大小/份量)", fr: "+ Formats (tailles/portions)" },
  marketCheckTitle: { en: "Market-price dish: the menu shows a gold “Market” tag and hides the price; customers can still order, and staff enter the actual price before completing.", zh: "时价菜:菜单显示金色「时价」标签、隐藏价格;顾客可下单,标记完成前店员录入当日实价", fr: "Plat à prix du jour : le menu affiche une étiquette dorée et masque le prix; le personnel saisit le prix réel avant de terminer." },
  marketLabel: { en: "Market", zh: "时价", fr: "Prix du jour" },
  sizesTitle: { en: "Sizes (one price each)", zh: "多规格(每个大小一个价)", fr: "Formats (un prix chacun)" },
  removeSize: { en: "Remove this size", zh: "删除这个规格", fr: "Retirer ce format" },
  addOneSize: { en: "+ Add a size", zh: "＋ 加一个规格", fr: "+ Ajouter un format" },
  del: { en: "Delete", zh: "删除", fr: "Supprimer" },
  emptyDishes: { en: "No dishes yet — add your first one above.", zh: "还没有菜品,上面添加第一道菜。", fr: "Aucun plat — ajoutez le premier ci-dessus." },
  photoTitle: { en: "Upload your existing menu photo", zh: "上传现有菜单照片", fr: "Importez une photo de votre menu" },
  photoBody: { en: "Snap your current paper / image menu — the system reads dish names and prices, adds English translations, and creates the dishes in bulk.", zh: "拍一张你现在的纸质 / 图片菜单,系统自动识别菜名与价格、补上英文翻译,批量生成菜品。", fr: "Photographiez votre menu papier / image — le système lit les noms et les prix, ajoute les traductions et crée les plats en lot." },
  photoCta: { en: "Choose a photo (coming soon)", zh: "选择照片(即将开放)", fr: "Choisir une photo (bientôt)" },
  photoSoon: { en: "AI recognition is being integrated", zh: "AI 识别功能正在接入中", fr: "La reconnaissance IA est en cours d'intégration" },
  menuPreview: { en: "Menu preview", zh: "菜单预览", fr: "Aperçu du menu" },
  exportPdf: { en: "Export PDF (coming soon)", zh: "导出 PDF(即将开放)", fr: "Exporter en PDF (bientôt)" },
  menuHeader: { en: "MENU", zh: "菜单 MENU", fr: "MENU" },
  previewEmpty: { en: "Add dishes and the menu builds here in real time", zh: "添加菜品后这里实时生成菜单", fr: "Ajoutez des plats et le menu se construit ici en temps réel" },
  fromPrice: { en: "from", zh: "起", fr: "dès" },
  errNoName: { en: "Please enter a dish name", zh: "请填写菜名", fr: "Veuillez saisir un nom de plat" },
  errUpload: { en: "Image upload failed: ", zh: "图片上传失败:", fr: "Échec du téléversement de l'image : " },
  errAdd: { en: "Add failed: ", zh: "添加失败:", fr: "Échec de l'ajout : " },
} satisfies Record<string, Dict>;

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
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("manual");
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [catOrder, setCatOrder] = useState<string[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [search, setSearch] = useState(""); // filter the 365-dish list

  // new-dish form
  const [zh, setZh] = useState("");
  const [en, setEn] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Which languages this shop authors in. First = primary (required) field.
  // Dish data is zh/en only, so this resolves to one of those as the primary.
  const [menuLangs, setMenuLangs] = useState<string[] | null>(null);
  const primaryLang: "zh" | "en" = resolveOfferedLangs(menuLangs)[0] === "en" ? "en" : "zh";
  const secondaryLang: "zh" | "en" = primaryLang === "zh" ? "en" : "zh";
  const secondaryOffered = resolveOfferedLangs(menuLangs).includes(secondaryLang);
  // Reveal the secondary-language field. Shown by default for a bilingual shop;
  // collapsed behind "+ Add …" for a single-language (e.g. English-only) vendor.
  const [showSecondary, setShowSecondary] = useState(false);
  useEffect(() => { setShowSecondary(secondaryOffered); }, [secondaryOffered]);

  useEffect(() => {
    listMenuItemsRaw(slug).then(setDishes);
    getCatOrder(slug).then(setCatOrder);
    getMenuLangs(slug).then(setMenuLangs).catch(() => setMenuLangs([]));
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
    // Require the PRIMARY-language name (English for an English-first vendor),
    // not Chinese specifically.
    const primaryName = (primaryLang === "en" ? en : zh).trim();
    if (!primaryName) {
      alert(t(T.errNoName));
      return;
    }
    setBusy(true);
    let image_url = "";
    if (imageFile) {
      const up = await uploadMenuImage(slug, imageFile);
      if (up.error) {
        setBusy(false);
        alert(t(T.errUpload) + up.error);
        return;
      }
      image_url = up.url ?? "";
    }
    // name_zh is the kitchen-ticket / receipt primary (lineName reads it), so an
    // English-only vendor who left Chinese blank still gets a real ticket name:
    // fall back name_zh to the English name. name_en stays as typed.
    const name_zh = zh.trim() || (primaryLang === "en" ? en.trim() : "");
    const { error } = await addMenuItem(slug, { name_zh, name_en: en.trim(), price, category, image_url });
    setBusy(false);
    if (error) {
      alert(t(T.errAdd) + error);
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
      alert(t(T.errUpload) + up.error);
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

  // back-office search: filter by zh/en name (365 dishes is a lot to scroll)
  const sq = search.trim().toLowerCase();
  const visibleDishes = sq
    ? dishes.filter((d) => d.name_zh.toLowerCase().includes(sq) || (d.name_en || "").toLowerCase().includes(sq))
    : dishes;

  // editable list grouped by category in the saved order; search filters within.
  const visibleGrouped = [
    ...presentCats.map((c) => ({ category: c, items: visibleDishes.filter((d) => d.category === c) })),
    { category: "", items: visibleDishes.filter((d) => !d.category || !presentCats.includes(d.category)) },
  ].filter((g) => g.items.length > 0);

  const toggleSoldOut = (d: MenuItem, next: boolean) => {
    patchLocal(d.id, { sold_out: next });
    updateMenuItem(d.id, { sold_out: next });
  };

  const reorderCat = (from: number, to: number) => {
    if (from === to) return;
    const next = [...presentCats];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setCatOrder(next);
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← {t(T.back)}</Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{mod.icon} {t(mod.label)}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{t(mod.pain)}</p>
        </div>
        <span className="pill bg-brand-wash text-brand">{dishes.length} {t(T.dishesPill)}</span>
      </header>

      {/* category order */}
      {presentCats.length > 1 && (
        <div className="card mb-6 p-4">
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setOrderOpen((o) => !o)}
          >
            <span className="text-sm font-semibold text-ink">⚙️ {t(T.catOrder)}</span>
            <span className="text-xs text-ink-faint">
              {orderOpen ? t(T.collapse) : t(T.catOrderHint)}
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
              <p className="mt-2 text-xs text-ink-faint">{t(T.catDragNote)}</p>
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
              {t(T.tabManual)}
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 ${tab === "photo" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setTab("photo")}
            >
              {t(T.tabPhoto)}
            </button>
          </div>

          {tab === "manual" ? (
            <>
              <div className="card p-5">
                {/* Primary dish name (required, the shop's first menu language) +
                    an opt-in secondary. English-first vendors never see a forced
                    Chinese field (VT2 / design review). */}
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <label className="label">{primaryLang === "en" ? t(T.nameEnReq) : t(T.nameZh)}</label>
                    {!secondaryOffered && !showSecondary && (
                      <button
                        type="button"
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        onClick={() => setShowSecondary(true)}
                      >
                        {secondaryLang === "zh" ? t(T.addChinese) : t(T.addEnglish)}
                      </button>
                    )}
                  </div>
                  <input
                    className="input"
                    value={primaryLang === "en" ? en : zh}
                    onChange={(e) => (primaryLang === "en" ? setEn : setZh)(e.target.value)}
                    placeholder={primaryLang === "en" ? t(T.nameEnPh) : t(T.nameZhPh)}
                  />
                  <p className="mt-1 text-xs text-ink-faint">{t(T.namePrimaryHint)}</p>
                  {showSecondary && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between">
                        <label className="label">{secondaryLang === "zh" ? t(T.nameZhInline) : t(T.nameEn)}</label>
                        {!secondaryOffered && (
                          <button
                            type="button"
                            className="text-xs text-ink-faint hover:text-ink"
                            onClick={() => { setShowSecondary(false); (secondaryLang === "zh" ? setZh : setEn)(""); }}
                          >
                            {t(T.removeTranslation)}
                          </button>
                        )}
                      </div>
                      <input
                        className="input"
                        value={secondaryLang === "zh" ? zh : en}
                        onChange={(e) => (secondaryLang === "zh" ? setZh : setEn)(e.target.value)}
                        placeholder={secondaryLang === "zh" ? t(T.nameZhPh) : t(T.nameEnPh)}
                      />
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t(T.price)}</label>
                    <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="42" />
                  </div>
                  <div>
                    <label className="label">{t(T.category)}</label>
                    <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* dish image */}
                <div className="mt-3">
                  <label className="label">{t(T.photoOpt)}</label>
                  <div className="flex items-center gap-3">
                    <label className="btn-ghost cursor-pointer border border-slate-300">
                      {t(T.choosePhoto)}
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
                        <img src={imagePreview} alt={t(T.preview)} className="h-12 w-12 rounded-lg object-cover" />
                        <button onClick={() => pickImage(null)} className="text-xs text-ink-faint hover:text-red-600">{t(T.remove)}</button>
                      </div>
                    )}
                  </div>
                </div>

                <button className="btn-primary mt-4 disabled:opacity-50" onClick={add} disabled={busy}>
                  {busy ? t(T.saving) : t(T.addToMenu)}
                </button>
              </div>

              {/* 今日时价 lived here too, listing the same is_market dishes with the
                  same price inputs as 在线点餐订单 →「时价」. Two places to do one job,
                  and no rule about which one was authoritative. Removed 2026-07-20;
                  the 时价 tab is the single home for daily prices (it sits where staff
                  already are during service, and it blur-saves the same way this did).
                  The 时价 CHECKBOX below stays — that is how a dish becomes 时价. */}

              {/* dish list — inline editable */}
              <div className="mt-4 flex items-center justify-between px-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  {t(T.allDishes)}
                </div>
                <div className="text-xs text-ink-faint">
                  {sq ? `${visibleDishes.length} / ${dishes.length}` : dishes.length} {t(T.countSuffix)}
                </div>
              </div>
              {/* search box — find a dish among hundreds */}
              <div className="relative mt-2">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">🔍</span>
                <input
                  className="input w-full !pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t(T.searchPh)}
                  type="search"
                />
              </div>
              {sq && visibleDishes.length === 0 && (
                <p className="mt-4 text-center text-sm text-ink-faint">{t(T.noMatchA)}{search}{t(T.noMatchB)}</p>
              )}
              <div className="mt-2 space-y-6">
                {visibleGrouped.map((g) => (
                  <div key={g.category || "_uncat"} className="space-y-2">
                    <div className="sticky top-0 z-10 -mx-1 flex items-baseline gap-2 bg-[#FBFAF8]/90 px-1 py-1.5 backdrop-blur">
                      <span className="text-sm font-bold text-ink">{g.category || "未分类"}</span>
                      <span className="text-xs text-ink-faint">{g.items.length}</span>
                    </div>
                    {g.items.map((d) => (
                  <div key={d.id} className={`card flex gap-4 p-3 transition ${d.sold_out ? "bg-red-50/40 ring-1 ring-red-200" : ""}`}>
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
                        <label className="block h-full w-full cursor-pointer" title={d.image_url ? t(T.clickChange) : t(T.clickUpload)}>
                          {d.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt={d.name_zh} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-slate-100 text-xs text-ink-faint">{t(T.addPhotoTile)}</div>
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
                            title={t(T.removePhoto)}
                            aria-label={t(T.removePhoto)}
                            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-[11px] leading-none text-white transition hover:bg-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* right column: 沽清 · 中文 · English · 价格 */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => toggleSoldOut(d, !d.sold_out)}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                            d.sold_out ? "bg-red-600 text-white" : "bg-slate-100 text-ink-soft hover:bg-slate-200"
                          }`}
                          title={t(T.soldOutTitle)}
                        >
                          {d.sold_out ? t(T.soldOutOn) : t(T.soldOutMark)}
                        </button>
                      </div>
                      <input
                        className="input w-full !py-2 text-base font-medium"
                        value={d.name_zh}
                        placeholder={t(T.nameZhInline)}
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
                          {/* 时价 dishes have no fixed price — hide the field; use the 今日时价 panel below */}
                          {!d.is_market ? (
                            <div className="flex w-32 items-center rounded-lg border border-slate-300 px-2">
                              <span className="text-sm text-ink-faint">$</span>
                              <input
                                className="w-full bg-transparent py-1.5 text-sm outline-none"
                                type="number"
                                step="0.01"
                                value={d.price ?? ""}
                                placeholder={t(T.price)}
                                onChange={(e) => patchLocal(d.id, { price: e.target.value })}
                                onBlur={(e) => saveField(d.id, { price: e.target.value })}
                              />
                            </div>
                          ) : (
                            <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{t(T.marketTag)}</span>
                          )}
                          {!d.is_market && (
                            <button onClick={() => addVariant(d)} className="text-xs font-medium text-brand hover:underline">{t(T.addSizes)}</button>
                          )}
                          <label className="flex cursor-pointer items-center gap-1 text-xs text-ink-soft" title={t(T.marketCheckTitle)}>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-amber-600"
                              checked={!!d.is_market}
                              onChange={(e) => {
                                patchLocal(d.id, { is_market: e.target.checked });
                                updateMenuItem(d.id, { is_market: e.target.checked });
                              }}
                            />
                            {t(T.marketLabel)}
                          </label>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                          <div className="mb-1.5 text-xs font-medium text-ink-soft">{t(T.sizesTitle)}</div>
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
                                <button onClick={() => rmVariant(d, i)} className="flex-none px-1 text-xs text-ink-faint hover:text-red-600" title={t(T.removeSize)}>✕</button>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => addVariant(d)} className="mt-2 text-xs font-medium text-brand hover:underline">{t(T.addOneSize)}</button>
                        </div>
                      )}
                    </div>

                    <button onClick={() => remove(d.id)} className="flex-none self-start px-1 text-xs text-ink-faint hover:text-red-600">{t(T.del)}</button>
                  </div>
                    ))}
                  </div>
                ))}
                {dishes.length === 0 && (
                  <div className="card p-6 text-center text-sm text-ink-faint">{t(T.emptyDishes)}</div>
                )}
              </div>
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-300 p-10 text-center">
              <div className="text-4xl">📷</div>
              <div className="font-medium text-ink">{t(T.photoTitle)}</div>
              <p className="max-w-sm text-sm text-ink-soft">
                {t(T.photoBody)}
              </p>
              <button disabled className="btn-primary cursor-not-allowed opacity-40">{t(T.photoCta)}</button>
              <p className="text-xs text-ink-faint">{t(T.photoSoon)}</p>
            </div>
          )}
        </section>

        {/* right: live preview */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t(T.menuPreview)}</div>
            <button disabled className="text-xs text-ink-faint opacity-50">{t(T.exportPdf)}</button>
          </div>
          <div className="card overflow-hidden">
            <div className="bg-ink px-5 py-4 text-center text-white">
              <div className="text-lg font-bold tracking-wide">{t(T.menuHeader)}</div>
            </div>
            <div className="p-5">
              {grouped.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-faint">{t(T.previewEmpty)}</div>
              ) : (
                grouped.map((g) => (
                  <div key={g.category} className="mb-4 last:mb-0">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">{g.category}</div>
                    {g.items.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-2 pt-1 last:border-0">
                        <div className="flex min-w-0 items-center gap-2">
                          {d.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={d.image_url} alt={primaryLang === "en" ? d.name_en || d.name_zh : d.name_zh} className="h-8 w-8 flex-none rounded object-cover" />
                          )}
                          {/* Preview mirrors the customer menu: primary-language
                              name, and a second-language line only when the shop
                              actually offers two languages (else an English-only
                              vendor would see its English name printed twice). */}
                          {(() => {
                            const pName = (primaryLang === "en" ? d.name_en || d.name_zh : d.name_zh) || "";
                            const sName = (secondaryLang === "en" ? d.name_en : d.name_zh) || "";
                            return (
                              <div className="min-w-0">
                                <div className="font-medium text-ink">{pName}</div>
                                {secondaryOffered && sName && sName.trim() !== pName.trim() && (
                                  <div className="text-xs text-ink-faint">{sName}</div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex-none font-semibold text-ink">
                          {normVariants(d.variants).length > 0 ? `${t(T.fromPrice)} ${fmtPrice(displayPrice({ ...d, variants: normVariants(d.variants) }))}` : fmtPrice(d.price)}
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
