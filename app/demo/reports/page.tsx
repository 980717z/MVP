"use client";

import { PageHeader, KpiRow, Kpi, Card, Bars, Donut, Table } from "../ui";
import { useLang } from "../lang";

export default function Reports() {
  const { t } = useLang();
  const exp = <span className="text-xs font-medium text-emerald-600">{t({ zh: "导出", en: "Export", fr: "Exporter" })}</span>;
  return (
    <>
      <PageHeader
        title={t({ zh: "报表", en: "Reports", fr: "Rapports" })}
        subtitle={t({ zh: "趋势、构成与导出", en: "Trends, breakdowns, and exports", fr: "Tendances, répartitions et exports" })}
        range={t({ zh: "近 6 个月", en: "Last 6 months", fr: "6 derniers mois" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "营业额 (6个月)", en: "Revenue (6 mo)", fr: "Revenus (6 mois)" })} value="$162k" delta={t({ zh: "同比 +14%", en: "+14% YoY", fr: "+14% sur un an" })} />
        <Kpi label={t({ zh: "订单 (6个月)", en: "Orders (6 mo)", fr: "Commandes (6 mois)" })} value="7,310" delta={t({ zh: "同比 +9%", en: "+9% YoY", fr: "+9% sur un an" })} />
        <Kpi label={t({ zh: "客单价", en: "Avg ticket", fr: "Panier moyen" })} value="$28.40" delta="+$1.60" />
        <Kpi label={t({ zh: "毛利率", en: "Gross margin", fr: "Marge brute" })} value="31%" delta={t({ zh: "+0.8 个百分点", en: "+0.8 pts", fr: "+0,8 pt" })} />
      </KpiRow>

      <Card title={t({ zh: "各月营业额", en: "Revenue by month", fr: "Revenus par mois" })}>
        <Bars
          data={[
            { label: t({ zh: "12月", en: "Dec", fr: "déc." }), value: 22 },
            { label: t({ zh: "1月", en: "Jan", fr: "janv." }), value: 24 },
            { label: t({ zh: "2月", en: "Feb", fr: "févr." }), value: 26 },
            { label: t({ zh: "3月", en: "Mar", fr: "mars" }), value: 27 },
            { label: t({ zh: "4月", en: "Apr", fr: "avr." }), value: 29 },
            { label: t({ zh: "5月", en: "May", fr: "mai" }), value: 31 },
          ]}
          height={150}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t({ zh: "分类销售构成", en: "Sales by category", fr: "Ventes par catégorie" })}>
          <Donut
            segments={[
              { label: t({ zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }), value: 34, color: "#0ea5e9" },
              { label: t({ zh: "饭与面", en: "Rice & noodles", fr: "Riz et nouilles" }), value: 28, color: "#10b981" },
              { label: t({ zh: "肉类菜", en: "Meat dishes", fr: "Plats de viande" }), value: 22, color: "#f59e0b" },
              { label: t({ zh: "饮料", en: "Beverages", fr: "Boissons" }), value: 16, color: "#a78bfa" },
            ]}
          />
        </Card>

        <Card title={t({ zh: "已存报表", en: "Saved reports", fr: "Rapports enregistrés" })}>
          <Table
            head={[t({ zh: "报表", en: "Report", fr: "Rapport" }), t({ zh: "周期", en: "Period", fr: "Période" }), ""]}
            alignRight={[2]}
            rows={[
              [t({ zh: "每日销售汇总", en: "Daily sales summary", fr: "Résumé des ventes quotidiennes" }), "May 2026", exp],
              [t({ zh: "月度损益表", en: "Monthly P&L", fr: "Résultat mensuel" }), "May 2026", exp],
              [t({ zh: "库存用量", en: "Inventory usage", fr: "Utilisation du stock" }), "May 2026", exp],
              [t({ zh: "人力成本报表", en: "Labor cost report", fr: "Rapport de main-d'œuvre" }), "May 2026", exp],
              [t({ zh: "税务汇总 (HST)", en: "Tax summary (HST)", fr: "Résumé fiscal (TVH)" }), "Q2 2026", exp],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
