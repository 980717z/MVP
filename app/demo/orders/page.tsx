"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Donut, Badge } from "../ui";
import { useLang } from "../lang";

export default function Orders() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "订单", en: "Orders" })}
        subtitle={t({ zh: "全渠道实时订单", en: "Live order feed across every channel" })}
        range={t({ zh: "今日", en: "Today" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "今日订单", en: "Orders today" })} value="86" delta={t({ zh: "较昨日 +9", en: "+9 vs yesterday" })} />
        <Kpi label={t({ zh: "今日营业额", en: "Revenue today" })} value="$2,540" delta="+6.1%" />
        <Kpi label={t({ zh: "客单价", en: "Avg ticket" })} value="$29.50" delta="+$1.20" />
        <Kpi label={t({ zh: "待处理", en: "Pending" })} value="4" delta={t({ zh: "需处理", en: "Needs attention" })} tone="slate" />
      </KpiRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t({ zh: "渠道占比", en: "Channel mix" })} className="lg:col-span-1">
          <Donut
            segments={[
              { label: t({ zh: "堂食", en: "Dine-in" }), value: 52, color: "#10b981" },
              { label: t({ zh: "外卖", en: "Takeout" }), value: 28, color: "#0ea5e9" },
              { label: t({ zh: "扫码/在线", en: "QR / online" }), value: 14, color: "#f59e0b" },
              { label: t({ zh: "外送", en: "Delivery" }), value: 6, color: "#a78bfa" },
            ]}
          />
        </Card>

        <Card title={t({ zh: "最近订单", en: "Recent orders" })} className="lg:col-span-2">
          <Table
            head={[
              t({ zh: "订单", en: "Order" }),
              t({ zh: "渠道", en: "Channel" }),
              t({ zh: "件数", en: "Items" }),
              t({ zh: "金额", en: "Total" }),
              t({ zh: "状态", en: "Status" }),
              t({ zh: "时间", en: "Time" }),
            ]}
            alignRight={[3]}
            rows={[
              ["#1042", t({ zh: "堂食 · 6号桌", en: "Dine-in · Table 6" }), "4", "$186", <Badge key="1" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>, "12:04"],
              ["#1041", t({ zh: "外卖", en: "Takeout" }), "3", "$92", <Badge key="2" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>, "11:58"],
              ["#1040", t({ zh: "堂食 · 2号桌", en: "Dine-in · Table 2" }), "6", "$240", <Badge key="3" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>, "11:43"],
              ["#1039", t({ zh: "扫码 / 在线", en: "QR / online" }), "2", "$54", <Badge key="4" tone="amber">{t({ zh: "待处理", en: "Pending" })}</Badge>, "11:36"],
              ["#1038", t({ zh: "外送", en: "Delivery" }), "5", "$128", <Badge key="5" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>, "11:20"],
              ["#1037", t({ zh: "外卖", en: "Takeout" }), "1", "$18", <Badge key="6" tone="red">{t({ zh: "已退款", en: "Refunded" })}</Badge>, "11:02"],
              ["#1036", t({ zh: "堂食 · 9号桌", en: "Dine-in · Table 9" }), "8", "$312", <Badge key="7" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>, "10:48"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
