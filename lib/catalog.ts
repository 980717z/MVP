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
}

export interface CategoryDef {
  id: string;
  label: Bi;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "kitchen", label: { zh: "厨房 · 备货", en: "Kitchen & Prep" } },
  { id: "inventory", label: { zh: "库存 · 采购", en: "Inventory & Purchasing" } },
  { id: "orders", label: { zh: "订单 · 预订", en: "Orders & Reservations" } },
  { id: "finance", label: { zh: "财务 · 对账", en: "Finance & Reconciliation" } },
  { id: "staff", label: { zh: "员工", en: "Staff" } },
  { id: "marketing", label: { zh: "客户 · 营销", en: "Customers & Marketing" } },
  { id: "compliance", label: { zh: "合规 · 设备", en: "Compliance & Equipment" } },
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
    amountLabel: { zh: "今日报废", en: "Waste today" },
    amountKind: "count",
  },
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
    id: "prep-list",
    category: "kitchen",
    icon: "📝",
    label: { zh: "厨房备货 / Prep List", en: "Kitchen Prep List" },
    pain: {
      zh: "每天备料靠经验，忙时不够、闲时浪费",
      en: "Prep runs on gut feel — short when busy, wasted when slow.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "station", label: { zh: "档口", en: "Station" }, type: "select", half: true,
        options: [{ zh: "热菜", en: "Hot" }, { zh: "凉菜", en: "Cold" }, { zh: "海鲜", en: "Seafood" }, { zh: "面点", en: "Dim sum" }] },
      { key: "item", label: { zh: "备料项", en: "Item" }, type: "text", half: true, required: true },
      { key: "qty", label: { zh: "数量", en: "Qty" }, type: "number", half: true },
      { key: "unit", label: { zh: "单位", en: "Unit" }, type: "text", half: true },
      { key: "done", label: { zh: "是否完成", en: "Done" }, type: "select", options: yesNo, half: true },
    ],
    outputs: [
      { zh: "每日 prep 清单，自动按档口分组", en: "Daily prep list grouped by station" },
      { zh: "完成率追踪", en: "Completion tracking" },
    ],
  },
  {
    id: "dish-margin",
    category: "kitchen",
    icon: "📊",
    label: { zh: "菜品销量与毛利", en: "Dish Sales & Margin" },
    pain: {
      zh: "不知道哪些菜真赚钱、哪些占时间又不赚",
      en: "No idea which dishes actually make money.",
    },
    fields: [
      { key: "dish", label: { zh: "菜名", en: "Dish" }, type: "text", half: true, required: true },
      { key: "price", label: { zh: "售价", en: "Price" }, type: "money", half: true },
      { key: "cost", label: { zh: "成本", en: "Cost" }, type: "money", half: true },
      { key: "soldMonth", label: { zh: "月销量", en: "Sold / month" }, type: "number", suffix: "份", half: true },
    ],
    outputs: [
      { zh: "毛利率排行：明星菜 / 拖后腿菜", en: "Margin ranking: stars vs. laggards" },
      { zh: "贡献毛利 = (售价−成本) × 销量", en: "Profit contribution per dish" },
    ],
    amountKey: "price",
    amountLabel: { zh: "在售菜品", en: "Menu items" },
    amountKind: "count",
  },

  // ── Inventory & Purchasing ────────────────────────────────────────────
  {
    id: "seafood-stock",
    category: "inventory",
    icon: "🦞",
    label: { zh: "海鲜库存与损耗", en: "Seafood Stock & Loss" },
    pain: {
      zh: "活海鲜/冰鲜/冷冻的进出、死亡报废、成本不好算",
      en: "Live/chilled/frozen in-out, die-off, hard to cost.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "item", label: { zh: "品种", en: "Item" }, type: "text", half: true, required: true },
      { key: "type", label: { zh: "类型", en: "Type" }, type: "select", half: true,
        options: [{ zh: "活鲜", en: "Live" }, { zh: "冰鲜", en: "Chilled" }, { zh: "冷冻", en: "Frozen" }] },
      { key: "inQty", label: { zh: "进货", en: "In" }, type: "number", suffix: "kg", half: true },
      { key: "deadQty", label: { zh: "死亡/报废", en: "Loss" }, type: "number", suffix: "kg", half: true },
      { key: "onHand", label: { zh: "现存", en: "On hand" }, type: "number", suffix: "kg", half: true },
      { key: "unitCost", label: { zh: "进价", en: "Unit cost" }, type: "money", suffix: "/kg", half: true },
    ],
    outputs: [
      { zh: "损耗率与损耗金额", en: "Loss rate & dollar value" },
      { zh: "低库存预警", en: "Low-stock alerts" },
    ],
    amountKey: "deadQty",
    amountLabel: { zh: "今日损耗", en: "Loss today" },
    amountKind: "count",
  },
  {
    id: "purchasing",
    category: "inventory",
    icon: "🚚",
    label: { zh: "采购与供应商比价", en: "Purchasing & Suppliers" },
    pain: {
      zh: "进货靠经验，价格变化、到货数量不好核对",
      en: "Buying on memory; prices drift, deliveries hard to check.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "supplier", label: { zh: "供应商", en: "Supplier" }, type: "text", half: true, required: true },
      { key: "item", label: { zh: "品项", en: "Item" }, type: "text", half: true },
      { key: "qty", label: { zh: "数量", en: "Qty" }, type: "number", half: true },
      { key: "unitPrice", label: { zh: "单价", en: "Unit price" }, type: "money", half: true },
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
  },
  {
    id: "menu-price",
    category: "inventory",
    icon: "📋",
    label: { zh: "菜单与价格管理", en: "Menu & Price Management" },
    pain: {
      zh: "菜多，价格变动、平台价不同步、sold out 难追",
      en: "Many items; price changes & platform prices out of sync.",
    },
    fields: [
      { key: "dish", label: { zh: "菜名", en: "Dish" }, type: "text", half: true, required: true },
      { key: "dineIn", label: { zh: "堂食价", en: "Dine-in" }, type: "money", half: true },
      { key: "delivery", label: { zh: "外卖价", en: "Delivery" }, type: "money", half: true },
      { key: "status", label: { zh: "状态", en: "Status" }, type: "select", half: true,
        options: [{ zh: "在售", en: "On sale" }, { zh: "沽清", en: "Sold out" }, { zh: "下架", en: "Off menu" }] },
    ],
    outputs: [
      { zh: "一处改价，堂食/外卖一致", en: "One edit, prices consistent everywhere" },
      { zh: "沽清状态一目了然", en: "Sold-out status at a glance" },
    ],
  },

  // ── Orders & Reservations ─────────────────────────────────────────────
  {
    id: "phone-orders",
    category: "orders",
    icon: "📞",
    label: { zh: "电话 / 微信订单", en: "Phone / WeChat Orders" },
    pain: {
      zh: "纸笔接单容易漏，常客资料没沉淀",
      en: "Pen-and-paper orders get missed; regulars never recorded.",
    },
    fields: [
      { key: "time", label: { zh: "时间", en: "Time" }, type: "time", half: true, required: true },
      { key: "customer", label: { zh: "客户", en: "Customer" }, type: "text", half: true },
      { key: "phone", label: { zh: "电话", en: "Phone" }, type: "text", half: true },
      { key: "items", label: { zh: "菜品", en: "Items" }, type: "textarea" },
      { key: "amount", label: { zh: "金额", en: "Amount" }, type: "money", half: true },
      { key: "channel", label: { zh: "渠道", en: "Channel" }, type: "select", half: true,
        options: [{ zh: "电话", en: "Phone" }, { zh: "微信", en: "WeChat" }] },
      { key: "status", label: { zh: "状态", en: "Status" }, type: "select", half: true,
        options: [{ zh: "待出餐", en: "Pending" }, { zh: "已完成", en: "Done" }, { zh: "已取消", en: "Cancelled" }] },
    ],
    outputs: [
      { zh: "订单不漏单，自动建客户档案", en: "No missed orders; auto customer profiles" },
      { zh: "汇入每日收入", en: "Rolls into daily revenue" },
    ],
    amountKey: "amount",
    amountLabel: { zh: "电话单收入", en: "Phone order revenue" },
    amountKind: "money",
  },
  {
    id: "delivery-agg",
    category: "orders",
    icon: "🛵",
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
      { zh: "实收对账，看清平台扣了多少", en: "See exactly what each platform took" },
    ],
    amountKey: "net",
    amountLabel: { zh: "外卖实收", en: "Delivery net" },
    amountKind: "money",
  },
  {
    id: "group-booking",
    category: "orders",
    icon: "🎉",
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
      { key: "menu", label: { zh: "菜单/要求", en: "Menu / notes" }, type: "textarea" },
    ],
    outputs: [
      { zh: "预订日历 + 订金台账", en: "Booking calendar + deposit ledger" },
      { zh: "备货与到店提醒", en: "Prep & arrival reminders" },
    ],
    amountKey: "deposit",
    amountLabel: { zh: "已收订金", en: "Deposits held" },
    amountKind: "money",
  },

  // ── Finance ───────────────────────────────────────────────────────────
  {
    id: "daily-close",
    category: "finance",
    icon: "💰",
    label: { zh: "每日结账与收入", en: "Daily Close & Revenue" },
    pain: {
      zh: "堂食/外卖/现金/刷卡对不上；平台扣了多少看不清",
      en: "Dine-in/delivery/cash/card don't reconcile.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "dineIn", label: { zh: "堂食", en: "Dine-in" }, type: "money", half: true },
      { key: "delivery", label: { zh: "外卖", en: "Delivery" }, type: "money", half: true },
      { key: "cash", label: { zh: "现金", en: "Cash" }, type: "money", half: true },
      { key: "card", label: { zh: "刷卡", en: "Card" }, type: "money", half: true },
      { key: "expenses", label: { zh: "当日支出", en: "Expenses" }, type: "money", half: true },
      { key: "net", label: { zh: "净收入", en: "Net" }, type: "money", half: true },
    ],
    outputs: [
      { zh: "每日收入汇总 + 对账差额", en: "Daily revenue + reconciliation gap" },
      { zh: "周/月趋势", en: "Weekly / monthly trends" },
    ],
    amountKey: "net",
    amountLabel: { zh: "今日净收入", en: "Net today" },
    amountKind: "money",
  },

  // ── Staff ─────────────────────────────────────────────────────────────
  {
    id: "scheduling",
    category: "staff",
    icon: "👥",
    label: { zh: "员工排班与工时", en: "Scheduling & Hours" },
    pain: {
      zh: "排班、换班、请假、工时 / 工资容易乱",
      en: "Shifts, swaps, leave, hours & pay get tangled.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "staff", label: { zh: "员工", en: "Staff" }, type: "text", half: true, required: true },
      { key: "role", label: { zh: "岗位", en: "Role" }, type: "select", half: true,
        options: [{ zh: "厨房", en: "Kitchen" }, { zh: "楼面", en: "Floor" }, { zh: "收银", en: "Cashier" }, { zh: "外卖", en: "Delivery" }] },
      { key: "start", label: { zh: "上班", en: "Start" }, type: "time", half: true },
      { key: "end", label: { zh: "下班", en: "End" }, type: "time", half: true },
      { key: "hours", label: { zh: "工时", en: "Hours" }, type: "number", suffix: "h", half: true },
      { key: "rate", label: { zh: "时薪", en: "Rate" }, type: "money", suffix: "/h", half: true },
    ],
    outputs: [
      { zh: "周排班表 + 工时统计", en: "Weekly roster + hour totals" },
      { zh: "工资预估", en: "Payroll estimate" },
    ],
    amountKey: "hours",
    amountLabel: { zh: "今日工时", en: "Hours today" },
    amountKind: "count",
  },

  // ── Customers & Marketing ─────────────────────────────────────────────
  {
    id: "members",
    category: "marketing",
    icon: "⭐",
    label: { zh: "熟客 / 会员跟进", en: "Members & Regulars" },
    pain: {
      zh: "没系统沉淀，节日生日提醒、微信回访做不起来",
      en: "No CRM — birthday/holiday follow-ups never happen.",
    },
    fields: [
      { key: "name", label: { zh: "姓名", en: "Name" }, type: "text", half: true, required: true },
      { key: "phone", label: { zh: "电话", en: "Phone" }, type: "text", half: true },
      { key: "birthday", label: { zh: "生日", en: "Birthday" }, type: "date", half: true },
      { key: "visits", label: { zh: "到店次数", en: "Visits" }, type: "number", half: true },
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
    label: { zh: "客户评价与差评", en: "Reviews & Complaints" },
    pain: {
      zh: "Google / 外卖差评分散，回复慢、不知道问题集中在哪",
      en: "Reviews scattered; slow replies, unclear what's wrong.",
    },
    fields: [
      { key: "date", label: { zh: "日期", en: "Date" }, type: "date", half: true, required: true },
      { key: "source", label: { zh: "来源", en: "Source" }, type: "select", half: true,
        options: [{ zh: "Google", en: "Google" }, { zh: "DoorDash", en: "DoorDash" }, { zh: "UberEats", en: "UberEats" }, { zh: "大众点评", en: "Dianping" }] },
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

export function modulesByCategory(catId: string): ModuleDef[] {
  return MODULES.filter((m) => m.category === catId);
}
