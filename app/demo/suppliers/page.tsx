"use client";

import { PageHeader, KpiRow, Kpi, Card, Table, Badge } from "../ui";
import { useLang } from "../lang";

export default function Suppliers() {
  const { t } = useLang();
  return (
    <>
      <PageHeader
        title={t({ zh: "供应商", en: "Suppliers", fr: "Fournisseurs" })}
        subtitle={t({ zh: "供应商、采购单与到货表现", en: "Vendors, purchase orders, and delivery performance", fr: "Fournisseurs, bons de commande et performance de livraison" })}
        range={t({ zh: "5月", en: "May", fr: "May" })}
      />

      <KpiRow>
        <Kpi label={t({ zh: "活跃供应商", en: "Active suppliers", fr: "Fournisseurs actifs" })} value="12" delta={t({ zh: "本月新增 2 家", en: "2 added this month", fr: "2 ajoutés ce mois" })} tone="slate" />
        <Kpi label={t({ zh: "在途采购单", en: "Open POs", fr: "Bons en cours" })} value="5" delta={t({ zh: "已下单 $3,180", en: "$3,180 committed", fr: "3 180 $ engagés" })} tone="slate" />
        <Kpi label={t({ zh: "本月采购额", en: "Spend (MTD)", fr: "Dépenses (mois)" })} value="$9,420" delta="+4.7%" />
        <Kpi label={t({ zh: "平均交期", en: "Avg lead time", fr: "Délai moyen" })} value={t({ zh: "2.1 天", en: "2.1 days", fr: "2,1 jours" })} delta={t({ zh: "-0.3 天", en: "-0.3 days", fr: "-0,3 jour" })} />
      </KpiRow>

      <Card title={t({ zh: "供应商", en: "Suppliers", fr: "Fournisseurs" })}>
        <Table
          head={[
            t({ zh: "供应商", en: "Supplier", fr: "Fournisseur" }),
            t({ zh: "分类", en: "Category", fr: "Catégorie" }),
            t({ zh: "最近下单", en: "Last order", fr: "Dernière commande" }),
            t({ zh: "未结款", en: "Outstanding", fr: "Solde dû" }),
            t({ zh: "准时率", en: "On-time", fr: "Ponctualité" }),
            t({ zh: "状态", en: "Status", fr: "Statut" }),
          ]}
          alignRight={[3, 4]}
          rows={[
            ["金记海鲜", t({ zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }), "May 28", "$1,240", "96%", <Badge key="1" tone="green">{t({ zh: "优选", en: "Preferred", fr: "Préféré" })}</Badge>],
            [t({ zh: "幸运蔬果", en: "Lucky Produce", fr: "Légumes Lucky" }), t({ zh: "蔬菜", en: "Produce", fr: "Légumes" }), "May 29", "$420", "92%", <Badge key="2" tone="green">{t({ zh: "优选", en: "Preferred", fr: "Préféré" })}</Badge>],
            [t({ zh: "金牌肉类", en: "Golden Meats", fr: "Viandes Golden" }), t({ zh: "肉类", en: "Meat", fr: "Viande" }), "May 27", "$880", "88%", <Badge key="3" tone="slate">{t({ zh: "合作中", en: "Active", fr: "Actif" })}</Badge>],
            [t({ zh: "大统华批发", en: "T&T Wholesale", fr: "Gros T&T" }), t({ zh: "干货", en: "Dry goods", fr: "Épicerie sèche" }), "May 26", "$640", "99%", <Badge key="4" tone="green">{t({ zh: "优选", en: "Preferred", fr: "Préféré" })}</Badge>],
            [t({ zh: "珍珠饮料", en: "Pearl Beverage", fr: "Boissons Pearl" }), t({ zh: "饮料", en: "Beverage", fr: "Boissons" }), "May 24", "$0", "90%", <Badge key="5" tone="slate">{t({ zh: "合作中", en: "Active", fr: "Actif" })}</Badge>],
            [t({ zh: "香港面厂", en: "Hong Kong Noodle Co.", fr: "Nouilles Hong Kong" }), t({ zh: "干货", en: "Dry goods", fr: "Épicerie sèche" }), "May 21", "$0", "84%", <Badge key="6" tone="amber">{t({ zh: "待评估", en: "Review", fr: "À évaluer" })}</Badge>],
          ]}
        />
      </Card>

      <Card title={t({ zh: "即将到货", en: "Upcoming deliveries", fr: "Livraisons à venir" })}>
        <Table
          head={[
            t({ zh: "采购单", en: "PO", fr: "Bon" }),
            t({ zh: "供应商", en: "Supplier", fr: "Fournisseur" }),
            t({ zh: "品项", en: "Items", fr: "Articles" }),
            t({ zh: "预计到货", en: "ETA", fr: "Arrivée" }),
            t({ zh: "状态", en: "Status", fr: "Statut" }),
          ]}
          rows={[
            ["PO-2041", "金记海鲜", t({ zh: "鲈鱼、虾、带子", en: "Sea bass, shrimp, scallops", fr: "Bar, crevettes, pétoncles" }), t({ zh: "明天 07:00", en: "Tomorrow, 7:00am", fr: "Demain, 7h00" }), <Badge key="1" tone="blue">{t({ zh: "已确认", en: "Confirmed", fr: "Confirmé" })}</Badge>],
            ["PO-2040", t({ zh: "幸运蔬果", en: "Lucky Produce", fr: "Légumes Lucky" }), t({ zh: "白菜、葱、姜", en: "Bok choy, scallions, ginger", fr: "Bok choy, oignons verts, gingembre" }), t({ zh: "明天 06:30", en: "Tomorrow, 6:30am", fr: "Demain, 6h30" }), <Badge key="2" tone="blue">{t({ zh: "已确认", en: "Confirmed", fr: "Confirmé" })}</Badge>],
            ["PO-2039", t({ zh: "金牌肉类", en: "Golden Meats", fr: "Viandes Golden" }), t({ zh: "排骨、鸡腿", en: "Pork ribs, chicken thigh", fr: "Côtes de porc, haut de cuisse" }), t({ zh: "6月2日 08:00", en: "Jun 2, 8:00am", fr: "2 juin, 8h00" }), <Badge key="3" tone="amber">{t({ zh: "待确认", en: "Pending", fr: "En attente" })}</Badge>],
            ["PO-2038", t({ zh: "大统华批发", en: "T&T Wholesale", fr: "Gros T&T" }), t({ zh: "食用油、酱油", en: "Cooking oil, soy sauce", fr: "Huile, sauce soja" }), t({ zh: "6月3日 10:00", en: "Jun 3, 10:00am", fr: "3 juin, 10h00" }), <Badge key="4" tone="amber">{t({ zh: "待确认", en: "Pending", fr: "En attente" })}</Badge>],
          ]}
        />
      </Card>
    </>
  );
}
