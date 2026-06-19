import { PageHeader, KpiRow, Kpi, Card, Table, Donut, Badge } from "../ui";

export default function Orders() {
  return (
    <>
      <PageHeader title="Orders" subtitle="Live order feed across every channel" range="Today" />

      <KpiRow>
        <Kpi label="Orders today" value="86" delta="+9 vs yesterday" />
        <Kpi label="Revenue today" value="$2,540" delta="+6.1%" />
        <Kpi label="Avg ticket" value="$29.50" delta="+$1.20" />
        <Kpi label="Pending" value="4" delta="Needs attention" tone="slate" />
      </KpiRow>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Channel mix" className="lg:col-span-1">
          <Donut
            segments={[
              { label: "Dine-in", value: 52, color: "#10b981" },
              { label: "Takeout", value: 28, color: "#0ea5e9" },
              { label: "QR / online", value: 14, color: "#f59e0b" },
              { label: "Delivery", value: 6, color: "#a78bfa" },
            ]}
          />
        </Card>

        <Card title="Recent orders" className="lg:col-span-2">
          <Table
            head={["Order", "Channel", "Items", "Total", "Status", "Time"]}
            alignRight={[3]}
            rows={[
              ["#1042", "Dine-in · Table 6", "4", "$186", <Badge key="1" tone="green">Paid</Badge>, "12:04"],
              ["#1041", "Takeout", "3", "$92", <Badge key="2" tone="green">Paid</Badge>, "11:58"],
              ["#1040", "Dine-in · Table 2", "6", "$240", <Badge key="3" tone="green">Paid</Badge>, "11:43"],
              ["#1039", "QR / online", "2", "$54", <Badge key="4" tone="amber">Pending</Badge>, "11:36"],
              ["#1038", "Delivery", "5", "$128", <Badge key="5" tone="green">Paid</Badge>, "11:20"],
              ["#1037", "Takeout", "1", "$18", <Badge key="6" tone="red">Refunded</Badge>, "11:02"],
              ["#1036", "Dine-in · Table 9", "8", "$312", <Badge key="7" tone="green">Paid</Badge>, "10:48"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
