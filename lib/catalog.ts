// ─────────────────────────────────────────────────────────────────────────
//  FEATURE CATALOG — the single source of truth for the whole product.
//
//  Every item on the paper checklist ("可以帮您省心的地方") maps to one
//  module here.  A module declares WHAT data the merchant records (input
//  fields) and WHAT the system gives back (outputs / KPIs).  The onboarding
//  checklist, the sidebar, the dashboard and every data-entry page are all
//  generated from this file — pick modules → get a back-office.
// ─────────────────────────────────────────────────────────────────────────

export type Bi = { zh: string; en: string };

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
  suffix?: string;
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
    label: { zh: "后台", en: "Back office" },
    blurb: { zh: "商家自己用的管理工具", en: "Tools the merchant uses internally" },
  },
  {
    id: "frontend",
    label: { zh: "前台", en: "Front of house" },
    blurb: { zh: "面向顾客的功能", en: "Customer-facing features" },
  },
];

export interface CategoryDef {
  id: string;
  label: Bi;
  domain: Domain;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "kitchen", label: { zh: "厨房 · 备货", en: "Kitchen & Prep" }, domain: "backoffice" },
  { id: "inventory", label: { zh: "库存 · 采购", en: "Inventory & Purchasing" }, domain: "backoffice" },
  { id: "orders", label: { zh: "订单 · 预订", en: "Orders & Reservations" }, domain: "backoffice" },
  { id: "finance", label: { zh: "财务 · 对账", en: "Finance & Reconciliation" }, domain: "backoffice" },
  { id: "staff", label: { zh: "员工", en: "Staff" }, domain: "backoffice" },
  { id: "marketing", label: { zh: "客户 · 营销", en: "Customers & Marketing" }, domain: "backoffice" },
  { id: "compliance", label: { zh: "合规 · 设备", en: "Compliance & Equipment" }, domain: "backoffice" },
  { id: "storefront", label: { zh: "前台 · 顾客", en: "Storefront" }, domain: "frontend" },
];

const yesNo: Bi[] = [
  { zh: "是", en: "Yes" },
  { zh: "否", en: "No" },
];

export const MODULES: ModuleDef[] = [
  // ── Kitchen & Prep ────────────────────────────────────────────────────
  {
    id: "prep-signature",
    category: "kitchen",
    icon: "🍲",
    ready: true,
    label: { zh: "招牌备货（气锅鸡等）", en: "Signature Prep" },
    pain: {
      zh: "每天备多少合适？卖断可惜、备多浪费",
      en: "How much to prep? Sell-outs hurt, leftovers waste.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "dish", label: { zh: "招牌菜", en: "Dish" }, type: "text", half: true, required: true },
      { key: "prepped", label: { zh: "备货份数", en: "Prepped" }, type: "number", suffix: "份", half: true },
      { key: "sold", label: { zh: "实际售出", en: "Sold" }, type: "number", suffix: "份", half: true },
      { key: "leftover", label: { zh: "剩余/报废", en: "Leftover" }, type: "number", suffix: "份", half: true },
      { key: "suggest", label: { zh: "明日建议", en: "Suggested tomorrow" }, type: "number", suffix: "份", half: true },
      { key: "note", label: { zh: "备注", en: "Note" }, type: "textarea" },
    ],
    outputs: [
      { zh: "按近 7 天销量给出明日备货建议", en: "Suggests tomorrow's prep from 7-day sales" },
      { zh: "卖断 / 浪费提醒", en: "Sell-out & waste alerts" },
    ],
    amountKey: "leftover",
    amountLabel: { zh: "报废", en: "Waste" },
    amountKind: "count",
  },
  // ── Storefront (前台 · 面向顾客) ──────────────────────────────────────
  {
    id: "qr-menu",
    category: "storefront",
    icon: "📱",
    ready: true,
    portal: true,
    label: { zh: "二维码菜单", en: "QR Code Menu" },
    pain: {
      zh: "顾客扫码即看菜单，免印刷、改价即时同步、中英文随时切换",
      en: "Guests scan to view the menu — no printing, instant price sync, bilingual.",
    },
    fields: [],
    outputs: [
      { zh: "一张二维码，顾客扫码看到你的电子菜单", en: "One QR code; guests scan to see your live menu" },
      { zh: "菜单设置里改价，扫码页实时更新", en: "Edit prices in Menu Settings, the public page updates instantly" },
    ],
  },

  // ── Kitchen & Prep ────────────────────────────────────────────────────
  {
    id: "menu-generator",
    category: "kitchen",
    icon: "🍽️",
    ready: true,
    portal: true,
    label: { zh: "菜单设置", en: "Menu Settings" },
    pain: {
      zh: "想做一份漂亮的中英文菜单，但排版、翻译、改价都很费时间",
      en: "Want a nice bilingual menu, but layout, translation and pricing eat hours.",
    },
    fields: [],
    outputs: [
      { zh: "录入菜品，一键生成中英文菜单", en: "Enter dishes, generate a bilingual menu" },
      { zh: "多种模板与风格，可导出打印 / 外卖平台", en: "Templates & styles, export for print or delivery apps" },
    ],
  },
  {
    id: "dish-margin",
    category: "kitchen",
    icon: "📊",
    ready: true,
    label: { zh: "菜品销量", en: "Dish Sales" },
    pain: {
      zh: "不知道哪些菜卖得好、哪些卖不动",
      en: "No idea which dishes sell well.",
    },
    fields: [
      { key: "dish", label: { zh: "菜名", en: "Dish" }, type: "text", half: true, required: true },
      { key: "price", label: { zh: "售价", en: "Price" }, type: "money", half: true, unit: true },
      { key: "soldMonth", label: { zh: "月销量", en: "Sold / month" }, type: "number", suffix: "份", half: true },
      { key: "revenue", label: { zh: "销售额", en: "Sales" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "销量排行：哪些菜最受欢迎", en: "Sales ranking: most popular dishes" },
      { zh: "完成的订单自动累加销量", en: "Completed orders auto-add sales" },
    ],
    amountKey: "revenue",
    amountLabel: { zh: "销售额（税前）", en: "Sales (pre-tax)" },
    amountKind: "money",
  },

  // ── Inventory & Purchasing ────────────────────────────────────────────
  {
    id: "stock-loss",
    category: "inventory",
    icon: "📦",
    ready: true,
    label: { zh: "库存与损耗", en: "Stock & Loss" },
    pain: {
      zh: "食材进出、报废损耗、成本不好算",
      en: "Inventory in-out, spoilage, hard to cost.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "item", label: { zh: "品种", en: "Item" }, type: "text", half: true, required: true },
      { key: "type", label: { zh: "类型", en: "Type" }, type: "select", half: true,
        options: [{ zh: "干货", en: "Dry goods" }, { zh: "蔬菜", en: "Vegetables" }, { zh: "肉类", en: "Meat" }, { zh: "海鲜", en: "Seafood" }, { zh: "冷冻", en: "Frozen" }, { zh: "调料", en: "Seasoning" }] },
      { key: "inQty", label: { zh: "进货", en: "In" }, type: "number", suffix: "kg", half: true },
      { key: "unitCost", label: { zh: "成本单价", en: "Unit cost" }, type: "money", suffix: "/kg", half: true, unit: true },
      { key: "scrapQty", label: { zh: "报废", en: "Scrap" }, type: "number", suffix: "kg", half: true },
      { key: "scrapValue", label: { zh: "报废价值", en: "Scrap value" }, type: "money", half: true },
      { key: "lossQty", label: { zh: "消耗", en: "Usage" }, type: "number", suffix: "kg", half: true },
      { key: "lossValue", label: { zh: "消耗价值", en: "Usage value" }, type: "money", half: true },
      { key: "onHand", label: { zh: "现存", en: "On hand" }, type: "number", suffix: "kg", half: true },
    ],
    outputs: [
      { zh: "报废 + 损耗金额（FIFO 先进先出计价）", en: "Scrap + loss cost (FIFO)" },
      { zh: "进货数量与成本从采购自动同步", en: "In-qty & cost auto-synced from purchasing" },
      { zh: "低库存预警", en: "Low-stock alerts" },
    ],
    amountKey: "lossQty",
    amountLabel: { zh: "今日消耗", en: "Usage today" },
    amountKind: "count",
  },
  {
    id: "purchasing",
    category: "inventory",
    icon: "🚚",
    ready: true,
    label: { zh: "采购与供应商比价", en: "Purchasing & Suppliers" },
    pain: {
      zh: "进货靠经验，价格变化、到货数量不好核对",
      en: "Buying on memory; prices drift, deliveries hard to check.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "supplier", label: { zh: "供应商", en: "Supplier" }, type: "text", half: true, required: true },
      { key: "item", label: { zh: "品种", en: "Item" }, type: "text", half: true },
      { key: "itemType", label: { zh: "类型", en: "Type" }, type: "select", half: true,
        options: [{ zh: "干货", en: "Dry goods" }, { zh: "蔬菜", en: "Vegetables" }, { zh: "肉类", en: "Meat" }, { zh: "海鲜", en: "Seafood" }, { zh: "冷冻", en: "Frozen" }, { zh: "调料", en: "Seasoning" }, { zh: "酒水", en: "Beverages" }, { zh: "其他", en: "Other" }] },
      { key: "qty", label: { zh: "数量", en: "Qty" }, type: "number", half: true },
      { key: "unitPrice", label: { zh: "单价", en: "Unit price" }, type: "money", half: true, unit: true },
      { key: "total", label: { zh: "金额", en: "Total" }, type: "money", half: true },
      { key: "received", label: { zh: "到货核对", en: "Received OK" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "同一品项的供应商比价", en: "Price comparison across suppliers" },
      { zh: "采购支出汇总", en: "Purchasing spend totals" },
    ],
    amountKey: "total",
    amountLabel: { zh: "采购支出", en: "Purchasing spend" },
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
    label: { zh: "在线点餐订单", en: "Online Orders" },
    pain: {
      zh: "顾客扫码下的单，集中一处看，标记出餐进度",
      en: "All QR-menu orders in one place, track prep status.",
    },
    fields: [],
    outputs: [
      { zh: "实时收到扫码菜单的订单", en: "Live orders from the QR menu" },
      { zh: "新单 / 备餐 / 完成 状态管理", en: "New / preparing / done status" },
    ],
  },
  {
    id: "delivery-agg",
    category: "orders",
    icon: "🛵",
    ready: true,
    label: { zh: "外卖平台订单汇总", en: "Delivery Platform Roll-up" },
    pain: {
      zh: "DoorDash / UberEats / 熊猫 / 饭团 平台太多，订单和收入不好统一看",
      en: "Too many platforms — orders & income hard to see together.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "platform", label: { zh: "平台", en: "Platform" }, type: "select", half: true,
        options: [{ zh: "DoorDash", en: "DoorDash" }, { zh: "UberEats", en: "UberEats" }, { zh: "熊猫", en: "HungryPanda" }, { zh: "饭团", en: "Fantuan" }] },
      { key: "orders", label: { zh: "订单数", en: "Orders" }, type: "number", half: true },
      { key: "gross", label: { zh: "营业额", en: "Gross" }, type: "money", half: true },
      { key: "commission", label: { zh: "平台抽成", en: "Commission" }, type: "money", half: true },
      { key: "net", label: { zh: "实收", en: "Net" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "各平台订单/收入/抽成一张表", en: "All platforms in one table" },
      { zh: "实收对账（实收 = 营业额 − 抽成），看清平台扣了多少", en: "Net = gross − commission; see exactly what each platform took" },
    ],
    amountKey: "net",
    amountLabel: { zh: "外卖实收", en: "Delivery net" },
    amountKind: "money",
    computed: [{ target: "net", formula: "subtract", fields: ["gross", "-commission"] }],
  },
  {
    id: "group-booking",
    category: "orders",
    icon: "🎉",
    ready: true,
    label: { zh: "团餐 / 大桌预订与订金", en: "Group Bookings & Deposits" },
    pain: {
      zh: "大单靠人记，订金、菜单、备货容易乱",
      en: "Big bookings in someone's head; deposits & menus get messy.",
    },
    fields: [
      { key: "date", label: { zh: "用餐日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "customer", label: { zh: "客户", en: "Customer" }, type: "text", half: true, required: true },
      { key: "phone", label: { zh: "电话", en: "Phone" }, type: "text", half: true },
      { key: "guests", label: { zh: "人数", en: "Guests" }, type: "number", half: true },
      { key: "tables", label: { zh: "桌数", en: "Tables" }, type: "number", half: true },
      { key: "deposit", label: { zh: "订金", en: "Deposit" }, type: "money", half: true },
      { key: "total", label: { zh: "预估总额", en: "Est. total" }, type: "money", half: true },
      { key: "balance", label: { zh: "待收尾款", en: "Balance due" }, type: "money", half: true },
      { key: "tips", label: { zh: "小费", en: "Tips" }, type: "money", half: true },
      { key: "menu", label: { zh: "菜单/要求", en: "Menu / notes" }, type: "textarea" },
    ],
    outputs: [
      { zh: "预订台账 + 待收尾款（预估总额 − 订金）", en: "Booking ledger + balance due (est. total − deposit)" },
      { zh: "近3天到店提醒", en: "Arrival reminders for the next 3 days" },
    ],
    amountKey: "deposit",
    amountLabel: { zh: "已收订金", en: "Deposits held" },
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
    label: { zh: "销售流水", en: "Sales" },
    pain: {
      zh: "现金/扫码/Clover 的销售和税额对不上、报税难",
      en: "Cash, QR and Clover sales don't reconcile; HST is hard to file.",
    },
    fields: [],
    outputs: [
      { zh: "每笔销售自动算税（安省 HST 13%）", en: "Per-sale tax auto-calculated (Ontario HST 13%)" },
      { zh: "GST/PST 收取额汇总，报税一目了然", en: "GST/PST collected totals for HST remittance" },
    ],
    amountKey: "subtotal",
    amountLabel: { zh: "销售额（税前）", en: "Sales (pre-tax)" },
    amountKind: "money",
  },
  {
    id: "daily-close",
    category: "finance",
    icon: "💰",
    ready: true,
    label: { zh: "每日结账与收入", en: "Daily Close & Revenue" },
    pain: {
      zh: "堂食/外卖对不上；平台扣了多少看不清",
      en: "Dine-in/delivery don't reconcile.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "dineIn", label: { zh: "堂食", en: "Dine-in" }, type: "money", half: true },
      { key: "delivery", label: { zh: "外卖", en: "Delivery" }, type: "money", half: true },
      { key: "tips", label: { zh: "小费", en: "Tips" }, type: "money", half: true },
      { key: "expenses", label: { zh: "当日支出", en: "Expenses" }, type: "money", half: true },
      { key: "net", label: { zh: "净收入", en: "Net" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "每日收入汇总", en: "Daily revenue summary" },
      { zh: "净收入 = 堂食 + 外卖 − 小费 − 当日支出", en: "Net = dine-in + delivery − tips − expenses" },
    ],
    amountKey: "net",
    amountLabel: { zh: "净收入", en: "Net" },
    amountKind: "money",
    computed: [
      { target: "net", formula: "subtract", fields: ["dineIn", "delivery", "-tips", "-expenses"] },
    ],
  },

  // ── Staff ─────────────────────────────────────────────────────────────
  {
    id: "scheduling",
    category: "staff",
    icon: "👥",
    ready: true,
    label: { zh: "员工排班与工时", en: "Scheduling & Hours" },
    pain: {
      zh: "排班、换班、请假、工时 / 工资容易乱",
      en: "Shifts, swaps, leave, hours & pay get tangled.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "staff", label: { zh: "员工", en: "Staff" }, type: "text", half: true, required: true },
      { key: "role", label: { zh: "岗位", en: "Role" }, type: "text", half: true },
      { key: "attendance", label: { zh: "出勤状态", en: "Attendance" }, type: "select", half: true,
        options: [{ zh: "正常", en: "Present" }, { zh: "请假", en: "Leave" }, { zh: "休息", en: "Day off" }, { zh: "迟到", en: "Late" }] },
      { key: "start", label: { zh: "上班", en: "Start" }, type: "time", half: true },
      { key: "end", label: { zh: "下班", en: "End" }, type: "time", half: true },
      { key: "hours", label: { zh: "工时", en: "Hours" }, type: "number", suffix: "h", half: true },
      { key: "rate", label: { zh: "时薪", en: "Rate" }, type: "money", suffix: "/h", half: true, unit: true },
      { key: "pay", label: { zh: "工资", en: "Pay" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "周排班表 + 工时统计", en: "Weekly roster + hour totals" },
      { zh: "工资预估 = 工时 × 时薪", en: "Payroll estimate = hours × rate" },
    ],
    amountKey: "pay",
    amountLabel: { zh: "工资", en: "Pay" },
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
    label: { zh: "会员", en: "Members" },
    pain: {
      zh: "没系统沉淀，节日生日提醒、微信回访做不起来",
      en: "No CRM — birthday/holiday follow-ups never happen.",
    },
    fields: [
      { key: "phone", label: { zh: "电话", en: "Phone" }, type: "text", half: true, required: true },
      { key: "name", label: { zh: "姓名", en: "Name" }, type: "text", half: true },
      { key: "birthday", label: { zh: "生日", en: "Birthday" }, type: "date", half: true },
      { key: "visits", label: { zh: "订单次数", en: "Orders" }, type: "number", half: true },
      { key: "spend", label: { zh: "累计消费", en: "Lifetime spend" }, type: "money", half: true },
      { key: "tier", label: { zh: "等级", en: "Tier" }, type: "select", half: true,
        options: [{ zh: "普通", en: "Regular" }, { zh: "银卡", en: "Silver" }, { zh: "金卡", en: "Gold" }] },
      { key: "note", label: { zh: "偏好/备注", en: "Notes" }, type: "textarea" },
    ],
    outputs: [
      { zh: "会员档案 + 生日/节日提醒", en: "Member profiles + birthday reminders" },
      { zh: "消费分层，找出高价值熟客", en: "Spend tiers to find VIPs" },
    ],
    amountKey: "spend",
    amountLabel: { zh: "会员累计消费", en: "Member lifetime spend" },
    amountKind: "money",
  },
  {
    id: "reviews",
    category: "marketing",
    icon: "💬",
    ready: true,
    label: { zh: "改进意见", en: "Improvement Feedback" },
    pain: {
      zh: "Google / 外卖差评分散，回复慢、不知道问题集中在哪",
      en: "Reviews scattered; slow replies, unclear what's wrong.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "source", label: { zh: "来源", en: "Source" }, type: "select", half: true,
        options: [{ zh: "Google", en: "Google" }, { zh: "Yelp", en: "Yelp" }, { zh: "DoorDash", en: "DoorDash" }, { zh: "UberEats", en: "UberEats" }, { zh: "大众点评", en: "Dianping" }] },
      { key: "rating", label: { zh: "评分", en: "Rating" }, type: "number", suffix: "★", half: true },
      { key: "topic", label: { zh: "问题类别", en: "Topic" }, type: "select", half: true,
        options: [{ zh: "出餐慢", en: "Slow" }, { zh: "口味", en: "Taste" }, { zh: "份量", en: "Portion" }, { zh: "服务", en: "Service" }, { zh: "好评", en: "Praise" }] },
      { key: "content", label: { zh: "内容", en: "Content" }, type: "textarea" },
      { key: "replied", label: { zh: "已回复", en: "Replied" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "差评集中到一处，待回复提醒", en: "All reviews in one inbox, reply reminders" },
      { zh: "问题类别统计，找出共性", en: "Topic breakdown of complaints" },
    ],
  },
  {
    id: "social",
    category: "marketing",
    icon: "📣",
    ready: true,
    label: { zh: "社交媒体与促销", en: "Social & Promotions" },
    pain: {
      zh: "想推广，但平时没时间写文案、发帖（中英文）",
      en: "Want to promote but no time to write posts.",
    },
    fields: [
      { key: "date", label: { zh: "计划日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "channel", label: { zh: "渠道", en: "Channel" }, type: "select", half: true,
        options: [{ zh: "微信", en: "WeChat" }, { zh: "小红书", en: "RED" }, { zh: "Instagram", en: "Instagram" }, { zh: "Facebook", en: "Facebook" }] },
      { key: "topic", label: { zh: "主题", en: "Topic" }, type: "text", half: true },
      { key: "status", label: { zh: "状态", en: "Status" }, type: "select", half: true,
        options: [{ zh: "草稿", en: "Draft" }, { zh: "待发", en: "Scheduled" }, { zh: "已发", en: "Posted" }] },
      { key: "content", label: { zh: "文案", en: "Copy" }, type: "textarea" },
    ],
    outputs: [
      { zh: "内容日历 + 一键生成中英文案", en: "Content calendar + AI bilingual copy" },
      { zh: "促销活动排期", en: "Promotion scheduling" },
    ],
  },

  // ── Compliance & Equipment ────────────────────────────────────────────
  {
    id: "food-safety",
    category: "compliance",
    icon: "🧊",
    ready: true,
    label: { zh: "食品安全与清洁记录", en: "Food Safety & Cleaning" },
    pain: {
      zh: "温度记录、开关店清单分散，检查 / 留档不方便",
      en: "Temp logs & open/close lists scattered; audits painful.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "type", label: { zh: "记录类型", en: "Type" }, type: "select", half: true,
        options: [{ zh: "温度", en: "Temp" }, { zh: "开店清单", en: "Open" }, { zh: "关店清单", en: "Close" }, { zh: "清洁", en: "Cleaning" }] },
      { key: "item", label: { zh: "项目", en: "Item" }, type: "text", half: true },
      { key: "value", label: { zh: "读数/结果", en: "Value" }, type: "text", half: true },
      { key: "by", label: { zh: "记录人", en: "By" }, type: "text", half: true },
      { key: "ok", label: { zh: "是否合格", en: "Pass" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "可导出的合规台账，应付检查", en: "Exportable compliance log for audits" },
      { zh: "漏检 / 超标提醒", en: "Missed-check & out-of-range alerts" },
    ],
  },
  {
    id: "equipment",
    category: "compliance",
    icon: "🔧",
    ready: true,
    label: { zh: "设备维护", en: "Equipment Maintenance" },
    pain: {
      zh: "冰箱/冷柜/海鲜池/炉灶坏了影响营业，维护记录不系统",
      en: "Fridge/tank/stove failures hurt sales; no maintenance log.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "equipment", label: { zh: "设备", en: "Equipment" }, type: "select", half: true,
        options: [{ zh: "冰箱", en: "Fridge" }, { zh: "冷柜", en: "Freezer" }, { zh: "海鲜池", en: "Tank" }, { zh: "炉灶", en: "Stove" }, { zh: "其他", en: "Other" }] },
      { key: "issue", label: { zh: "问题/保养", en: "Issue" }, type: "text", half: true },
      { key: "vendor", label: { zh: "维修方", en: "Vendor" }, type: "text", half: true },
      { key: "cost", label: { zh: "费用", en: "Cost" }, type: "money", half: true },
      { key: "status", label: { zh: "状态", en: "Status" }, type: "select", half: true,
        options: [{ zh: "待处理", en: "Open" }, { zh: "处理中", en: "In progress" }, { zh: "已完成", en: "Done" }] },
      { key: "nextService", label: { zh: "下次保养日期", en: "Next service" }, type: "date", half: true },
    ],
    outputs: [
      { zh: "设备维护台账 + 保养到期提醒", en: "Maintenance log + service reminders" },
      { zh: "维修费用统计", en: "Repair cost totals" },
    ],
    amountKey: "cost",
    amountLabel: { zh: "维修费用", en: "Repair cost" },
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
