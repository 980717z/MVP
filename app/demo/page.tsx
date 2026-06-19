import { PageHeader, KpiRow, Kpi, Card, Table, AreaTrend, Badge } from "./ui";

const TREND = [12, 14, 13, 17, 15, 19, 18, 22, 20, 24, 21, 26, 25, 28];

export default function Overview() {
  return (
    <>
      <PageHeader title="Overview" subtitle="Sang's Great Seafood · 富来小厨" range="May 1 – May 31" />

      <KpiRow>
        <Kpi label="Revenue" value="$28,540" delta="+12.4%" />
        <Kpi label="Orders" value="1,248" delta="+8.1%" />
        <Kpi label="Gross profit" value="$8,730" delta="+5.2%" />
        <Kpi label="New members" value="86" delta="+23" />
      </KpiRow>

      <Card title="Sales trend">
        <AreaTrend points={TREND} height={150} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Top items">
          <Table
            head={["#", "Item", "Sold", "Revenue"]}
            alignRight={[2, 3]}
            rows={[
              ["1", "Signature fried rice", "312", "$4,680"],
              ["2", "Salt & pepper ribs", "268", "$5,360"],
              ["3", "HK milk tea", "245", "$1,225"],
              ["4", "Steamed sea bass", "176", "$5,280"],
              ["5", "Wonton noodle soup", "154", "$1,848"],
            ]}
          />
        </Card>

        <Card title="Recent orders" action={<span className="text-xs font-medium text-emerald-600">View all</span>}>
          <Table
            head={["Order", "Channel", "Total", "Status"]}
            alignRight={[2]}
            rows={[
              ["#1042", "Dine-in · Table 6", "$186", <Badge key="a" tone="green">Paid</Badge>],
              ["#1041", "Takeout", "$92", <Badge key="b" tone="green">Paid</Badge>],
              ["#1040", "Dine-in · Table 2", "$240", <Badge key="c" tone="green">Paid</Badge>],
              ["#1039", "QR / online", "$54", <Badge key="d" tone="amber">Pending</Badge>],
              ["#1038", "Delivery", "$128", <Badge key="e" tone="green">Paid</Badge>],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
