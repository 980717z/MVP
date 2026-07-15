"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTenant, getTrackPayments, type Tenant } from "@/lib/store";
import { MODULE_BY_ID, type ModuleDef } from "@/lib/catalog";
import { displayTable, money, moneyExact, num, sum } from "@/lib/format";
import { listOrders, type Order } from "@/lib/orders";
import { listSessionsInRange } from "@/lib/tableSessions";
import { aggregateSales, torontoToday, METHODS, type Method } from "@/lib/salesStats";
import { useLang, type Dict } from "@/app/i18n";

const ORDERS_MODULE = "online-orders";
const STATS_MODULE = "sales-stats";

// Payment-method colours + labels for the dashboard "today's money" panel
// (mirrors SalesStatsPortal so the two surfaces read the same).
const METHOD_META: Record<Method, { label: Dict; dot: string }> = {
  cash: { label: { zh: "现金", en: "Cash", fr: "Comptant" }, dot: "#D97706" },
  emt: { label: { zh: "EMT", en: "EMT", fr: "Virement" }, dot: "#0891B2" },
  card: { label: { zh: "刷卡", en: "Card", fr: "Carte" }, dot: "#7C3AED" },
  other: { label: { zh: "其他", en: "Other", fr: "Autre" }, dot: "#64748B" },
};

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
  todaysMoney: { en: "Today's money", zh: "今日收款", fr: "Encaissé aujourd'hui" },
  collectedLabel: { en: "Collected · tax + tips", zh: "实收 · 含税 + 小费", fr: "Encaissé · taxes + pourboires" },
  noSettle: { en: "No settled bills yet today.", zh: "今日还没有结账单。", fr: "Aucune facture réglée aujourd'hui." },
  tipLabel: { en: "Tips", zh: "小费", fr: "Pourboires" },
  txnsN: { en: "{n} txns", zh: "{n} 笔", fr: "{n} trans." },
};

export default function Dashboard() {
  const slug = useParams().tenant as string;
  const { lang, t } = useLang();
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [agg, setAgg] = useState<ReturnType<typeof aggregateSales> | null>(null);
  const [trackPay, setTrackPay] = useState(true);

  useEffect(() => {
    getTenant(slug).then(setTenant);
    getTrackPayments(slug).then(setTrackPay).catch(() => {});
    // Today's settled sessions → the real revenue + payment-method split. The
    // finance-module KPI misses order-driven shops (they never key in a close),
    // so orders/checkouts are the authoritative "what came in today".
    const d = torontoToday(new Date());
    listSessionsInRange(slug, d, d)
      .then((sessions) => setAgg(aggregateSales(sessions)))
      .catch(() => {});
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

  const financeRevenue = moneyKpis.reduce((acc, m) => {
    const rows = (tenant.records[m.id] ?? []).filter((r) => r.date === today);
    return acc + sum(rows, m.amountKey!);
  }, 0);
  // Order-driven shops earn through checkouts, not a keyed-in daily close — so
  // prefer today's settled sessions when there are any; fall back to the
  // finance module otherwise. Keeps the dashboard honest (no "$0" over real sales).
  const hasSessions = !!agg && agg.txns > 0;
  const todayRevenue = hasSessions ? agg!.sales : financeRevenue;

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
                {!hasSessions && moneyKpis.length === 0 && (
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

            {/* today's money — the real daily number, split by payment method.
                Replaces the old quick-access module list (which duplicated the
                sidebar). Navigation lives in the sidebar; this shows STATE. */}
            <section className="overflow-hidden rounded-xl border border-[#EBEAE5] bg-white">
              <div className="flex items-center justify-between border-b border-[#F3F2EE] px-4 py-3">
                <h2 className="text-[13px] font-bold text-ink">{t(T.todaysMoney)}</h2>
                {tenant.enabled.includes(STATS_MODULE) && (
                  <Link href={`/${slug}/m/${STATS_MODULE}`} className="text-[11.5px] font-semibold text-brand-ink hover:underline">
                    {t(T.viewAll)} →
                  </Link>
                )}
              </div>
              <div className="p-4">
                <div className="text-[26px] font-extrabold leading-none tracking-tight text-ink [font-variant-numeric:tabular-nums]">
                  {moneyExact(agg?.collected ?? 0)}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">{t(T.collectedLabel)}</div>

                {!agg || agg.collected === 0 ? (
                  <p className="mt-4 text-xs text-ink-soft">{t(T.noSettle)}</p>
                ) : (
                  <div className="mt-4">
                    {trackPay && (
                      <>
                        <div className="flex h-2 overflow-hidden rounded-full bg-[#F3F2EE]">
                          {METHODS.filter((m) => agg.byMethod[m].collected > 0).map((m) => (
                            <div key={m} style={{ width: `${(agg.byMethod[m].collected / agg.collected) * 100}%`, background: METHOD_META[m].dot }} />
                          ))}
                        </div>
                        <div className="mt-3 space-y-2">
                          {METHODS.filter((m) => agg.byMethod[m].collected > 0).map((m) => (
                            <div key={m} className="flex items-center justify-between text-[13px]">
                              <span className="flex items-center gap-2 text-ink-soft">
                                <span className="h-2 w-2 rounded-full" style={{ background: METHOD_META[m].dot }} />
                                {tl(METHOD_META[m].label)}
                                <span className="text-ink-faint">· {t(T.txnsN).replace("{n}", String(agg.byMethod[m].txns))}</span>
                              </span>
                              <span className="font-medium tabular-nums text-ink">{moneyExact(agg.byMethod[m].collected)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {agg.tips > 0 && (
                      <div className="mt-3 flex items-center justify-between border-t border-[#F3F2EE] pt-2.5 text-[13px]">
                        <span className="text-jade">{t(T.tipLabel)}</span>
                        <span className="font-medium tabular-nums text-jade">{moneyExact(agg.tips)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
