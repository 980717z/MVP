"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTenant, type Tenant } from "@/lib/store";
import { MODULE_BY_ID, type ModuleDef } from "@/lib/catalog";
import { displayTable, money, num, sum } from "@/lib/format";
import { listOrders, type Order } from "@/lib/orders";
import { useLang, type Dict } from "@/app/i18n";

const ORDERS_MODULE = "online-orders";

// Trilingual UI chrome (EN default, + 中 / FR). Merchant data (store name, dish
// names, numbers) is never translated here — only labels, headings and hints.
const T: Record<string, Dict> = {
  ready: { en: "{x} is ready", zh: "{x} 已创建", fr: "{x} est prêt" },
  readyHint: {
    en: "Pick the features you need — we'll generate the back-office for you.",
    zh: "现在选择你需要的功能，系统会为你生成对应的后台。",
    fr: "Choisissez les fonctions dont vous avez besoin — nous générons le back-office pour vous.",
  },
  setupModules: { en: "Set up modules →", zh: "设置后台功能 →", fr: "Configurer les modules →" },
  overview: { en: "Overview", zh: "总览", fr: "Aperçu" },
  metaOne: {
    en: "{n} modules · {u} account",
    zh: "共 {n} 个功能 · {u} 个账号",
    fr: "{n} modules · {u} compte",
  },
  metaMany: {
    en: "{n} modules · {u} accounts",
    zh: "共 {n} 个功能 · {u} 个账号",
    fr: "{n} modules · {u} comptes",
  },
  allSet: { en: "You're all set up", zh: "开张准备就绪", fr: "Tout est prêt" },
  allSetHint: {
    en: "Add your first record, or let a customer scan & order — revenue, orders and stock show up here live.",
    zh: "录入第一笔数据，或让顾客扫码下单 —— 营收、订单、库存会实时出现在这里。",
    fr: "Ajoutez une première entrée, ou laissez un client scanner et commander — revenus, commandes et stock s'affichent ici en direct.",
  },
  addData: { en: "Add data →", zh: "录入数据 →", fr: "Ajouter des données →" },
  manageModules: { en: "Manage modules", zh: "管理功能", fr: "Gérer les modules" },
  todayRevenue: { en: "Today's revenue", zh: "今日营收", fr: "Revenus du jour" },
  noFinance: { en: "No finance module yet", zh: "未启用财务模块", fr: "Aucun module financier" },
  ordersWaiting: { en: "Orders waiting", zh: "待处理订单", fr: "Commandes en attente" },
  viewLiveOrders: { en: "View live orders", zh: "查看实时订单", fr: "Voir les commandes en direct" },
  lowStock: { en: "Low stock", zh: "库存预警", fr: "Stock bas" },
  allStocked: { en: "All stocked", zh: "库存充足", fr: "Stock suffisant" },
  liveOrders: { en: "Live orders", zh: "实时订单", fr: "Commandes en direct" },
  viewAll: { en: "View all", zh: "全部", fr: "Tout voir" },
  noOrdersWaiting: { en: "No orders waiting", zh: "暂无待处理订单", fr: "Aucune commande en attente" },
  noOrdersHint: {
    en: "Orders appear here the moment a customer scans & orders.",
    zh: "顾客扫二维码下单后会实时出现在这里。",
    fr: "Les commandes apparaissent ici dès qu'un client scanne et commande.",
  },
  statusNew: { en: "New", zh: "新单", fr: "Nouveau" },
  statusPrep: { en: "Prep", zh: "备餐", fr: "Prépa" },
  table: { en: "Table", zh: "桌", fr: "Table" },
  takeout: { en: "Takeout", zh: "外卖", fr: "À emporter" },
  now: { en: "now", zh: "刚刚", fr: "à l'instant" },
  quickAccess: { en: "Quick access", zh: "快速进入", fr: "Accès rapide" },
  rows: { en: "", zh: "条", fr: "" },
};

export default function Dashboard() {
  const slug = useParams().tenant as string;
  const { lang, t } = useLang();
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    getTenant(slug).then(setTenant);
  }, [slug]);

  useEffect(() => {
    let alive = true;
    listOrders(slug)
      .then((o) => alive && setOrders(o))
      .catch(() => {
        /* orders table may be empty / not provisioned — degrade quietly */
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  // catalog labels are still {zh,en} only — render via current lang (fr falls back to en)
  const tl = (b: { zh: string; en: string }) => (lang === "zh" ? b.zh : b.en);
  const cjk = lang === "zh";

  if (!tenant) return null;

  // brand-new store: no features picked yet → guide owner to set up
  if (tenant.enabled.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center px-6">
        <div className="card max-w-md p-8 text-center">
          <div className="text-4xl">🛠️</div>
          <h1 className="mt-3 text-xl font-bold text-ink">
            {t(T.ready).replace("{x}", lang === "zh" ? tenant.name.zh : tenant.name.en)}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {t(T.readyHint)}
          </p>
          <Link href={`/${slug}/settings`} className="btn-primary mt-5 inline-block px-6 py-2.5">
            {t(T.setupModules)}
          </Link>
        </div>
      </main>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const moneyKpis = tenant.enabled
    .map((id) => MODULE_BY_ID[id])
    .filter((m): m is ModuleDef => !!m && !!m.amountKey && m.amountKind === "money");

  const todayRevenue = moneyKpis.reduce((acc, m) => {
    const rows = (tenant.records[m.id] ?? []).filter((r) => r.date === today);
    return acc + sum(rows, m.amountKey!);
  }, 0);

  const activeOrders = orders.filter((o) => o.status === "new" || o.status === "preparing");

  // low stock from the stock-loss module (on-hand = in − loss, per item)
  const hasStock = tenant.enabled.includes("stock-loss");
  const stockTotals: Record<string, number> = {};
  if (hasStock) {
    for (const r of tenant.records["stock-loss"] ?? []) {
      const item = (r.item as string) || "";
      if (!item) continue;
      stockTotals[item] = (stockTotals[item] || 0) + (parseFloat(r.inQty as string) || 0) - (parseFloat(r.lossQty as string) || 0);
    }
  }
  const lowNames = Object.entries(stockTotals).filter(([, v]) => v <= 5).map(([k]) => k);

  const hasRecords = Object.values(tenant.records).some((rows) => rows && rows.length > 0);
  const hasData = hasRecords || orders.length > 0;

  const orderTitle = (o: Order) => (o.table_no ? `${t(T.table)} ${displayTable(o.table_no)}` : t(T.takeout));
  const orderItems = (o: Order) => o.items.map((it) => `${cjk ? it.name_zh : it.name_en || it.name_zh} ×${it.qty}`).join(", ");
  const ago = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return t(T.now);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  };

  return (
    <main className="px-5 py-6 lg:px-7 lg:py-7">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink">{t(T.overview)}</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        {t(tenant.users.length === 1 ? T.metaOne : T.metaMany)
          .replace("{name}", lang === "zh" ? tenant.name.zh : tenant.name.en)
          .replace("{n}", String(tenant.enabled.length))
          .replace("{u}", String(tenant.users.length))}
      </p>

      {!hasData ? (
        /* first run: real data hasn't arrived yet — onboard, don't show a wall of zeros */
        <section className="mt-6 rounded-2xl border border-dashed border-[#D9E5DF] bg-brand-wash/40 p-8 text-center">
          <div className="text-3xl">🌱</div>
          <div className="mt-2 text-base font-bold text-ink">{t(T.allSet)}</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            {t(T.allSetHint)}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/${slug}/m/${tenant.enabled[0]}`} className="btn-primary px-5 py-2.5">
              {t(T.addData)}
            </Link>
            <Link href={`/${slug}/settings`} className="btn-ghost border border-[#EBEAE5] px-5 py-2.5">
              {t(T.manageModules)}
            </Link>
          </div>
        </section>
      ) : (
        <>
          {/* today at a glance */}
          <section className="mt-5 overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
            <div className="grid grid-cols-1 divide-y divide-[#EBEAE5] sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-3">
              <div className="p-5">
                <div className="text-[11px] font-semibold text-ink-faint">{t(T.todayRevenue)}</div>
                <div className="mt-1.5 text-[34px] font-extrabold leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">
                  {money(todayRevenue)}
                </div>
                {moneyKpis.length === 0 && (
                  <div className="mt-2 text-[11px] text-ink-faint">{t(T.noFinance)}</div>
                )}
              </div>

              <div className="p-5">
                <div className="text-[11px] font-semibold text-ink-faint">{t(T.ordersWaiting)}</div>
                <div className="mt-1.5 text-2xl font-extrabold text-ink [font-variant-numeric:tabular-nums]">{activeOrders.length}</div>
                <Link
                  href={`/${slug}/m/${ORDERS_MODULE}`}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-soft"
                >
                  {t(T.viewLiveOrders)} →
                </Link>
              </div>

              {hasStock && (
                <div className="p-5">
                  <div className="text-[11px] font-semibold text-ink-faint">{t(T.lowStock)}</div>
                  <div className="mt-1.5 text-2xl font-extrabold text-ink [font-variant-numeric:tabular-nums]">{lowNames.length}</div>
                  {lowNames.length > 0 ? (
                    <span className="mt-2.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      ⚠ {lowNames.slice(0, 3).join("、")}
                    </span>
                  ) : (
                    <div className="mt-2.5 text-[11px] text-ink-faint">{t(T.allStocked)}</div>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            {/* live orders */}
            <section className="overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
              <div className="flex items-center justify-between border-b border-[#F3F2EE] px-4 py-3">
                <h2 className="text-[13px] font-bold text-ink">{t(T.liveOrders)}</h2>
                <Link href={`/${slug}/m/${ORDERS_MODULE}`} className="text-[11.5px] font-semibold text-brand-ink hover:underline">
                  {t(T.viewAll)} →
                </Link>
              </div>
              {activeOrders.length === 0 ? (
                <div className="px-6 py-9 text-center">
                  <div className="text-2xl">🧾</div>
                  <div className="mt-2 text-sm font-semibold text-ink">{t(T.noOrdersWaiting)}</div>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
                    {t(T.noOrdersHint)}
                  </p>
                </div>
              ) : (
                <div>
                  {activeOrders.slice(0, 6).map((o) => (
                    <Link
                      key={o.id}
                      href={`/${slug}/m/${ORDERS_MODULE}`}
                      className="flex items-center gap-3 border-b border-[#F3F2EE] px-4 py-3 last:border-0 hover:bg-[#FBFAF8]"
                    >
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold ${o.status === "new" ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
                        {o.status === "new" ? t(T.statusNew) : t(T.statusPrep)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">
                        <b className="font-semibold text-ink">{orderTitle(o)}</b> · {orderItems(o)}
                      </span>
                      <span className="flex-none text-[13px] font-bold text-ink [font-variant-numeric:tabular-nums]">{money(o.total)}</span>
                      <span className="w-9 flex-none text-right text-[11px] text-ink-faint">{ago(o.created_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* quick access */}
            <section className="overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
              <div className="border-b border-[#F3F2EE] px-4 py-3">
                <h2 className="text-[13px] font-bold text-ink">{t(T.quickAccess)}</h2>
              </div>
              <div className="p-2">
                {tenant.enabled.map((id) => {
                  const m = MODULE_BY_ID[id];
                  if (!m) return null;
                  const rows = tenant.records[id] ?? [];
                  const isMoney = !!m.amountKey && m.amountKind === "money";
                  const todayRows = rows.filter((r) => r.date === today);
                  const stat = isMoney
                    ? money(sum(todayRows, m.amountKey!))
                    : `${rows.length} ${t(T.rows)}`.trim();
                  return (
                    <Link key={id} href={`/${slug}/m/${id}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-[#F3F2EE]">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-brand-wash text-base">{m.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{tl(m.label)}</span>
                        <span className="block truncate text-[11px] text-ink-faint">{tl(m.pain)}</span>
                      </span>
                      <span className="flex-none text-[11px] text-ink-faint [font-variant-numeric:tabular-nums]">{stat}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
