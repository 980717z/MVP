import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";

export default function Inventory() {
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock on hand, par levels, and what to reorder" range="Live" />

      <KpiRow>
        <Kpi label="SKUs tracked" value="142" delta="6 categories" tone="slate" />
        <Kpi label="Low stock" value="7" delta="Reorder soon" tone="slate" />
        <Kpi label="Out of stock" value="2" delta="Reorder now" tone="red" />
        <Kpi label="Inventory value" value="$11,240" delta="-3.1% vs last wk" tone="slate" />
      </KpiRow>

      <Card title="Stock levels">
        <Table
          head={["Item", "Category", "On hand", "Par", "Status", "Supplier"]}
          alignRight={[2, 3]}
          rows={[
            ["Jasmine rice", "Dry goods", "8 bags", "6", <Badge key="1" tone="green">In stock</Badge>, "Spadina Dry Goods"],
            ["Pork ribs", "Meat", "12 kg", "20", <Badge key="2" tone="amber">Low</Badge>, "Golden Meats"],
            ["Live sea bass", "Seafood", "0", "8", <Badge key="3" tone="red">Out</Badge>, "金记海鲜"],
            ["Bok choy", "Produce", "9 cases", "8", <Badge key="4" tone="green">In stock</Badge>, "Lucky Produce"],
            ["Cooking oil (20L)", "Dry goods", "3", "5", <Badge key="5" tone="amber">Low</Badge>, "T&T Wholesale"],
            ["Shrimp (frozen)", "Seafood", "0", "6", <Badge key="6" tone="red">Out</Badge>, "金记海鲜"],
            ["Milk tea powder", "Beverage", "14 tubs", "8", <Badge key="7" tone="green">In stock</Badge>, "Pearl Beverage"],
            ["Soy sauce (case)", "Dry goods", "5", "6", <Badge key="8" tone="amber">Low</Badge>, "T&T Wholesale"],
          ]}
        />
      </Card>

      <Card title="Top ingredient usage (this week, kg)">
        <Bars
          data={[
            { label: "Rice", value: 64 },
            { label: "Pork", value: 48 },
            { label: "Chicken", value: 41 },
            { label: "Shrimp", value: 33 },
            { label: "Bok choy", value: 28 },
            { label: "Beef", value: 22 },
            { label: "Tofu", value: 18 },
          ]}
        />
      </Card>
    </>
  );
}
