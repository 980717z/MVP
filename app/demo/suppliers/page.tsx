"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";
import { useLang } from "../lang";

export default function Suppliers() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "供应商", en: "Suppliers" })}
        subtitle={t({ zh: "供应商、采购单与到货表现", en: "Vendors, purchase orders, and delivery performance" })}
        range={t({ zh: "5月", en: "May" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "活跃供应商", en: "Active suppliers" })} value="12" delta={t({ zh: "本月新增 2 家", en: "2 added this month" })} tone="slate" />
        <Kpi label={t({ zh: "在途采购单", en: "Open POs" })} value="5" delta={t({ zh: "已下单 $3,180", en: "$3,180 committed" })} tone="slate" />
        <Kpi label={t({ zh: "本月采购额", en: "Spend (MTD)" })} value="$9,420" delta="+4.7%" />
        <Kpi label={t({ zh: "平均交期", en: "Avg lead time" })} value={t({ zh: "2.1 天", en: "2.1 days" })} delta={t({ zh: "-0.3 天", en: "-0.3 days" })} />
      </KpiRow>

      <Card title={t({ zh: "供应商", en: "Suppliers" })}>
        <Table
          head={[
            t({ zh: "供应商", en: "Supplier" }),
            t({ zh: "分类", en: "Category" }),
            t({ zh: "最近下单", en: "Last order" }),
            t({ zh: "未结款", en: "Outstanding" }),
            t({ zh: "准时率", en: "On-time" }),
            t({ zh: "状态", en: "Status" }),
          ]}
          alignRight={[3, 4]}
          rows={[
            ["金记海鲜", t({ zh: "海鲜", en: "Seafood" }), "May 28", "$1,240", "96%", <Badge key="1" tone="green">{t({ zh: "优选", en: "Preferred" })}</Badge>],
            [t({ zh: "幸运蔬果", en: "Lucky Produce" }), t({ zh: "蔬菜", en: "Produce" }), "May 29", "$420", "92%", <Badge key="2" tone="green">{t({ zh: "优选", en: "Preferred" })}</Badge>],
            [t({ zh: "金牌肉类", en: "Golden Meats" }), t({ zh: "肉类", en: "Meat" }), "May 27", "$880", "88%", <Badge key="3" tone="slate">{t({ zh: "合作中", en: "Active" })}</Badge>],
            [t({ zh: "大统华批发", en: "T&T Wholesale" }), t({ zh: "干货", en: "Dry goods" }), "May 26", "$640", "99%", <Badge key="4" tone="green">{t({ zh: "优选", en: "Preferred" })}</Badge>],
            [t({ zh: "珍珠饮料", en: "Pearl Beverage" }), t({ zh: "饮料", en: "Beverage" }), "May 24", "$0", "90%", <Badge key="5" tone="slate">{t({ zh: "合作中", en: "Active" })}</Badge>],
            [t({ zh: "香港面厂", en: "Hong Kong Noodle Co." }), t({ zh: "干货", en: "Dry goods" }), "May 21", "$0", "84%", <Badge key="6" tone="amber">{t({ zh: "待评估", en: "Review" })}</Badge>],
          ]}
        />
      </Card>

      <Card title={t({ zh: "即将到货", en: "Upcoming deliveries" })}>
        <Table
          head={[
            t({ zh: "采购单", en: "PO" }),
            t({ zh: "供应商", en: "Supplier" }),
            t({ zh: "品项", en: "Items" }),
            t({ zh: "预计到货", en: "ETA" }),
            t({ zh: "状态", en: "Status" }),
          ]}
          rows={[
            ["PO-2041", "金记海鲜", t({ zh: "鲈鱼、虾、带子", en: "Sea bass, shrimp, scallops" }), t({ zh: "明天 07:00", en: "Tomorrow, 7:00am" }), <Badge key="1" tone="blue">{t({ zh: "已确认", en: "Confirmed" })}</Badge>],
            ["PO-2040", t({ zh: "幸运蔬果", en: "Lucky Produce" }), t({ zh: "白菜、葱、姜", en: "Bok choy, scallions, ginger" }), t({ zh: "明天 06:30", en: "Tomorrow, 6:30am" }), <Badge key="2" tone="blue">{t({ zh: "已确认", en: "Confirmed" })}</Badge>],
            ["PO-2039", t({ zh: "金牌肉类", en: "Golden Meats" }), t({ zh: "排骨、鸡腿", en: "Pork ribs, chicken thigh" }), t({ zh: "6月2日 08:00", en: "Jun 2, 8:00am" }), <Badge key="3" tone="amber">{t({ zh: "待确认", en: "Pending" })}</Badge>],
            ["PO-2038", t({ zh: "大统华批发", en: "T&T Wholesale" }), t({ zh: "食用油、酱油", en: "Cooking oil, soy sauce" }), t({ zh: "6月3日 10:00", en: "Jun 3, 10:00am" }), <Badge key="4" tone="amber">{t({ zh: "待确认", en: "Pending" })}</Badge>],
          ]}
        />
      </Card>
    </>
  );
}
