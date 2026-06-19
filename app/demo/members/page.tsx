import { PageHeader, KpiRow, Kpi, Card, Table, Donut, Badge } from "../ui";

export default function Members() {
  return (
    <>
      <PageHeader title="Members" subtitle="Loyalty, tiers, and spend" range="May" />

      <KpiRow>
        <Kpi label="Total members" value="1,248" delta="+86 this month" />
        <Kpi label="Active (90d)" value="712" delta="57% of base" tone="slate" />
        <Kpi label="Avg spend / visit" value="$34" delta="+$2.10" />
        <Kpi label="Points redeemed" value="12,400" delta="This month" tone="slate" />
      </KpiRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Tier breakdown" className="lg:col-span-1">
          <Donut
            segments={[
              { label: "Bronze", value: 58, color: "#a8a29e" },
              { label: "Silver", value: 26, color: "#94a3b8" },
              { label: "Gold", value: 12, color: "#f59e0b" },
              { label: "VIP", value: 4, color: "#10b981" },
            ]}
          />
        </Card>

        <Card title="Top members" className="lg:col-span-2">
          <Table
            head={["Name", "Tier", "Visits", "Spend", "Last visit"]}
            alignRight={[2, 3]}
            rows={[
              ["Jenny Wong", <Badge key="1" tone="green">VIP</Badge>, "48", "$2,140", "Jun 1"],
              ["Michael Tan", <Badge key="2" tone="amber">Gold</Badge>, "31", "$1,420", "May 31"],
              ["Grace Liu", <Badge key="3" tone="amber">Gold</Badge>, "27", "$1,180", "May 30"],
              ["Daniel Kim", <Badge key="4" tone="slate">Silver</Badge>, "19", "$760", "May 29"],
              ["Sophia Chan", <Badge key="5" tone="slate">Silver</Badge>, "16", "$640", "May 28"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
