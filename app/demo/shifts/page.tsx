import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";

export default function Shifts() {
  return (
    <>
      <PageHeader title="Shift & Pay" subtitle="Scheduling, time tracking, and payroll" range="Week of May 26" />

      <KpiRow>
        <Kpi label="Staff" value="14" delta="9 on today" tone="slate" />
        <Kpi label="Hours this week" value="612" delta="+18 vs last wk" tone="slate" />
        <Kpi label="Labor cost" value="$9,180" delta="+2.4%" />
        <Kpi label="Labor % of sales" value="26%" delta="-1.2 pts" />
      </KpiRow>

      <Card title="Today's schedule">
        <Table
          head={["Name", "Role", "Shift", "Hours", "Status"]}
          alignRight={[3]}
          rows={[
            ["Wei Chen", "Server", "10:00 – 18:00", "8.0", <Badge key="1" tone="green">Clocked in</Badge>],
            ["Amy Lo", "Cashier", "11:00 – 19:00", "8.0", <Badge key="2" tone="green">Clocked in</Badge>],
            ["David Ng", "Chef", "09:00 – 17:00", "8.0", <Badge key="3" tone="green">Clocked in</Badge>],
            ["Mei Zhou", "Server", "16:00 – 23:00", "7.0", <Badge key="4" tone="slate">Scheduled</Badge>],
            ["Sam Tran", "Kitchen", "10:00 – 18:00", "8.0", <Badge key="5" tone="green">Clocked in</Badge>],
            ["Kevin Pham", "Dishwasher", "17:00 – 23:00", "6.0", <Badge key="6" tone="slate">Scheduled</Badge>],
          ]}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Hours by day">
          <Bars
            data={[
              { label: "Mon", value: 78 },
              { label: "Tue", value: 82 },
              { label: "Wed", value: 88 },
              { label: "Thu", value: 91 },
              { label: "Fri", value: 104 },
              { label: "Sat", value: 96 },
              { label: "Sun", value: 73 },
            ]}
          />
        </Card>

        <Card title="Payroll · this period">
          <Table
            head={["Name", "Hours", "Rate", "Gross"]}
            alignRight={[1, 2, 3]}
            rows={[
              ["Wei Chen", "76", "$18.50", "$1,406"],
              ["Amy Lo", "72", "$17.00", "$1,224"],
              ["David Ng", "80", "$26.00", "$2,080"],
              ["Mei Zhou", "64", "$18.50", "$1,184"],
              ["Sam Tran", "78", "$17.50", "$1,365"],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
