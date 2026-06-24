"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Bars, Badge } from "../ui";
import { useLang } from "../lang";

export default function Inventory() {
  const { t } = useLang();
  const IN = <Badge tone="green">{t({ zh: "有货", en: "In stock", fr: "En stock" })}</Badge>;
  const LOW = <Badge tone="amber">{t({ zh: "偏低", en: "Low", fr: "Faible" })}</Badge>;
  const OUT = <Badge tone="red">{t({ zh: "缺货", en: "Out", fr: "Rupture" })}</Badge>;
  return (
    <>
      <PageHeader
        title={t({ zh: "库存", en: "Inventory", fr: "Inventaire" })}
        subtitle={t({ zh: "现有库存、安全库存与补货提醒", en: "Stock on hand, par levels, and what to reorder", fr: "Stock disponible, seuils et articles à recommander" })}
        range={t({ zh: "实时", en: "Live", fr: "En direct" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "在管 SKU", en: "SKUs tracked", fr: "SKU suivis" })} value="142" delta={t({ zh: "6 个分类", en: "6 categories", fr: "6 catégories" })} tone="slate" />
        <Kpi label={t({ zh: "库存偏低", en: "Low stock", fr: "Stock faible" })} value="7" delta={t({ zh: "尽快补货", en: "Reorder soon", fr: "À recommander bientôt" })} tone="slate" />
        <Kpi label={t({ zh: "缺货", en: "Out of stock", fr: "Rupture de stock" })} value="2" delta={t({ zh: "立即补货", en: "Reorder now", fr: "À recommander" })} tone="red" />
        <Kpi label={t({ zh: "库存价值", en: "Inventory value", fr: "Valeur du stock" })} value="$11,240" delta={t({ zh: "较上周 -3.1%", en: "-3.1% vs last wk", fr: "-3,1% vs sem. dern." })} tone="slate" />
      </KpiRow>

      <Card title={t({ zh: "库存水平", en: "Stock levels", fr: "Niveaux de stock" })}>
        <Table
          head={[
            t({ zh: "品项", en: "Item", fr: "Article" }),
            t({ zh: "分类", en: "Category", fr: "Catégorie" }),
            t({ zh: "现有", en: "On hand", fr: "Disponible" }),
            t({ zh: "安全量", en: "Par", fr: "Seuil" }),
            t({ zh: "状态", en: "Status", fr: "Statut" }),
            t({ zh: "供应商", en: "Supplier", fr: "Fournisseur" }),
          ]}
          alignRight={[2, 3]}
          rows={[
            [t({ zh: "茉莉香米", en: "Jasmine rice", fr: "Riz jasmin" }), t({ zh: "干货", en: "Dry goods", fr: "Épicerie sèche" }), t({ zh: "8 袋", en: "8 bags", fr: "8 sacs" }), "6", IN, t({ zh: "士巴丹拿干货", en: "Spadina Dry Goods", fr: "Épicerie sèche Spadina" })],
            [t({ zh: "猪排骨", en: "Pork ribs", fr: "Côtes de porc" }), t({ zh: "肉类", en: "Meat", fr: "Viande" }), "12 kg", "20", LOW, t({ zh: "金牌肉类", en: "Golden Meats", fr: "Viandes Golden" })],
            [t({ zh: "活鲈鱼", en: "Live sea bass", fr: "Bar vivant" }), t({ zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }), "0", "8", OUT, "金记海鲜"],
            [t({ zh: "小白菜", en: "Bok choy", fr: "Bok choy" }), t({ zh: "蔬菜", en: "Produce", fr: "Légumes" }), t({ zh: "9 箱", en: "9 cases", fr: "9 caisses" }), "8", IN, t({ zh: "幸运蔬果", en: "Lucky Produce", fr: "Légumes Lucky" })],
            [t({ zh: "食用油 (20L)", en: "Cooking oil (20L)", fr: "Huile (20 L)" }), t({ zh: "干货", en: "Dry goods", fr: "Épicerie sèche" }), "3", "5", LOW, t({ zh: "大统华批发", en: "T&T Wholesale", fr: "Gros T&T" })],
            [t({ zh: "冷冻虾", en: "Shrimp (frozen)", fr: "Crevettes (congelées)" }), t({ zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }), "0", "6", OUT, "金记海鲜"],
            [t({ zh: "奶茶粉", en: "Milk tea powder", fr: "Poudre à thé au lait" }), t({ zh: "饮料", en: "Beverage", fr: "Boissons" }), t({ zh: "14 桶", en: "14 tubs", fr: "14 pots" }), "8", IN, t({ zh: "珍珠饮料", en: "Pearl Beverage", fr: "Boissons Pearl" })],
            [t({ zh: "酱油 (箱)", en: "Soy sauce (case)", fr: "Sauce soja (caisse)" }), t({ zh: "干货", en: "Dry goods", fr: "Épicerie sèche" }), "5", "6", LOW, t({ zh: "大统华批发", en: "T&T Wholesale", fr: "Gros T&T" })],
          ]}
        />
      </Card>

      <Card title={t({ zh: "本周用量最高的食材 (kg)", en: "Top ingredient usage (this week, kg)", fr: "Ingrédients les plus utilisés (cette semaine, kg)" })}>
        <Bars
          data={[
            { label: t({ zh: "米", en: "Rice", fr: "Riz" }), value: 64 },
            { label: t({ zh: "猪肉", en: "Pork", fr: "Porc" }), value: 48 },
            { label: t({ zh: "鸡肉", en: "Chicken", fr: "Poulet" }), value: 41 },
            { label: t({ zh: "虾", en: "Shrimp", fr: "Crevettes" }), value: 33 },
            { label: t({ zh: "白菜", en: "Bok choy", fr: "Bok choy" }), value: 28 },
            { label: t({ zh: "牛肉", en: "Beef", fr: "Bœuf" }), value: 22 },
            { label: t({ zh: "豆腐", en: "Tofu", fr: "Tofu" }), value: 18 },
          ]}
        />
      </Card>
    </>
  );
}
