"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";
import { useLang } from "../lang";

export default function Inventory() {
  const { t } = useLang();
  const IN = <Badge tone="green">{t({ zh: "有货", en: "In stock" })}</Badge>;
  const LOW = <Badge tone="amber">{t({ zh: "偏低", en: "Low" })}</Badge>;
  const OUT = <Badge tone="red">{t({ zh: "缺货", en: "Out" })}</Badge>;
  return (
    <>
      <PageHeader
        title={t({ zh: "库存", en: "Inventory" })}
        subtitle={t({ zh: "现有库存、安全库存与补货提醒", en: "Stock on hand, par levels, and what to reorder" })}
        range={t({ zh: "实时", en: "Live" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "在管 SKU", en: "SKUs tracked" })} value="142" delta={t({ zh: "6 个分类", en: "6 categories" })} tone="slate" />
        <Kpi label={t({ zh: "库存偏低", en: "Low stock" })} value="7" delta={t({ zh: "尽快补货", en: "Reorder soon" })} tone="slate" />
        <Kpi label={t({ zh: "缺货", en: "Out of stock" })} value="2" delta={t({ zh: "立即补货", en: "Reorder now" })} tone="red" />
        <Kpi label={t({ zh: "库存价值", en: "Inventory value" })} value="$11,240" delta={t({ zh: "较上周 -3.1%", en: "-3.1% vs last wk" })} tone="slate" />
      </KpiRow>

      <Card title={t({ zh: "库存水平", en: "Stock levels" })}>
        <Table
          head={[
            t({ zh: "品项", en: "Item" }),
            t({ zh: "分类", en: "Category" }),
            t({ zh: "现有", en: "On hand" }),
            t({ zh: "安全量", en: "Par" }),
            t({ zh: "状态", en: "Status" }),
            t({ zh: "供应商", en: "Supplier" }),
          ]}
          alignRight={[2, 3]}
          rows={[
            [t({ zh: "茉莉香米", en: "Jasmine rice" }), t({ zh: "干货", en: "Dry goods" }), t({ zh: "8 袋", en: "8 bags" }), "6", IN, t({ zh: "士巴丹拿干货", en: "Spadina Dry Goods" })],
            [t({ zh: "猪排骨", en: "Pork ribs" }), t({ zh: "肉类", en: "Meat" }), "12 kg", "20", LOW, t({ zh: "金牌肉类", en: "Golden Meats" })],
            [t({ zh: "活鲈鱼", en: "Live sea bass" }), t({ zh: "海鲜", en: "Seafood" }), "0", "8", OUT, "金记海鲜"],
            [t({ zh: "小白菜", en: "Bok choy" }), t({ zh: "蔬菜", en: "Produce" }), t({ zh: "9 箱", en: "9 cases" }), "8", IN, t({ zh: "幸运蔬果", en: "Lucky Produce" })],
            [t({ zh: "食用油 (20L)", en: "Cooking oil (20L)" }), t({ zh: "干货", en: "Dry goods" }), "3", "5", LOW, t({ zh: "大统华批发", en: "T&T Wholesale" })],
            [t({ zh: "冷冻虾", en: "Shrimp (frozen)" }), t({ zh: "海鲜", en: "Seafood" }), "0", "6", OUT, "金记海鲜"],
            [t({ zh: "奶茶粉", en: "Milk tea powder" }), t({ zh: "饮料", en: "Beverage" }), t({ zh: "14 桶", en: "14 tubs" }), "8", IN, t({ zh: "珍珠饮料", en: "Pearl Beverage" })],
            [t({ zh: "酱油 (箱)", en: "Soy sauce (case)" }), t({ zh: "干货", en: "Dry goods" }), "5", "6", LOW, t({ zh: "大统华批发", en: "T&T Wholesale" })],
          ]}
        />
      </Card>

      <Card title={t({ zh: "本周用量最高的食材 (kg)", en: "Top ingredient usage (this week, kg)" })}>
        <Bars
          data={[
            { label: t({ zh: "米", en: "Rice" }), value: 64 },
            { label: t({ zh: "猪肉", en: "Pork" }), value: 48 },
            { label: t({ zh: "鸡肉", en: "Chicken" }), value: 41 },
            { label: t({ zh: "虾", en: "Shrimp" }), value: 33 },
            { label: t({ zh: "白菜", en: "Bok choy" }), value: 28 },
            { label: t({ zh: "牛肉", en: "Beef" }), value: 22 },
            { label: t({ zh: "豆腐", en: "Tofu" }), value: 18 },
          ]}
        />
      </Card>
    </>
  );
}
