"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";
import { useLang } from "../lang";

export default function Shifts() {
  const { t } = useLang();
  const IN = <Badge tone="green">{t({ zh: "上班中", en: "Clocked in" })}</Badge>;
  const SCH = <Badge tone="slate">{t({ zh: "已排班", en: "Scheduled" })}</Badge>;
  return (
    <>
      <PageHeader
        title={t({ zh: "排班与薪酬", en: "Shift & Pay" })}
        subtitle={t({ zh: "排班、考勤与薪酬", en: "Scheduling, time tracking, and payroll" })}
        range={t({ zh: "5月26日当周", en: "Week of May 26" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "员工", en: "Staff" })} value="14" delta={t({ zh: "今日 9 人", en: "9 on today" })} tone="slate" />
        <Kpi label={t({ zh: "本周工时", en: "Hours this week" })} value="612" delta={t({ zh: "较上周 +18", en: "+18 vs last wk" })} tone="slate" />
        <Kpi label={t({ zh: "人力成本", en: "Labor cost" })} value="$9,180" delta="+2.4%" />
        <Kpi label={t({ zh: "人力占营收", en: "Labor % of sales" })} value="26%" delta={t({ zh: "-1.2 个百分点", en: "-1.2 pts" })} />
      </KpiRow>

      <Card title={t({ zh: "今日排班", en: "Today's schedule" })}>
        <Table
          head={[
            t({ zh: "姓名", en: "Name" }),
            t({ zh: "岗位", en: "Role" }),
            t({ zh: "班次", en: "Shift" }),
            t({ zh: "工时", en: "Hours" }),
            t({ zh: "状态", en: "Status" }),
          ]}
          alignRight={[3]}
          rows={[
            ["Wei Chen", t({ zh: "服务员", en: "Server" }), "10:00 – 18:00", "8.0", IN],
            ["Amy Lo", t({ zh: "收银", en: "Cashier" }), "11:00 – 19:00", "8.0", IN],
            ["David Ng", t({ zh: "主厨", en: "Chef" }), "09:00 – 17:00", "8.0", IN],
            ["Mei Zhou", t({ zh: "服务员", en: "Server" }), "16:00 – 23:00", "7.0", SCH],
            ["Sam Tran", t({ zh: "后厨", en: "Kitchen" }), "10:00 – 18:00", "8.0", IN],
            ["Kevin Pham", t({ zh: "洗碗", en: "Dishwasher" }), "17:00 – 23:00", "6.0", SCH],
          ]}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t({ zh: "每日工时", en: "Hours by day" })}>
          <Bars
            data={[
              { label: t({ zh: "一", en: "Mon" }), value: 78 },
              { label: t({ zh: "二", en: "Tue" }), value: 82 },
              { label: t({ zh: "三", en: "Wed" }), value: 88 },
              { label: t({ zh: "四", en: "Thu" }), value: 91 },
              { label: t({ zh: "五", en: "Fri" }), value: 104 },
              { label: t({ zh: "六", en: "Sat" }), value: 96 },
              { label: t({ zh: "日", en: "Sun" }), value: 73 },
            ]}
          />
        </Card>

        <Card title={t({ zh: "本期薪酬", en: "Payroll · this period" })}>
          <Table
            head={[
              t({ zh: "姓名", en: "Name" }),
              t({ zh: "工时", en: "Hours" }),
              t({ zh: "时薪", en: "Rate" }),
              t({ zh: "应发", en: "Gross" }),
            ]}
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
