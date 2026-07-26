"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Donut, Badge } from "../ui";
import { useLang } from "../lang";

export default function Orders() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "订单", en: "Orders", fr: "Commandes" })}
        subtitle={t({ zh: "全渠道实时订单", en: "Live order feed across every channel", fr: "Flux de commandes en direct sur tous les canaux" })}
        range={t({ zh: "今日", en: "Today", fr: "Aujourd'hui" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "今日订单", en: "Orders today", fr: "Commandes aujourd'hui" })} value="86" delta={t({ zh: "较昨日 +9", en: "+9 vs yesterday", fr: "+9 vs hier" })} />
        <Kpi label={t({ zh: "今日营业额", en: "Revenue today", fr: "Revenus aujourd'hui" })} value="$2,540" delta="+6.1%" />
        <Kpi label={t({ zh: "客单价", en: "Avg ticket", fr: "Panier moyen" })} value="$29.50" delta="+$1.20" />
        <Kpi label={t({ zh: "待处理", en: "Pending", fr: "En attente" })} value="4" delta={t({ zh: "需处理", en: "Needs attention", fr: "À traiter" })} tone="slate" />
      </KpiRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t({ zh: "渠道占比", en: "Channel mix", fr: "Répartition des canaux" })} className="lg:col-span-1">
          <Donut
            segments={[
              { label: t({ zh: "堂食", en: "Dine-in", fr: "Sur place" }), value: 52, color: "#10b981" },
              { label: t({ zh: "外卖", en: "Takeout", fr: "À emporter" }), value: 28, color: "#0ea5e9" },
              { label: t({ zh: "扫码/在线", en: "QR / online", fr: "QR / en ligne" }), value: 14, color: "#f59e0b" },
              { label: t({ zh: "外送", en: "Delivery", fr: "Livraison" }), value: 6, color: "#a78bfa" },
            ]}
          />
        </Card>

        <Card title={t({ zh: "最近订单", en: "Recent orders", fr: "Commandes récentes" })} className="lg:col-span-2">
          <Table
            head={[
              t({ zh: "订单", en: "Order", fr: "Commande" }),
              t({ zh: "渠道", en: "Channel", fr: "Canal" }),
              t({ zh: "件数", en: "Items", fr: "Articles" }),
              t({ zh: "金额", en: "Total", fr: "Total" }),
              t({ zh: "状态", en: "Status", fr: "Statut" }),
              t({ zh: "时间", en: "Time", fr: "Heure" }),
            ]}
            alignRight={[3]}
            rows={[
              ["#1042", t({ zh: "堂食 · 6号桌", en: "Dine-in · Table 6", fr: "Sur place · Table 6" }), "4", "$186", <Badge key="1" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Badge>, "12:04"],
              ["#1041", t({ zh: "外卖", en: "Takeout", fr: "À emporter" }), "3", "$92", <Badge key="2" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Badge>, "11:58"],
              ["#1040", t({ zh: "堂食 · 2号桌", en: "Dine-in · Table 2", fr: "Sur place · Table 2" }), "6", "$240", <Badge key="3" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Badge>, "11:43"],
              ["#1039", t({ zh: "扫码 / 在线", en: "QR / online", fr: "QR / en ligne" }), "2", "$54", <Badge key="4" tone="amber">{t({ zh: "待处理", en: "Pending", fr: "En attente" })}</Badge>, "11:36"],
              ["#1038", t({ zh: "外送", en: "Delivery", fr: "Livraison" }), "5", "$128", <Badge key="5" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Badge>, "11:20"],
              ["#1037", t({ zh: "外卖", en: "Takeout", fr: "À emporter" }), "1", "$18", <Badge key="6" tone="red">{t({ zh: "已退款", en: "Refunded", fr: "Remboursé" })}</Badge>, "11:02"],
              ["#1036", t({ zh: "堂食 · 9号桌", en: "Dine-in · Table 9", fr: "Sur place · Table 9" }), "8", "$312", <Badge key="7" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Badge>, "10:48"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
