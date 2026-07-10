"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listMenuItems } from "@/lib/menu";
import { displayTable } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { menuUrl, qrLockErrorMessage, tableUrl as qrTableUrl, togoUrl as qrTogoUrl } from "@/lib/qrContract";
import DeliveryZoneEditor from "@/components/DeliveryZoneEditor";
import { useLang, type Dict } from "@/app/i18n";

// Trilingual UI chrome (EN default, + 中 / FR). Merchant data (dish/table names) is never translated.
const T: Record<string, Dict> = {
  back: { en: "← Overview", zh: "← 总览", fr: "← Aperçu" },
  tabTables: { en: "🪑 One code per table (dine-in)", zh: "🪑 每桌一码（堂食）", fr: "🪑 Un code par table (sur place)" },
  tabTogo: { en: "🛵 Takeout / pickup code", zh: "🛵 外卖 / 自取码", fr: "🛵 Code à emporter / à récupérer" },
  tabSingle: { en: "🏪 One code for whole store", zh: "🏪 整店一码", fr: "🏪 Un code pour tout le magasin" },
  qrMenuAlt: { en: "Menu QR code", zh: "菜单二维码", fr: "Code QR du menu" },
  scanToSeeMenu: { en: "Customers scan to view the menu", zh: "顾客扫码即看菜单", fr: "Les clients scannent pour voir le menu" },
  tableChosenAtOrder: { en: "Table number is entered by the customer when ordering", zh: "桌号由顾客下单时选填", fr: "Le numéro de table est saisi par le client à la commande" },
  copied: { en: "Copied ✓", zh: "已复制 ✓", fr: "Copié ✓" },
  copyLink: { en: "Copy link", zh: "复制链接", fr: "Copier le lien" },
  openPreview: { en: "Open preview", zh: "打开预览", fr: "Ouvrir l'aperçu" },
  whereMenuFrom: { en: "Where does this menu come from?", zh: "这张菜单从哪来？", fr: "D'où vient ce menu ?" },
  menuLivePre: {
    en: 'Reads dishes live from "🍽️ Menu settings" — currently ',
    zh: "实时读取「🍽️ 菜单设置」里的菜品 —— 当前共 ",
    fr: 'Lit les plats en direct depuis « 🍽️ Réglages du menu » — actuellement ',
  },
  menuLivePost: {
    en: " in total. Renaming / repricing / swapping photos syncs to the scan page instantly, no reprint needed.",
    zh: " 道。改名 / 改价 / 换图，扫码页立即同步，无需重印。",
    fr: " au total. Renommer / changer le prix / la photo se synchronise aussitôt sur la page scannée, sans réimpression.",
  },
  editMenu: { en: "Edit menu →", zh: "去编辑菜单 →", fr: "Modifier le menu →" },
  permanentTitle: { en: "These QR codes are permanent — safe to print on signs", zh: "这些二维码是永久固定的，做牌子放心用", fr: "Ces codes QR sont permanents — prêts à imprimer sur des panneaux" },
  permanentPre: {
    en: "The URL each code points to never changes (e.g. ",
    zh: "每个码指向的网址永远不变（如 ",
    fr: "L'URL de chaque code ne change jamais (ex. ",
  },
  permanentMid: {
    en: "); changing dishes, prices or photos won't affect it. ",
    zh: "），改菜品、改价格、换图都不会影响它。",
    fr: ") ; modifier les plats, les prix ou les photos n'y change rien. ",
  },
  permanentBold: {
    en: "As long as you don't do these two things, the signs last forever:",
    zh: "只要不做这两件事，牌子可以一直用：",
    fr: "Tant que vous évitez ces deux choses, les panneaux durent toujours :",
  },
  dontChangeSlugPre: { en: "Don't change the store URL identifier \"", zh: "不要更改店铺网址标识「", fr: "Ne changez pas l'identifiant d'URL du magasin « " },
  dontChangeSlugPost: { en: "\"", zh: "」", fr: " »" },
  dontChangeTables: { en: "Don't change table numbers ({tables}) — keep any table already made into a sign unchanged", zh: "不要更改桌号（{tables}）—— 已做成牌子的桌号请保持不变", fr: "Ne changez pas les numéros de table ({tables}) — gardez inchangée toute table déjà imprimée sur un panneau" },
  lockedBadge: { en: "🔒 Locked — URL and table numbers are protected by the database (new tables can still be added; unlocking must be done in Supabase)", zh: "🔒 已锁定 —— 网址与桌号受数据库保护（可新增桌号；解锁需在 Supabase 操作）", fr: "🔒 Verrouillé — l'URL et les numéros de table sont protégés par la base de données (on peut ajouter des tables ; le déverrouillage se fait dans Supabase)" },
  locking: { en: "Locking…", zh: "锁定中…", fr: "Verrouillage…" },
  lockCta: { en: "🔒 Signs printed — lock to protect", zh: "🔒 牌子已印好，锁定保护", fr: "🔒 Panneaux imprimés — verrouiller pour protéger" },
  lockHint: { en: "Once locked, the two rules above are enforced by the database, not just by trust", zh: "锁定后上面两条由数据库强制执行，不再只靠自觉", fr: "Une fois verrouillé, les deux règles ci-dessus sont imposées par la base de données, pas seulement par confiance" },
  tablesDescPre: {
    en: "A dedicated QR code per table (",
    zh: "每张桌一个专属二维码（共 ",
    fr: "Un code QR dédié par table (",
  },
  tablesDescPost: {
    en: " tables total: {tables}). Whichever table a customer scans at, the order is auto-tagged to that table — clear at a glance in the back office and at checkout, no need to ask. Print the whole page, cut apart, and stick on the matching tables.",
    zh: " 桌：{tables}）。顾客在几号桌扫码，订单自动标记该桌 —— 后台和结账一眼看清，无需再问。整页打印后剪开，贴到对应桌面。",
    fr: " tables au total : {tables}). Selon la table où le client scanne, la commande est automatiquement associée à cette table — visible d'un coup d'œil au back-office et à l'encaissement, sans avoir à demander. Imprimez la page entière, découpez, et collez sur les tables correspondantes.",
  },
  tableLabel: { en: "Table {t}", zh: "{t} 号桌", fr: "Table {t}" },
  tableQrAlt: { en: "Table {t} QR code", zh: "{t}号桌二维码", fr: "Code QR de la table {t}" },
  dineInScan: { en: "Dine-in · scan to order", zh: "堂食 · 扫码点餐", fr: "Sur place · scanner pour commander" },
  preview: { en: "Preview", zh: "预览", fr: "Aperçu" },
  generating: { en: "Generating…", zh: "生成中…", fr: "Génération…" },
  downloadAll: { en: "⬇️ Download all QR codes (HD ZIP)", zh: "⬇️ 一键下载全部二维码（高清 ZIP）", fr: "⬇️ Télécharger tous les codes QR (ZIP HD)" },
  printPage: { en: "🖨️ Print full page", zh: "🖨️ 打印整页", fr: "🖨️ Imprimer la page entière" },
  downloadHint: {
    en: "You get HD PNGs with table numbers (1024px each) + a URL reference sheet, bundled into a ZIP — send it straight to the sign maker. The table list can be edited in the database tenants.tables.",
    zh: "下载的是高清带桌号的 PNG（每张 1024px）+ 一份网址对照表，打包成 ZIP，直接发给做牌子的商家即可。桌号列表可在数据库 tenants.tables 修改。",
    fr: "Vous obtenez des PNG HD avec les numéros de table (1024px chacun) + une feuille de référence des URL, regroupés dans un ZIP — à envoyer directement au fabricant de panneaux. La liste des tables se modifie dans la base de données tenants.tables.",
  },
  togoBadge: { en: "Takeout / pickup only", zh: "外卖 / 自取 专用", fr: "À emporter / à récupérer uniquement" },
  togoQrAlt: { en: "Takeout pickup QR code", zh: "外卖自取二维码", fr: "Code QR à emporter / à récupérer" },
  stickAtDoor: { en: "Stick on the door / counter / flyers", zh: "贴在门口 / 收银台 / 传单上", fr: "À coller sur la porte / le comptoir / les prospectus" },
  togoPayNote: { en: "Customers choose pickup or delivery; the order reaches the kitchen only after paying online", zh: "顾客选自取或配送，须在线支付后订单才进厨房", fr: "Les clients choisissent la récupération ou la livraison ; la commande arrive en cuisine seulement après paiement en ligne" },
  diffFromDineIn: { en: "How is it different from the dine-in code?", zh: "和堂食码有什么不同？", fr: "En quoi diffère-t-il du code sur place ?" },
  diffPickupPre: { en: "• Customer chooses ", zh: "• 顾客选 ", fr: "• Le client choisit " },
  diffPickupB1: { en: "pickup", zh: "自取", fr: "récupération" },
  diffPickupMid: { en: " or ", zh: " 或 ", fr: " ou " },
  diffPickupB2: { en: "delivery", zh: "配送", fr: "livraison" },
  diffPickupPost: { en: " (no table number)", zh: "（不选桌号）", fr: " (pas de numéro de table)" },
  diffDelivery: { en: "• Delivery is downtown only (verified by postal code), $30 minimum, includes a 10% delivery tip", zh: "• 配送仅限市中心（按邮编验证），满 $30 起送，含 10% 配送小费", fr: "• Livraison au centre-ville seulement (vérifiée par code postal), minimum de 30 $, avec 10 % de pourboire de livraison" },
  diffPayFirstPre: { en: "• ", zh: "• ", fr: "• " },
  diffPayFirstB: { en: "Must pay online first", zh: "须先在线支付", fr: "Paiement en ligne obligatoire d'abord" },
  diffPayFirstPost: { en: "; the order prints in the kitchen only after payment succeeds", zh: "，付款成功订单才进厨房打印", fr: " ; la commande s'imprime en cuisine seulement après paiement réussi" },
  diffDineInSafe: { en: "• Dine-in table codes are unaffected — customers can still call a server to pay", zh: "• 堂食桌码不受影响，仍可叫服务员买单", fr: "• Les codes de table sur place ne sont pas affectés — les clients peuvent toujours appeler un serveur pour payer" },
  paymentComingTitle: { en: "⏳ Online payment coming soon", zh: "⏳ 在线支付即将开通", fr: "⏳ Paiement en ligne bientôt disponible" },
  paymentComingDesc: {
    en: "Until Clover payment integration is done, don't post this code yet — customers can view the menu but can't submit takeout/delivery orders for now.",
    zh: "Clover 支付接入完成前，这个码先不要贴出去 —— 顾客能看菜单，但暂时无法提交外卖/配送订单。",
    fr: "Tant que l'intégration du paiement Clover n'est pas terminée, ne publiez pas encore ce code — les clients peuvent voir le menu mais ne peuvent pas soumettre de commandes à emporter/en livraison pour l'instant.",
  },
  confirmLock: {
    en: "Once locked: the store URL identifier and existing table numbers can't be changed (new tables can be added), and the store can't be deleted.\nUnlocking can only be done in the Supabase back office.\n\nAre the signs already printed? Confirm lock?",
    zh: "锁定后：店铺网址标识和已有桌号将不可修改（可新增桌号），店铺不可删除。\n解锁只能在 Supabase 后台操作。\n\n牌子已经印好了吗？确认锁定？",
    fr: "Une fois verrouillé : l'identifiant d'URL du magasin et les numéros de table existants ne peuvent plus être modifiés (on peut ajouter des tables), et le magasin ne peut pas être supprimé.\nLe déverrouillage se fait uniquement dans le back-office Supabase.\n\nLes panneaux sont-ils déjà imprimés ? Confirmer le verrouillage ?",
  },
  lockFailed: { en: "Lock failed: {msg}", zh: "锁定失败：{msg}", fr: "Échec du verrouillage : {msg}" },
  downloadFailed: { en: "Download failed, please try again", zh: "下载失败，请重试", fr: "Échec du téléchargement, veuillez réessayer" },
};

const qrSrc = (url: string, size = 300) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(url)}`;

type Mode = "single" | "tables" | "togo";

// 富来小厨's default physical tables; overridden by tenants.tables when set.
const FALLBACK_TABLES = ["1", "2", "2A", "3", "4", "5", "6", "7", "8", "8A", "8B", "10", "11", "12"];

export default function QrMenuPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const { t } = useLang();
  const t2 = t; // alias for use inside tables.map((t) => …) where the map param shadows t
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
    if (!window.confirm(t(T.confirmLock))) return;
    setLocking(true);
    const { error } = await supabase.from("tenants").update({ qr_locked_at: new Date().toISOString() }).eq("slug", slug);
    setLocking(false);
    if (error) {
      alert(qrLockErrorMessage(error.message, "zh") ?? t(T.lockFailed).replace("{msg}", error.message));
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
      alert(t(T.downloadFailed));
    } finally {
      setZipping(false);
    }
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">{t(T.back)}</Link>

      <header className="mt-3 mb-5">
        <h1 className="text-2xl font-bold text-ink">{mod.icon} {mod.label.zh}</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
      </header>

      {/* mode switch */}
      <div className="mb-6 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "tables" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("tables")}
        >
          {t(T.tabTables)}
        </button>
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "togo" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("togo")}
        >
          {t(T.tabTogo)}
        </button>
        <button
          className={`rounded-md px-4 py-1.5 ${mode === "single" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
          onClick={() => setMode("single")}
        >
          {t(T.tabSingle)}
        </button>
      </div>

      {mode === "single" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col items-center p-8 text-center">
            <div className="rounded-2xl border border-slate-200 p-3">
              {origin ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc(baseUrl)} alt={t(T.qrMenuAlt)} className="h-56 w-56" />
              ) : (
                <div className="h-56 w-56 animate-pulse rounded bg-slate-100" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">{t(T.scanToSeeMenu)}</p>
            <p className="text-xs text-ink-faint">{t(T.tableChosenAtOrder)}</p>
            <div className="mt-5 w-full">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-ink-soft">{baseUrl}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => copy(baseUrl)} className="btn-ghost flex-1 border border-slate-300">{copied ? t(T.copied) : t(T.copyLink)}</button>
                <a href={baseUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">{t(T.openPreview)}</a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">{t(T.whereMenuFrom)}</div>
              <p className="mt-2 text-sm text-ink-soft">
                {t(T.menuLivePre)}<b className="text-ink">{count ?? "…"}</b>{t(T.menuLivePost)}
              </p>
              <Link href={`/${slug}/m/menu-generator`} className="mt-3 inline-block text-sm text-brand hover:underline">{t(T.editMenu)}</Link>
            </div>
          </section>
        </div>
      )}

      {mode === "tables" && (
        <div>
          {/* permanent-code notice — important before ordering custom signs */}
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">📌</span>
              <div className="text-sm text-amber-900">
                <div className="font-bold">{t(T.permanentTitle)}</div>
                <p className="mt-1 leading-relaxed">
                  {t(T.permanentPre)}<code className="rounded bg-amber-100 px-1">bentoos.io/menu/{slug}?t=8A</code>{t(T.permanentMid)}<b>{t(T.permanentBold)}</b>
                </p>
                <ul className="mt-1 list-disc pl-5">
                  <li>{t(T.dontChangeSlugPre)}<b>{slug}</b>{t(T.dontChangeSlugPost)}</li>
                  <li>{t(T.dontChangeTables).replace("{tables}", tables.map(displayTable).join("、"))}</li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {lockedAt ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      {t(T.lockedBadge)}
                    </span>
                  ) : (
                    <>
                      <button onClick={lockNow} disabled={locking} className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
                        {locking ? t(T.locking) : t(T.lockCta)}
                      </button>
                      <span className="text-xs text-amber-800/80">{t(T.lockHint)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="card mb-4 p-4">
            <p className="text-sm text-ink-soft">
              {t(T.tablesDescPre)}<b className="text-ink">{tables.length}</b>{t(T.tablesDescPost).replace("{tables}", tables.map(displayTable).join("、"))}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
            {tables.map((t) => (
              <div key={t} className="card flex flex-col items-center p-3 text-center">
                <div className="text-base font-bold text-ink">{t2(T.tableLabel).replace("{t}", displayTable(t))}</div>
                {origin ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrSrc(tableUrl(t), 200)} alt={t2(T.tableQrAlt).replace("{t}", displayTable(t))} className="my-2 h-32 w-32" />
                ) : (
                  <div className="my-2 h-32 w-32 animate-pulse rounded bg-slate-100" />
                )}
                <div className="text-[11px] text-ink-faint">{t2(T.dineInScan)}</div>
                <a href={tableUrl(t)} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand hover:underline print:hidden">{t2(T.preview)}</a>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
            <button onClick={downloadAll} disabled={zipping} className="btn-primary disabled:opacity-60">
              {zipping ? t(T.generating) : t(T.downloadAll)}
            </button>
            <button onClick={() => window.print()} className="btn-ghost border border-slate-300">{t(T.printPage)}</button>
            <p className="w-full text-xs text-ink-faint sm:w-auto">
              {t(T.downloadHint)}
            </p>
          </div>
        </div>
      )}

      {mode === "togo" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card flex flex-col items-center border-jade/30 p-8 text-center">
            <span className="mb-2 rounded-full bg-jade-wash px-3 py-1 text-xs font-bold text-jade">{t(T.togoBadge)}</span>
            <div className="rounded-2xl border-2 border-jade/40 p-3">
              {origin ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrSrc(togoUrl)} alt={t(T.togoQrAlt)} className="h-56 w-56" />
              ) : (
                <div className="h-56 w-56 animate-pulse rounded bg-slate-100" />
              )}
            </div>
            <p className="mt-4 text-sm font-medium text-ink">{t(T.stickAtDoor)}</p>
            <p className="text-xs text-ink-faint">{t(T.togoPayNote)}</p>
            <div className="mt-5 w-full">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="truncate text-ink-soft">{togoUrl}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => copy(togoUrl)} className="btn-ghost flex-1 border border-slate-300">{copied ? t(T.copied) : t(T.copyLink)}</button>
                <a href={togoUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-center">{t(T.openPreview)}</a>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="card p-5">
              <div className="text-sm font-semibold text-ink">{t(T.diffFromDineIn)}</div>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                <li>{t(T.diffPickupPre)}<b className="text-ink">{t(T.diffPickupB1)}</b>{t(T.diffPickupMid)}<b className="text-ink">{t(T.diffPickupB2)}</b>{t(T.diffPickupPost)}</li>
                <li>{t(T.diffDelivery)}</li>
                <li>{t(T.diffPayFirstPre)}<b className="text-ink">{t(T.diffPayFirstB)}</b>{t(T.diffPayFirstPost)}</li>
                <li>{t(T.diffDineInSafe)}</li>
              </ul>
            </div>
            <div className="card border-amber-200 bg-amber-50 p-5">
              <div className="text-sm font-semibold text-amber-800">{t(T.paymentComingTitle)}</div>
              <p className="mt-1 text-sm text-amber-800/80">
                {t(T.paymentComingDesc)}
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
