"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";
import { useLang } from "../lang";

export default function Reconcile() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "对账", en: "Reconcile" })}
        subtitle={t({ zh: "每日现金、刷卡结算与差异", en: "Daily cash, card settlements, and variance" })}
        range={t({ zh: "5月26日 – 6月1日", en: "May 26 – Jun 1" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "应收 (今日)", en: "Expected (today)" })} value="$2,540" delta={t({ zh: "来自订单", en: "From orders" })} tone="slate" />
        <Kpi label={t({ zh: "实点", en: "Counted" })} value="$2,512" delta={t({ zh: "钱箱 + 存款", en: "Drawer + deposits" })} tone="slate" />
        <Kpi label={t({ zh: "差异", en: "Variance" })} value="-$28" delta={t({ zh: "在容差范围内", en: "Within tolerance" })} tone="red" />
        <Kpi label={t({ zh: "刷卡结算", en: "Card settled" })} value="$1,980" delta={t({ zh: "已到账", en: "Cleared" })} />
      </KpiRow>

      <Card title={t({ zh: "每日对账", en: "Daily reconciliation" })}>
        <Table
          head={[
            t({ zh: "日期", en: "Date" }),
            t({ zh: "营业额", en: "Sales" }),
            t({ zh: "现金", en: "Cash" }),
            t({ zh: "刷卡", en: "Card" }),
            t({ zh: "应收", en: "Expected" }),
            t({ zh: "实点", en: "Counted" }),
            t({ zh: "差异", en: "Variance" }),
          ]}
          alignRight={[1, 2, 3, 4, 5, 6]}
          rows={[
            ["Jun 1", "$2,540", "$560", "$1,980", "$2,540", "$2,512", <Badge key="1" tone="amber">-$28</Badge>],
            ["May 31", "$3,120", "$720", "$2,400", "$3,120", "$3,120", <Badge key="2" tone="green">$0</Badge>],
            ["May 30", "$2,880", "$640", "$2,240", "$2,880", "$2,892", <Badge key="3" tone="green">+$12</Badge>],
            ["May 29", "$2,410", "$510", "$1,900", "$2,410", "$2,365", <Badge key="4" tone="red">-$45</Badge>],
            ["May 28", "$2,760", "$600", "$2,160", "$2,760", "$2,760", <Badge key="5" tone="green">$0</Badge>],
            ["May 27", "$2,180", "$480", "$1,700", "$2,180", "$2,188", <Badge key="6" tone="green">+$8</Badge>],
          ]}
        />
      </Card>

      <Card title={t({ zh: "备注", en: "Notes" })}>
        <p className="text-sm text-slate-600">
          {t({
            zh: "5月29日差异 -$45，已标记复核 —— 建议重点钱箱。其余各日均在 ±$30 容差范围内。",
            en: "May 29 variance of -$45 flagged for review — drawer recount recommended. All other days within the ±$30 tolerance.",
          })}
        </p>
      </Card>
    </>
  );
}
