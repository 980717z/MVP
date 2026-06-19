"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";
import { useLang } from "../lang";

export default function Reconcile() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "对账", en: "Reconcile", fr: "Rapprochement" })}
        subtitle={t({ zh: "每日现金、刷卡结算与差异", en: "Daily cash, card settlements, and variance", fr: "Encaisse quotidienne, règlements cartes et écarts" })}
        range={t({ zh: "5月26日 – 6月1日", en: "May 26 – Jun 1", fr: "26 mai – 1 juin" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "应收 (今日)", en: "Expected (today)", fr: "Attendu (aujourd'hui)" })} value="$2,540" delta={t({ zh: "来自订单", en: "From orders", fr: "D'après les commandes" })} tone="slate" />
        <Kpi label={t({ zh: "实点", en: "Counted", fr: "Compté" })} value="$2,512" delta={t({ zh: "钱箱 + 存款", en: "Drawer + deposits", fr: "Caisse + dépôts" })} tone="slate" />
        <Kpi label={t({ zh: "差异", en: "Variance", fr: "Écart" })} value="-$28" delta={t({ zh: "在容差范围内", en: "Within tolerance", fr: "Dans la tolérance" })} tone="red" />
        <Kpi label={t({ zh: "刷卡结算", en: "Card settled", fr: "Cartes réglées" })} value="$1,980" delta={t({ zh: "已到账", en: "Cleared", fr: "Réglé" })} />
      </KpiRow>

      <Card title={t({ zh: "每日对账", en: "Daily reconciliation", fr: "Rapprochement quotidien" })}>
        <Table
          head={[
            t({ zh: "日期", en: "Date", fr: "Date" }),
            t({ zh: "营业额", en: "Sales", fr: "Ventes" }),
            t({ zh: "现金", en: "Cash", fr: "Espèces" }),
            t({ zh: "刷卡", en: "Card", fr: "Carte" }),
            t({ zh: "应收", en: "Expected", fr: "Attendu" }),
            t({ zh: "实点", en: "Counted", fr: "Compté" }),
            t({ zh: "差异", en: "Variance", fr: "Écart" }),
          ]}
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

      <Card title={t({ zh: "备注", en: "Notes", fr: "Notes" })}>
        <p className="text-sm text-slate-600">
          {t({
            zh: "5月29日差异 -$45，已标记复核 —— 建议重点钱箱。其余各日均在 ±$30 容差范围内。",
            en: "May 29 variance of -$45 flagged for review — drawer recount recommended. All other days within the ±$30 tolerance.",
            fr: "Écart de -45 $ le 29 mai signalé pour vérification — recomptage de la caisse recommandé. Tous les autres jours sont dans la tolérance de ±30 $.",
          })}
        </p>
      </Card>
    </>
  );
}
