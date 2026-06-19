import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";

export default function Reconcile() {
  return (
    <>
      <PageHeader title="Reconcile" subtitle="Daily cash, card settlements, and variance" range="May 26 – Jun 1" />

      <KpiRow>
        <Kpi label="Expected (today)" value="$2,540" delta="From orders" tone="slate" />
        <Kpi label="Counted" value="$2,512" delta="Drawer + deposits" tone="slate" />
        <Kpi label="Variance" value="-$28" delta="Within tolerance" tone="red" />
        <Kpi label="Card settled" value="$1,980" delta="Cleared" />
      </KpiRow>

      <Card title="Daily reconciliation">
        <Table
          head={["Date", "Sales", "Cash", "Card", "Expected", "Counted", "Variance"]}
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

      <Card title="Notes">
        <p className="text-sm text-slate-600">
          May 29 variance of -$45 flagged for review — drawer recount recommended. All other days within the ±$30 tolerance.
        </p>
      </Card>
    </>
  );
}
