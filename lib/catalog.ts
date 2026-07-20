// ─────────────────────────────────────────────────────────────────────────
//  FEATURE CATALOG — the single source of truth for the whole product.
//
//  Every item on the paper checklist ("可以帮您省心的地方") maps to one
//  module here.  A module declares WHAT data the merchant records (input
//  fields) and WHAT the system gives back (outputs / KPIs).  The onboarding
//  checklist, the sidebar, the dashboard and every data-entry page are all
//  generated from this file — pick modules → get a back-office.
// ─────────────────────────────────────────────────────────────────────────

export type Bi = { zh: string; en: string; fr: string };

export type FieldType =
  | "text"
  | "number"
  | "money"
  | "select"
  | "date"
  | "time"
  | "textarea";

export interface Field {
  key: string;
  label: Bi;
  type: FieldType;
  options?: Bi[];
  suffix?: string | Bi; // language-neutral units (kg, /h, ★) stay strings; word units use a Bi dict
  required?: boolean;
  /** half-width on the form grid */
  half?: boolean;
  /** per-unit value (price/rate/unit cost): summing it is meaningless, so stats
   *  show the average instead of a total. */
  unit?: boolean;
}

export interface ComputedRule {
  target: string;
  /** hoursBetween: fields is [startTimeKey, endTimeKey], target = decimal hours (handles overnight shifts). */
  formula: "sum" | "subtract" | "multiply" | "hoursBetween";
  /** field keys; prefix with "-" to subtract that field */
  fields: string[];
}

export interface ModuleDef {
  id: string;
  category: string;
  icon: string;
  label: Bi;
  /**
   * Only `ready: true` modules are shown to merchants (onboarding checklist,
   * settings, catalog overview).  Flip a module to `true` once it's polished
   * and we want to release it — we ship one feature at a time.
   */
  ready?: boolean;
  /**
   * When true this module renders its own custom page (a "portal") instead of
   * the generic form+table.  Wire the component up in the module page's
   * portal registry.
   */
  portal?: boolean;
  /** the pain point, lifted from the checklist's right column */
  pain: Bi;
  /** what the merchant types in */
  fields: Field[];
  /** what the system produces back */
  outputs: Bi[];
  /** field used for the headline KPI (sum), if any */
  amountKey?: string;
  amountLabel?: Bi;
  /** how the KPI sum is shown */
  amountKind?: "money" | "count";
  /** auto-calculation rules: compute a field from others */
  computed?: ComputedRule[];
}

export type Domain = "backoffice" | "frontend";

export interface DomainDef {
  id: Domain;
  label: Bi;
  blurb: Bi;
}

/** Top-level split: 后台（商家自用）vs 前台（面向客户）. */
export const DOMAINS: DomainDef[] = [
  {
    id: "backoffice",
    label: { zh: "后台", en: "Back office", fr: "Arrière-boutique" },
    blurb: { zh: "商家自己用的管理工具", en: "Tools the merchant uses internally", fr: "Outils de gestion à usage interne" },
  },
  {
    id: "frontend",
    label: { zh: "前台", en: "Front of house", fr: "Salle" },
    blurb: { zh: "面向顾客的功能", en: "Customer-facing features", fr: "Fonctions destinées aux clients" },
  },
];

export interface CategoryDef {
  id: string;
  label: Bi;
  domain: Domain;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "kitchen", label: { zh: "厨房 · 备货", en: "Kitchen & Prep", fr: "Cuisine et préparation" }, domain: "backoffice" },
  { id: "inventory", label: { zh: "库存 · 采购", en: "Inventory & Purchasing", fr: "Stock et achats" }, domain: "backoffice" },
  { id: "orders", label: { zh: "订单 · 预订", en: "Orders & Reservations", fr: "Commandes et réservations" }, domain: "backoffice" },
  { id: "finance", label: { zh: "财务 · 对账", en: "Finance & Reconciliation", fr: "Finances et rapprochement" }, domain: "backoffice" },
  { id: "staff", label: { zh: "员工", en: "Staff", fr: "Personnel" }, domain: "backoffice" },
  { id: "marketing", label: { zh: "客户 · 营销", en: "Customers & Marketing", fr: "Clients et marketing" }, domain: "backoffice" },
  { id: "compliance", label: { zh: "合规 · 设备", en: "Compliance & Equipment", fr: "Conformité et équipement" }, domain: "backoffice" },
  { id: "storefront", label: { zh: "前台 · 顾客", en: "Storefront", fr: "Vitrine" }, domain: "frontend" },
];

const yesNo: Bi[] = [
  { zh: "是", en: "Yes", fr: "Oui" },
  { zh: "否", en: "No", fr: "Non" },
];

export const MODULES: ModuleDef[] = [
  // ── Kitchen & Prep ────────────────────────────────────────────────────
  {
    id: "prep-signature",
    category: "kitchen",
    icon: "🍲",
    ready: true,
    label: { zh: "招牌备货（气锅鸡等）", en: "Signature Prep", fr: "Préparation des spécialités" },
    pain: {
      zh: "每天备多少合适？卖断可惜、备多浪费",
      en: "How much to prep? Sell-outs hurt, leftovers waste.",
      fr: "Quelle quantité préparer? Les ruptures nuisent, les restes gaspillent.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "dish", label: { zh: "招牌菜", en: "Dish", fr: "Plat" }, type: "text", half: true, required: true },
      { key: "prepped", label: { zh: "备货份数", en: "Prepped", fr: "Préparé" }, type: "number", suffix: { zh: "份", en: "servings", fr: "portions" }, half: true },
      { key: "sold", label: { zh: "实际售出", en: "Sold", fr: "Vendu" }, type: "number", suffix: { zh: "份", en: "servings", fr: "portions" }, half: true },
      { key: "leftover", label: { zh: "剩余/报废", en: "Leftover", fr: "Restant" }, type: "number", suffix: { zh: "份", en: "servings", fr: "portions" }, half: true },
      { key: "suggest", label: { zh: "明日建议", en: "Suggested tomorrow", fr: "Suggéré demain" }, type: "number", suffix: { zh: "份", en: "servings", fr: "portions" }, half: true },
      { key: "note", label: { zh: "备注", en: "Note", fr: "Note" }, type: "textarea" },
    ],
    outputs: [
      { zh: "按近 7 天销量给出明日备货建议", en: "Suggests tomorrow's prep from 7-day sales", fr: "Suggère la préparation de demain selon les ventes des 7 derniers jours" },
      { zh: "卖断 / 浪费提醒", en: "Sell-out & waste alerts", fr: "Alertes de rupture et de gaspillage" },
    ],
    amountKey: "leftover",
    amountLabel: { zh: "报废", en: "Waste", fr: "Gaspillage" },
    amountKind: "count",
  },
  // ── Storefront (前台 · 面向顾客) ──────────────────────────────────────
  {
    id: "qr-menu",
    category: "storefront",
    icon: "📱",
    ready: true,
    portal: true,
    label: { zh: "二维码菜单", en: "QR Code Menu", fr: "Menu par code QR" },
    pain: {
      zh: "顾客扫码即看菜单，免印刷、改价即时同步、中英文随时切换",
      en: "Guests scan to view the menu — no printing, instant price sync, bilingual.",
      fr: "Les clients scannent pour voir le menu — sans impression, prix synchronisés, bilingue.",
    },
    fields: [],
    outputs: [
      { zh: "一张二维码，顾客扫码看到你的电子菜单", en: "One QR code; guests scan to see your live menu", fr: "Un code QR; les clients scannent pour voir votre menu en direct" },
      { zh: "菜单设置里改价，扫码页实时更新", en: "Edit prices in Menu Settings, the public page updates instantly", fr: "Modifiez les prix dans les réglages, la page publique se met à jour instantanément" },
    ],
  },

  // ── Kitchen & Prep ────────────────────────────────────────────────────
  {
    id: "menu-generator",
    category: "kitchen",
    icon: "🍽️",
    ready: true,
    portal: true,
    label: { zh: "菜单设置", en: "Menu Settings", fr: "Réglages du menu" },
    pain: {
      zh: "想做一份漂亮的中英文菜单，但排版、翻译、改价都很费时间",
      en: "Want a nice bilingual menu, but layout, translation and pricing eat hours.",
      fr: "Vous voulez un beau menu bilingue, mais la mise en page, la traduction et les prix prennent des heures.",
    },
    fields: [],
    outputs: [
      { zh: "录入菜品，一键生成中英文菜单", en: "Enter dishes, generate a bilingual menu", fr: "Saisissez les plats, générez un menu bilingue" },
      { zh: "多种模板与风格，可导出打印 / 外卖平台", en: "Templates & styles, export for print or delivery apps", fr: "Modèles et styles, exportation pour l'impression ou les applis de livraison" },
    ],
  },
  {
    id: "dish-margin",
    category: "kitchen",
    icon: "📊",
    ready: true,
    label: { zh: "菜品销量", en: "Dish Sales", fr: "Ventes par plat" },
    pain: {
      zh: "不知道哪些菜卖得好、哪些卖不动",
      en: "No idea which dishes sell well.",
      fr: "Aucune idée des plats qui se vendent bien.",
    },
    fields: [
      { key: "dish", label: { zh: "菜名", en: "Dish", fr: "Plat" }, type: "text", half: true, required: true },
      { key: "price", label: { zh: "售价", en: "Price", fr: "Prix" }, type: "money", half: true, unit: true },
      { key: "soldMonth", label: { zh: "月销量", en: "Sold / month", fr: "Vendu / mois" }, type: "number", suffix: { zh: "份", en: "servings", fr: "portions" }, half: true },
      { key: "revenue", label: { zh: "销售额", en: "Sales", fr: "Ventes" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "销量排行：哪些菜最受欢迎", en: "Sales ranking: most popular dishes", fr: "Classement des ventes : les plats les plus populaires" },
      { zh: "完成的订单自动累加销量", en: "Completed orders auto-add sales", fr: "Les commandes complétées s'ajoutent automatiquement aux ventes" },
    ],
    amountKey: "revenue",
    amountLabel: { zh: "销售额（税前）", en: "Sales (pre-tax)", fr: "Ventes (avant taxes)" },
    amountKind: "money",
  },

  // ── Inventory & Purchasing ────────────────────────────────────────────
  {
    id: "stock-loss",
    category: "inventory",
    icon: "📦",
    ready: true,
    label: { zh: "库存与损耗", en: "Stock & Loss", fr: "Stock et pertes" },
    pain: {
      zh: "食材进出、报废损耗、成本不好算",
      en: "Inventory in-out, spoilage, hard to cost.",
      fr: "Entrées-sorties, pertes, coûts difficiles à calculer.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "item", label: { zh: "品种", en: "Item", fr: "Article" }, type: "text", half: true, required: true },
      { key: "type", label: { zh: "类型", en: "Type", fr: "Type" }, type: "select", half: true,
        options: [{ zh: "干货", en: "Dry goods", fr: "Produits secs" }, { zh: "蔬菜", en: "Vegetables", fr: "Légumes" }, { zh: "肉类", en: "Meat", fr: "Viande" }, { zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }, { zh: "冷冻", en: "Frozen", fr: "Surgelés" }, { zh: "调料", en: "Seasoning", fr: "Assaisonnements" }] },
      { key: "inQty", label: { zh: "进货", en: "In", fr: "Entrée" }, type: "number", suffix: "kg", half: true },
      { key: "unitCost", label: { zh: "成本单价", en: "Unit cost", fr: "Coût unitaire" }, type: "money", suffix: "/kg", half: true, unit: true },
      { key: "scrapQty", label: { zh: "报废", en: "Scrap", fr: "Rebut" }, type: "number", suffix: "kg", half: true },
      { key: "scrapValue", label: { zh: "报废价值", en: "Scrap value", fr: "Valeur du rebut" }, type: "money", half: true },
      { key: "lossQty", label: { zh: "消耗", en: "Usage", fr: "Consommation" }, type: "number", suffix: "kg", half: true },
      { key: "lossValue", label: { zh: "消耗价值", en: "Usage value", fr: "Valeur consommée" }, type: "money", half: true },
      { key: "onHand", label: { zh: "现存", en: "On hand", fr: "En stock" }, type: "number", suffix: "kg", half: true },
    ],
    outputs: [
      { zh: "报废 + 损耗金额（FIFO 先进先出计价）", en: "Scrap + loss cost (FIFO)", fr: "Coût des rebuts et pertes (PEPS)" },
      { zh: "进货数量与成本从采购自动同步", en: "In-qty & cost auto-synced from purchasing", fr: "Quantités et coûts d'entrée synchronisés depuis les achats" },
      { zh: "低库存预警", en: "Low-stock alerts", fr: "Alertes de stock bas" },
    ],
    amountKey: "lossQty",
    amountLabel: { zh: "今日消耗", en: "Usage today", fr: "Consommation du jour" },
    amountKind: "count",
  },
  {
    id: "purchasing",
    category: "inventory",
    icon: "🚚",
    ready: true,
    label: { zh: "采购与供应商比价", en: "Purchasing & Suppliers", fr: "Achats et fournisseurs" },
    pain: {
      zh: "进货靠经验，价格变化、到货数量不好核对",
      en: "Buying on memory; prices drift, deliveries hard to check.",
      fr: "Achats de mémoire; prix qui varient, livraisons difficiles à vérifier.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "supplier", label: { zh: "供应商", en: "Supplier", fr: "Fournisseur" }, type: "text", half: true, required: true },
      { key: "item", label: { zh: "品种", en: "Item", fr: "Article" }, type: "text", half: true },
      { key: "itemType", label: { zh: "类型", en: "Type", fr: "Type" }, type: "select", half: true,
        options: [{ zh: "干货", en: "Dry goods", fr: "Produits secs" }, { zh: "蔬菜", en: "Vegetables", fr: "Légumes" }, { zh: "肉类", en: "Meat", fr: "Viande" }, { zh: "海鲜", en: "Seafood", fr: "Fruits de mer" }, { zh: "冷冻", en: "Frozen", fr: "Surgelés" }, { zh: "调料", en: "Seasoning", fr: "Assaisonnements" }, { zh: "酒水", en: "Beverages", fr: "Boissons" }, { zh: "其他", en: "Other", fr: "Autre" }] },
      { key: "qty", label: { zh: "数量", en: "Qty", fr: "Quantité" }, type: "number", half: true },
      { key: "unitPrice", label: { zh: "单价", en: "Unit price", fr: "Prix unitaire" }, type: "money", half: true, unit: true },
      { key: "total", label: { zh: "金额", en: "Total", fr: "Total" }, type: "money", half: true },
      { key: "received", label: { zh: "到货核对", en: "Received OK", fr: "Réception conforme" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "同一品项的供应商比价", en: "Price comparison across suppliers", fr: "Comparaison des prix entre fournisseurs" },
      { zh: "采购支出汇总", en: "Purchasing spend totals", fr: "Totaux des dépenses d'achat" },
    ],
    amountKey: "total",
    amountLabel: { zh: "采购支出", en: "Purchasing spend", fr: "Dépenses d'achat" },
    amountKind: "money",
    computed: [{ target: "total", formula: "multiply", fields: ["qty", "unitPrice"] }],
  },

  // ── Orders & Reservations ─────────────────────────────────────────────
  {
    id: "online-orders",
    category: "orders",
    icon: "🧾",
    ready: true,
    portal: true,
    label: { zh: "在线点餐订单", en: "Online Orders", fr: "Commandes en ligne" },
    pain: {
      zh: "顾客扫码下的单，集中一处看，标记出餐进度",
      en: "All QR-menu orders in one place, track prep status.",
      fr: "Toutes les commandes du menu QR au même endroit, suivi de la préparation.",
    },
    fields: [],
    outputs: [
      { zh: "实时收到扫码菜单的订单", en: "Live orders from the QR menu", fr: "Commandes en temps réel depuis le menu QR" },
      { zh: "新单 / 备餐 / 完成 状态管理", en: "New / preparing / done status", fr: "Statuts : nouvelle / en préparation / terminée" },
    ],
  },
  {
    id: "delivery-agg",
    category: "orders",
    icon: "🛵",
    ready: true,
    label: { zh: "外卖平台订单汇总", en: "Delivery Platform Roll-up", fr: "Bilan des plateformes de livraison" },
    pain: {
      zh: "DoorDash / UberEats / 熊猫 / 饭团 平台太多，订单和收入不好统一看",
      en: "Too many platforms — orders & income hard to see together.",
      fr: "Trop de plateformes — commandes et revenus difficiles à voir ensemble.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "platform", label: { zh: "平台", en: "Platform", fr: "Plateforme" }, type: "select", half: true,
        options: [{ zh: "DoorDash", en: "DoorDash", fr: "DoorDash" }, { zh: "UberEats", en: "UberEats", fr: "UberEats" }, { zh: "熊猫", en: "HungryPanda", fr: "HungryPanda" }, { zh: "饭团", en: "Fantuan", fr: "Fantuan" }] },
      { key: "orders", label: { zh: "订单数", en: "Orders", fr: "Commandes" }, type: "number", half: true },
      { key: "gross", label: { zh: "营业额", en: "Gross", fr: "Brut" }, type: "money", half: true },
      { key: "commission", label: { zh: "平台抽成", en: "Commission", fr: "Commission" }, type: "money", half: true },
      { key: "net", label: { zh: "实收", en: "Net", fr: "Net" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "各平台订单/收入/抽成一张表", en: "All platforms in one table", fr: "Toutes les plateformes dans un seul tableau" },
      { zh: "实收对账（实收 = 营业额 − 抽成），看清平台扣了多少", en: "Net = gross − commission; see exactly what each platform took", fr: "Net = brut − commission; voyez exactement ce que chaque plateforme a prélevé" },
    ],
    amountKey: "net",
    amountLabel: { zh: "外卖实收", en: "Delivery net", fr: "Net de livraison" },
    amountKind: "money",
    computed: [{ target: "net", formula: "subtract", fields: ["gross", "-commission"] }],
  },
  {
    id: "group-booking",
    category: "orders",
    icon: "🎉",
    ready: true,
    label: { zh: "团餐 / 大桌预订与订金", en: "Group Bookings & Deposits", fr: "Réservations de groupe et acomptes" },
    pain: {
      zh: "大单靠人记，订金、菜单、备货容易乱",
      en: "Big bookings in someone's head; deposits & menus get messy.",
      fr: "Grosses réservations mémorisées; acomptes et menus deviennent chaotiques.",
    },
    fields: [
      { key: "date", label: { zh: "用餐日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "customer", label: { zh: "客户", en: "Customer", fr: "Client" }, type: "text", half: true, required: true },
      { key: "phone", label: { zh: "电话", en: "Phone", fr: "Téléphone" }, type: "text", half: true },
      { key: "guests", label: { zh: "人数", en: "Guests", fr: "Convives" }, type: "number", half: true },
      { key: "tables", label: { zh: "桌数", en: "Tables", fr: "Tables" }, type: "number", half: true },
      { key: "deposit", label: { zh: "订金", en: "Deposit", fr: "Acompte" }, type: "money", half: true },
      { key: "total", label: { zh: "预估总额", en: "Est. total", fr: "Total estimé" }, type: "money", half: true },
      { key: "balance", label: { zh: "待收尾款", en: "Balance due", fr: "Solde dû" }, type: "money", half: true },
      { key: "tips", label: { zh: "小费", en: "Tips", fr: "Pourboires" }, type: "money", half: true },
      { key: "menu", label: { zh: "菜单/要求", en: "Menu / notes", fr: "Menu / notes" }, type: "textarea" },
    ],
    outputs: [
      { zh: "预订台账 + 待收尾款（预估总额 − 订金）", en: "Booking ledger + balance due (est. total − deposit)", fr: "Registre des réservations + solde dû (total estimé − acompte)" },
      { zh: "近3天到店提醒", en: "Arrival reminders for the next 3 days", fr: "Rappels d'arrivée pour les 3 prochains jours" },
    ],
    amountKey: "deposit",
    amountLabel: { zh: "已收订金", en: "Deposits held", fr: "Acomptes encaissés" },
    amountKind: "money",
    computed: [{ target: "balance", formula: "subtract", fields: ["total", "-deposit"] }],
  },

  // ── Finance ───────────────────────────────────────────────────────────
  {
    id: "sales",
    category: "finance",
    icon: "🧾",
    ready: true,
    portal: true,
    label: { zh: "销售流水", en: "Sales", fr: "Ventes" },
    pain: {
      zh: "现金/扫码/Clover 的销售和税额对不上、报税难",
      en: "Cash, QR and Clover sales don't reconcile; HST is hard to file.",
      fr: "Les ventes comptant, QR et Clover ne concordent pas; la TVH est difficile à déclarer.",
    },
    fields: [],
    outputs: [
      { zh: "每笔销售自动算税（安省 HST 13%）", en: "Per-sale tax auto-calculated (Ontario HST 13%)", fr: "Taxe calculée par vente (TVH Ontario 13 %)" },
      { zh: "GST/PST 收取额汇总，报税一目了然", en: "GST/PST collected totals for HST remittance", fr: "Totaux de TPS/TVP perçus pour la remise de TVH" },
    ],
    amountKey: "subtotal",
    amountLabel: { zh: "销售额（税前）", en: "Sales (pre-tax)", fr: "Ventes (avant taxes)" },
    amountKind: "money",
  },
  {
    id: "sales-stats",
    category: "finance",
    icon: "📈",
    ready: true,
    portal: true,
    label: { zh: "销售统计", en: "Sales Stats", fr: "Statistiques de ventes" },
    pain: {
      zh: "不知道今天赚了多少、现金/EMT/刷卡各占多少、小费收了多少",
      en: "No clear picture of today's revenue, the cash/EMT/card split, or tips.",
      fr: "Aucune vue claire du revenu du jour, de la répartition comptant/virement/carte ou des pourboires.",
    },
    fields: [],
    outputs: [
      { zh: "今日营收 + 自选日期与区间", en: "Today's revenue + date & range picker", fr: "Revenu du jour + sélecteur de dates et périodes" },
      { zh: "按现金 / EMT / 刷卡拆分,小费单列", en: "Split by cash / EMT / card, tips tracked separately", fr: "Ventilé par comptant / virement / carte, pourboires à part" },
    ],
  },
  // 每日结账与收入 (daily-close) retired — folded into 销售统计 (Sales Stats) as an
  // editable expenses/net row per day. Revenue comes from real checkout sessions.

  // ── Staff ─────────────────────────────────────────────────────────────
  {
    id: "scheduling",
    category: "staff",
    icon: "👥",
    ready: true,
    label: { zh: "员工排班与工时", en: "Scheduling & Hours", fr: "Horaires et heures" },
    pain: {
      zh: "排班、换班、请假、工时 / 工资容易乱",
      en: "Shifts, swaps, leave, hours & pay get tangled.",
      fr: "Quarts, échanges, congés, heures et paie s'emmêlent.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "staff", label: { zh: "员工", en: "Staff", fr: "Employé" }, type: "text", half: true, required: true },
      { key: "role", label: { zh: "岗位", en: "Role", fr: "Poste" }, type: "text", half: true },
      { key: "attendance", label: { zh: "出勤状态", en: "Attendance", fr: "Présence" }, type: "select", half: true,
        options: [{ zh: "正常", en: "Present", fr: "Présent" }, { zh: "请假", en: "Leave", fr: "Congé" }, { zh: "休息", en: "Day off", fr: "Repos" }, { zh: "迟到", en: "Late", fr: "En retard" }] },
      { key: "start", label: { zh: "上班", en: "Start", fr: "Début" }, type: "time", half: true },
      { key: "end", label: { zh: "下班", en: "End", fr: "Fin" }, type: "time", half: true },
      { key: "hours", label: { zh: "工时", en: "Hours", fr: "Heures" }, type: "number", suffix: "h", half: true },
      { key: "rate", label: { zh: "时薪", en: "Rate", fr: "Taux horaire" }, type: "money", suffix: "/h", half: true, unit: true },
      { key: "pay", label: { zh: "工资", en: "Pay", fr: "Salaire" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "周排班表 + 工时统计", en: "Weekly roster + hour totals", fr: "Horaire hebdomadaire + totaux d'heures" },
      { zh: "工资预估 = 工时 × 时薪", en: "Payroll estimate = hours × rate", fr: "Estimation de la paie = heures × taux horaire" },
    ],
    amountKey: "pay",
    amountLabel: { zh: "工资", en: "Pay", fr: "Salaire" },
    amountKind: "money",
    computed: [
      { target: "hours", formula: "hoursBetween", fields: ["start", "end"] },
      { target: "pay", formula: "multiply", fields: ["hours", "rate"] },
    ],
  },

  // ── Customers & Marketing ─────────────────────────────────────────────
  {
    id: "members",
    category: "marketing",
    icon: "⭐",
    ready: true,
    label: { zh: "会员", en: "Members", fr: "Membres" },
    pain: {
      zh: "没系统沉淀，节日生日提醒、微信回访做不起来",
      en: "No CRM — birthday/holiday follow-ups never happen.",
      fr: "Aucun CRM — les suivis d'anniversaire et de fêtes n'arrivent jamais.",
    },
    fields: [
      { key: "phone", label: { zh: "电话", en: "Phone", fr: "Téléphone" }, type: "text", half: true, required: true },
      { key: "name", label: { zh: "姓名", en: "Name", fr: "Nom" }, type: "text", half: true },
      { key: "birthday", label: { zh: "生日", en: "Birthday", fr: "Anniversaire" }, type: "date", half: true },
      { key: "visits", label: { zh: "订单次数", en: "Orders", fr: "Commandes" }, type: "number", half: true },
      { key: "spend", label: { zh: "累计消费", en: "Lifetime spend", fr: "Dépense cumulée" }, type: "money", half: true },
      { key: "tier", label: { zh: "等级", en: "Tier", fr: "Niveau" }, type: "select", half: true,
        options: [{ zh: "普通", en: "Regular", fr: "Régulier" }, { zh: "银卡", en: "Silver", fr: "Argent" }, { zh: "金卡", en: "Gold", fr: "Or" }] },
      { key: "note", label: { zh: "偏好/备注", en: "Notes", fr: "Notes" }, type: "textarea" },
    ],
    outputs: [
      { zh: "会员档案 + 生日/节日提醒", en: "Member profiles + birthday reminders", fr: "Fiches des membres + rappels d'anniversaire" },
      { zh: "消费分层，找出高价值熟客", en: "Spend tiers to find VIPs", fr: "Paliers de dépense pour repérer les clients de valeur" },
    ],
    amountKey: "spend",
    amountLabel: { zh: "会员累计消费", en: "Member lifetime spend", fr: "Dépense cumulée des membres" },
    amountKind: "money",
  },
  {
    id: "reviews",
    category: "marketing",
    icon: "💬",
    ready: true,
    label: { zh: "改进意见", en: "Improvement Feedback", fr: "Commentaires d'amélioration" },
    pain: {
      zh: "Google / 外卖差评分散，回复慢、不知道问题集中在哪",
      en: "Reviews scattered; slow replies, unclear what's wrong.",
      fr: "Avis éparpillés; réponses lentes, causes des problèmes floues.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "source", label: { zh: "来源", en: "Source", fr: "Source" }, type: "select", half: true,
        options: [{ zh: "Google", en: "Google", fr: "Google" }, { zh: "Yelp", en: "Yelp", fr: "Yelp" }, { zh: "DoorDash", en: "DoorDash", fr: "DoorDash" }, { zh: "UberEats", en: "UberEats", fr: "UberEats" }, { zh: "大众点评", en: "Dianping", fr: "Dianping" }] },
      { key: "rating", label: { zh: "评分", en: "Rating", fr: "Note" }, type: "number", suffix: "★", half: true },
      { key: "topic", label: { zh: "问题类别", en: "Topic", fr: "Catégorie" }, type: "select", half: true,
        options: [{ zh: "出餐慢", en: "Slow", fr: "Lenteur" }, { zh: "口味", en: "Taste", fr: "Goût" }, { zh: "份量", en: "Portion", fr: "Portion" }, { zh: "服务", en: "Service", fr: "Service" }, { zh: "好评", en: "Praise", fr: "Éloge" }] },
      { key: "content", label: { zh: "内容", en: "Content", fr: "Contenu" }, type: "textarea" },
      { key: "replied", label: { zh: "已回复", en: "Replied", fr: "Répondu" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "差评集中到一处，待回复提醒", en: "All reviews in one inbox, reply reminders", fr: "Tous les avis au même endroit, rappels de réponse" },
      { zh: "问题类别统计，找出共性", en: "Topic breakdown of complaints", fr: "Répartition des plaintes par catégorie" },
    ],
  },
  {
    id: "social",
    category: "marketing",
    icon: "📣",
    ready: true,
    label: { zh: "社交媒体与促销", en: "Social & Promotions", fr: "Réseaux sociaux et promotions" },
    pain: {
      zh: "想推广，但平时没时间写文案、发帖（中英文）",
      en: "Want to promote but no time to write posts.",
      fr: "Vous voulez faire de la promo, mais pas le temps d'écrire les publications.",
    },
    fields: [
      { key: "date", label: { zh: "计划日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "channel", label: { zh: "渠道", en: "Channel", fr: "Canal" }, type: "select", half: true,
        options: [{ zh: "微信", en: "WeChat", fr: "WeChat" }, { zh: "小红书", en: "RED", fr: "RED" }, { zh: "Instagram", en: "Instagram", fr: "Instagram" }, { zh: "Facebook", en: "Facebook", fr: "Facebook" }] },
      { key: "topic", label: { zh: "主题", en: "Topic", fr: "Sujet" }, type: "text", half: true },
      { key: "status", label: { zh: "状态", en: "Status", fr: "Statut" }, type: "select", half: true,
        options: [{ zh: "草稿", en: "Draft", fr: "Brouillon" }, { zh: "待发", en: "Scheduled", fr: "Planifié" }, { zh: "已发", en: "Posted", fr: "Publié" }] },
      { key: "content", label: { zh: "文案", en: "Copy", fr: "Texte" }, type: "textarea" },
    ],
    outputs: [
      { zh: "内容日历 + 一键生成中英文案", en: "Content calendar + AI bilingual copy", fr: "Calendrier de contenu + rédaction bilingue par IA" },
      { zh: "促销活动排期", en: "Promotion scheduling", fr: "Planification des promotions" },
    ],
  },

  // ── Compliance & Equipment ────────────────────────────────────────────
  {
    id: "food-safety",
    category: "compliance",
    icon: "🧊",
    ready: true,
    portal: true,
    label: { zh: "食品安全与清洁记录", en: "Food Safety & Cleaning", fr: "Salubrité et nettoyage" },
    pain: {
      zh: "温度记录、开关店清单分散，检查 / 留档不方便",
      en: "Temp logs & open/close lists scattered; audits painful.",
      fr: "Relevés de température et listes d'ouverture/fermeture éparpillés; inspections pénibles.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "category", label: { zh: "类别", en: "Category", fr: "Catégorie" }, type: "select", half: true,
        options: [{ zh: "温度", en: "Temp", fr: "Température" }, { zh: "开店清单", en: "Open", fr: "Ouverture" }, { zh: "关店清单", en: "Close", fr: "Fermeture" }, { zh: "清洁", en: "Cleaning", fr: "Nettoyage" }, { zh: "其他", en: "Other", fr: "Autre" }] },
      { key: "item", label: { zh: "检查项", en: "Item", fr: "Point de contrôle" }, type: "text", half: true },
      { key: "ok", label: { zh: "是否合格", en: "Pass", fr: "Conforme" }, type: "select", options: yesNo, half: true },
      { key: "value", label: { zh: "读数/结果", en: "Value", fr: "Relevé / résultat" }, type: "text", half: true },
      { key: "by", label: { zh: "记录人", en: "By", fr: "Par" }, type: "text", half: true },
      { key: "note", label: { zh: "备注", en: "Note", fr: "Note" }, type: "text" },
    ],
    outputs: [
      { zh: "可导出的合规台账，应付检查", en: "Exportable compliance log for audits", fr: "Registre de conformité exportable pour les inspections" },
      { zh: "漏检 / 超标提醒", en: "Missed-check & out-of-range alerts", fr: "Alertes de contrôles manqués et hors normes" },
    ],
  },
  {
    id: "equipment",
    category: "compliance",
    icon: "🔧",
    ready: true,
    label: { zh: "设备维护", en: "Equipment Maintenance", fr: "Entretien de l'équipement" },
    pain: {
      zh: "冰箱/冷柜/海鲜池/炉灶坏了影响营业，维护记录不系统",
      en: "Fridge/tank/stove failures hurt sales; no maintenance log.",
      fr: "Pannes de frigo/bassin/cuisinière nuisent aux ventes; aucun registre d'entretien.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date", fr: "Date" }, type: "date", half: true, required: true },
      { key: "equipment", label: { zh: "设备", en: "Equipment", fr: "Équipement" }, type: "text", half: true },
      { key: "issue", label: { zh: "问题/保养", en: "Issue", fr: "Problème / entretien" }, type: "text", half: true },
      { key: "priority", label: { zh: "紧急程度", en: "Priority", fr: "Priorité" }, type: "select", half: true,
        options: [{ zh: "紧急", en: "Urgent", fr: "Urgent" }, { zh: "普通", en: "Normal", fr: "Normal" }] },
      { key: "vendor", label: { zh: "维修方", en: "Vendor", fr: "Réparateur" }, type: "text", half: true },
      { key: "cost", label: { zh: "费用", en: "Cost", fr: "Coût" }, type: "money", half: true },
      { key: "status", label: { zh: "状态", en: "Status", fr: "Statut" }, type: "select", half: true,
        options: [{ zh: "待处理", en: "Open", fr: "À traiter" }, { zh: "处理中", en: "In progress", fr: "En cours" }, { zh: "已完成", en: "Done", fr: "Terminé" }, { zh: "停用", en: "Retired", fr: "Retiré" }] },
      { key: "nextService", label: { zh: "下次保养日期", en: "Next service", fr: "Prochain entretien" }, type: "date", half: true },
      { key: "intervalDays", label: { zh: "保养周期（天）", en: "Interval (days)", fr: "Intervalle (jours)" }, type: "number", half: true },
    ],
    outputs: [
      { zh: "设备维护台账 + 保养到期提醒", en: "Maintenance log + service reminders", fr: "Registre d'entretien + rappels d'échéance" },
      { zh: "维修费用统计", en: "Repair cost totals", fr: "Totaux des coûts de réparation" },
    ],
    amountKey: "cost",
    amountLabel: { zh: "维修费用", en: "Repair cost", fr: "Coût de réparation" },
    amountKind: "money",
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m])
);

/** Modules released to merchants (the rest stay hidden until polished). */
export const READY_MODULES: ModuleDef[] = MODULES.filter((m) => m.ready);

export function isReady(id: string): boolean {
  return !!MODULE_BY_ID[id]?.ready;
}

/** Ready modules in a category. */
export function readyByCategory(catId: string): ModuleDef[] {
  return READY_MODULES.filter((m) => m.category === catId);
}

/** Categories that currently have at least one ready module. */
export function readyCategories(): CategoryDef[] {
  return CATEGORIES.filter((c) => READY_MODULES.some((m) => m.category === c.id));
}

/** Ready categories within a domain (后台 / 前台). */
export function readyCategoriesInDomain(domain: Domain): CategoryDef[] {
  return readyCategories().filter((c) => c.domain === domain);
}

/** Domains that currently have at least one ready category. */
export function readyDomains(): DomainDef[] {
  return DOMAINS.filter((d) => readyCategoriesInDomain(d.id).length > 0);
}

export function modulesByCategory(catId: string): ModuleDef[] {
  return MODULES.filter((m) => m.category === catId);
}
