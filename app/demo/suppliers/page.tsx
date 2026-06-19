import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";

export default function Suppliers() {
  return (
    <>
      <PageHeader title="Suppliers" subtitle="Vendors, purchase orders, and delivery performance" range="May" />

      <KpiRow>
        <Kpi label="Active suppliers" value="12" delta="2 added this month" tone="slate" />
        <Kpi label="Open POs" value="5" delta="$3,180 committed" tone="slate" />
        <Kpi label="Spend (MTD)" value="$9,420" delta="+4.7%" />
        <Kpi label="Avg lead time" value="2.1 days" delta="-0.3 days" />
      </KpiRow>

      <Card title="Suppliers">
        <Table
          head={["Supplier", "Category", "Last order", "Outstanding", "On-time", "Status"]}
          alignRight={[3, 4]}
          rows={[
            ["金记海鲜", "Seafood", "May 28", "$1,240", "96%", <Badge key="1" tone="green">Preferred</Badge>],
            ["Lucky Produce", "Produce", "May 29", "$420", "92%", <Badge key="2" tone="green">Preferred</Badge>],
            ["Golden Meats", "Meat", "May 27", "$880", "88%", <Badge key="3" tone="slate">Active</Badge>],
            ["T&T Wholesale", "Dry goods", "May 26", "$640", "99%", <Badge key="4" tone="green">Preferred</Badge>],
            ["Pearl Beverage", "Beverage", "May 24", "$0", "90%", <Badge key="5" tone="slate">Active</Badge>],
            ["Hong Kong Noodle Co.", "Dry goods", "May 21", "$0", "84%", <Badge key="6" tone="amber">Review</Badge>],
          ]}
        />
      </Card>

      <Card title="Upcoming deliveries">
        <Table
          head={["PO", "Supplier", "Items", "ETA", "Status"]}
          rows={[
            ["PO-2041", "金记海鲜", "Sea bass, shrimp, scallops", "Tomorrow, 7:00am", <Badge key="1" tone="blue">Confirmed</Badge>],
            ["PO-2040", "Lucky Produce", "Bok choy, scallions, ginger", "Tomorrow, 6:30am", <Badge key="2" tone="blue">Confirmed</Badge>],
            ["PO-2039", "Golden Meats", "Pork ribs, chicken thigh", "Jun 2, 8:00am", <Badge key="3" tone="amber">Pending</Badge>],
            ["PO-2038", "T&T Wholesale", "Cooking oil, soy sauce", "Jun 3, 10:00am", <Badge key="4" tone="amber">Pending</Badge>],
          ]}
        />
      </Card>
    </>
  );
}
