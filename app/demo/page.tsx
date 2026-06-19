"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, AreaTrend, Badge } from "./ui";
import { useLang } from "./lang";

const TREND = [12, 14, 13, 17, 15, 19, 18, 22, 20, 24, 21, 26, 25, 28];

export default function Overview() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "概览", en: "Overview" })}
        subtitle="Sang's Great Seafood · 富来小厨"
        range={t({ zh: "5月1日 – 5月31日", en: "May 1 – May 31" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "营业额", en: "Revenue" })} value="$28,540" delta="+12.4%" />
        <Kpi label={t({ zh: "订单", en: "Orders" })} value="1,248" delta="+8.1%" />
        <Kpi label={t({ zh: "毛利", en: "Gross profit" })} value="$8,730" delta="+5.2%" />
        <Kpi label={t({ zh: "新增会员", en: "New members" })} value="86" delta="+23" />
      </KpiRow>

      <Card title={t({ zh: "销售趋势", en: "Sales trend" })}>
        <AreaTrend points={TREND} height={150} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t({ zh: "热销菜品", en: "Top items" })}>
          <Table
            head={["#", t({ zh: "菜品", en: "Item" }), t({ zh: "销量", en: "Sold" }), t({ zh: "营业额", en: "Revenue" })]}
            alignRight={[2, 3]}
            rows={[
              ["1", t({ zh: "招牌炒饭", en: "Signature fried rice" }), "312", "$4,680"],
              ["2", t({ zh: "椒盐排骨", en: "Salt & pepper ribs" }), "268", "$5,360"],
              ["3", t({ zh: "港式奶茶", en: "HK milk tea" }), "245", "$1,225"],
              ["4", t({ zh: "清蒸鲈鱼", en: "Steamed sea bass" }), "176", "$5,280"],
              ["5", t({ zh: "云吞面", en: "Wonton noodle soup" }), "154", "$1,848"],
            ]}
          />
        </Card>

        <Card
          title={t({ zh: "最近订单", en: "Recent orders" })}
          action={<span className="text-xs font-medium text-emerald-600">{t({ zh: "查看全部", en: "View all" })}</span>}
        >
          <Table
            head={[t({ zh: "订单", en: "Order" }), t({ zh: "渠道", en: "Channel" }), t({ zh: "金额", en: "Total" }), t({ zh: "状态", en: "Status" })]}
            alignRight={[2]}
            rows={[
              ["#1042", t({ zh: "堂食 · 6号桌", en: "Dine-in · Table 6" }), "$186", <Badge key="a" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>],
              ["#1041", t({ zh: "外卖", en: "Takeout" }), "$92", <Badge key="b" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>],
              ["#1040", t({ zh: "堂食 · 2号桌", en: "Dine-in · Table 2" }), "$240", <Badge key="c" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>],
              ["#1039", t({ zh: "扫码 / 在线", en: "QR / online" }), "$54", <Badge key="d" tone="amber">{t({ zh: "待处理", en: "Pending" })}</Badge>],
              ["#1038", t({ zh: "外送", en: "Delivery" }), "$128", <Badge key="e" tone="green">{t({ zh: "已付", en: "Paid" })}</Badge>],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
