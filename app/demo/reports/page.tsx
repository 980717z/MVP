import { PageHeader, KpiRow, Kpi, Card, Bars, Donut, Table } from "../ui";

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Trends, breakdowns, and exports" range="Last 6 months" />

      <KpiRow>
        <Kpi label="Revenue (6 mo)" value="$162k" delta="+14% YoY" />
        <Kpi label="Orders (6 mo)" value="7,310" delta="+9% YoY" />
        <Kpi label="Avg ticket" value="$28.40" delta="+$1.60" />
        <Kpi label="Gross margin" value="31%" delta="+0.8 pts" />
      </KpiRow>

      <Card title="Revenue by month">
        <Bars
          data={[
            { label: "Dec", value: 22 },
            { label: "Jan", value: 24 },
            { label: "Feb", value: 26 },
            { label: "Mar", value: 27 },
            { label: "Apr", value: 29 },
            { label: "May", value: 31 },
          ]}
          height={150}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sales by category">
          <Donut
            segments={[
              { label: "Seafood", value: 34, color: "#0ea5e9" },
              { label: "Rice & noodles", value: 28, color: "#10b981" },
              { label: "Meat dishes", value: 22, color: "#f59e0b" },
              { label: "Beverages", value: 16, color: "#a78bfa" },
            ]}
          />
        </Card>

        <Card title="Saved reports">
          <Table
            head={["Report", "Period", ""]}
            alignRight={[2]}
            rows={[
              ["Daily sales summary", "May 2026", <span key="1" className="text-xs font-medium text-emerald-600">Export</span>],
              ["Monthly P&L", "May 2026", <span key="2" className="text-xs font-medium text-emerald-600">Export</span>],
              ["Inventory usage", "May 2026", <span key="3" className="text-xs font-medium text-emerald-600">Export</span>],
              ["Labor cost report", "May 2026", <span key="4" className="text-xs font-medium text-emerald-600">Export</span>],
              ["Tax summary (HST)", "Q2 2026", <span key="5" className="text-xs font-medium text-emerald-600">Export</span>],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
