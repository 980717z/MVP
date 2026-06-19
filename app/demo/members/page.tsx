"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Donut, Badge } from "../ui";
import { useLang } from "../lang";

export default function Members() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "会员", en: "Members" })}
        subtitle={t({ zh: "积分、等级与消费", en: "Loyalty, tiers, and spend" })}
        range={t({ zh: "5月", en: "May" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "会员总数", en: "Total members" })} value="1,248" delta={t({ zh: "本月 +86", en: "+86 this month" })} />
        <Kpi label={t({ zh: "活跃 (90天)", en: "Active (90d)" })} value="712" delta={t({ zh: "占 57%", en: "57% of base" })} tone="slate" />
        <Kpi label={t({ zh: "客均消费", en: "Avg spend / visit" })} value="$34" delta="+$2.10" />
        <Kpi label={t({ zh: "已兑积分", en: "Points redeemed" })} value="12,400" delta={t({ zh: "本月", en: "This month" })} tone="slate" />
      </KpiRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t({ zh: "等级分布", en: "Tier breakdown" })} className="lg:col-span-1">
          <Donut
            segments={[
              { label: t({ zh: "铜牌", en: "Bronze" }), value: 58, color: "#a8a29e" },
              { label: t({ zh: "银牌", en: "Silver" }), value: 26, color: "#94a3b8" },
              { label: t({ zh: "金牌", en: "Gold" }), value: 12, color: "#f59e0b" },
              { label: t({ zh: "贵宾", en: "VIP" }), value: 4, color: "#10b981" },
            ]}
          />
        </Card>

        <Card title={t({ zh: "高价值会员", en: "Top members" })} className="lg:col-span-2">
          <Table
            head={[
              t({ zh: "姓名", en: "Name" }),
              t({ zh: "等级", en: "Tier" }),
              t({ zh: "到店", en: "Visits" }),
              t({ zh: "消费", en: "Spend" }),
              t({ zh: "最近到店", en: "Last visit" }),
            ]}
            alignRight={[2, 3]}
            rows={[
              ["Jenny Wong", <Badge key="1" tone="green">{t({ zh: "贵宾", en: "VIP" })}</Badge>, "48", "$2,140", "Jun 1"],
              ["Michael Tan", <Badge key="2" tone="amber">{t({ zh: "金牌", en: "Gold" })}</Badge>, "31", "$1,420", "May 31"],
              ["Grace Liu", <Badge key="3" tone="amber">{t({ zh: "金牌", en: "Gold" })}</Badge>, "27", "$1,180", "May 30"],
              ["Daniel Kim", <Badge key="4" tone="slate">{t({ zh: "银牌", en: "Silver" })}</Badge>, "19", "$760", "May 29"],
              ["Sophia Chan", <Badge key="5" tone="slate">{t({ zh: "银牌", en: "Silver" })}</Badge>, "16", "$640", "May 28"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
