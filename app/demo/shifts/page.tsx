"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";
import { useLang } from "../lang";

export default function Shifts() {
  const { t } = useLang();
  const IN = <Badge tone="green">{t({ zh: "上班中", en: "Clocked in", fr: "Pointé" })}</Badge>;
  const SCH = <Badge tone="slate">{t({ zh: "已排班", en: "Scheduled", fr: "Planifié" })}</Badge>;
  return (
    <>
      <PageHeader
        title={t({ zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" })}
        subtitle={t({ zh: "排班、考勤与薪酬", en: "Scheduling, time tracking, and payroll", fr: "Planification, pointage et paie" })}
        range={t({ zh: "5月26日当周", en: "Week of May 26", fr: "Semaine du 26 mai" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "员工", en: "Staff", fr: "Personnel" })} value="14" delta={t({ zh: "今日 9 人", en: "9 on today", fr: "9 aujourd'hui" })} tone="slate" />
        <Kpi label={t({ zh: "本周工时", en: "Hours this week", fr: "Heures cette semaine" })} value="612" delta={t({ zh: "较上周 +18", en: "+18 vs last wk", fr: "+18 vs sem. dern." })} tone="slate" />
        <Kpi label={t({ zh: "人力成本", en: "Labor cost", fr: "Coût de main-d'œuvre" })} value="$9,180" delta="+2.4%" />
        <Kpi label={t({ zh: "人力占营收", en: "Labor % of sales", fr: "Main-d'œuvre % ventes" })} value="26%" delta={t({ zh: "-1.2 个百分点", en: "-1.2 pts", fr: "-1,2 pt" })} />
      </KpiRow>

      <Card title={t({ zh: "今日排班", en: "Today's schedule", fr: "Horaire du jour" })}>
        <Table
          head={[
            t({ zh: "姓名", en: "Name", fr: "Nom" }),
            t({ zh: "岗位", en: "Role", fr: "Poste" }),
            t({ zh: "班次", en: "Shift", fr: "Quart" }),
            t({ zh: "工时", en: "Hours", fr: "Heures" }),
            t({ zh: "状态", en: "Status", fr: "Statut" }),
          ]}
          alignRight={[3]}
          rows={[
            ["Wei Chen", t({ zh: "服务员", en: "Server", fr: "Serveur" }), "10:00 – 18:00", "8.0", IN],
            ["Amy Lo", t({ zh: "收银", en: "Cashier", fr: "Caissier" }), "11:00 – 19:00", "8.0", IN],
            ["David Ng", t({ zh: "主厨", en: "Chef", fr: "Chef" }), "09:00 – 17:00", "8.0", IN],
            ["Mei Zhou", t({ zh: "服务员", en: "Server", fr: "Serveur" }), "16:00 – 23:00", "7.0", SCH],
            ["Sam Tran", t({ zh: "后厨", en: "Kitchen", fr: "Cuisine" }), "10:00 – 18:00", "8.0", IN],
            ["Kevin Pham", t({ zh: "洗碗", en: "Dishwasher", fr: "Plongeur" }), "17:00 – 23:00", "6.0", SCH],
          ]}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t({ zh: "每日工时", en: "Hours by day", fr: "Heures par jour" })}>
          <Bars
            data={[
              { label: t({ zh: "一", en: "Mon", fr: "Lun" }), value: 78 },
              { label: t({ zh: "二", en: "Tue", fr: "Mar" }), value: 82 },
              { label: t({ zh: "三", en: "Wed", fr: "Mer" }), value: 88 },
              { label: t({ zh: "四", en: "Thu", fr: "Jeu" }), value: 91 },
              { label: t({ zh: "五", en: "Fri", fr: "Ven" }), value: 104 },
              { label: t({ zh: "六", en: "Sat", fr: "Sam" }), value: 96 },
              { label: t({ zh: "日", en: "Sun", fr: "Dim" }), value: 73 },
            ]}
          />
        </Card>

        <Card title={t({ zh: "本期薪酬", en: "Payroll · this period", fr: "Paie · cette période" })}>
          <Table
            head={[
              t({ zh: "姓名", en: "Name", fr: "Nom" }),
              t({ zh: "工时", en: "Hours", fr: "Heures" }),
              t({ zh: "时薪", en: "Rate", fr: "Taux" }),
              t({ zh: "应发", en: "Gross", fr: "Brut" }),
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
