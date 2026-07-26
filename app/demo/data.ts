// Demo navigation + shared sample data. All numbers are illustrative.

export const NAV = [
  { href: "/demo", label: { zh: "概览", en: "Overview", fr: "Aperçu" }, icon: "▦" },
  { href: "/demo/orders", label: { zh: "订单", en: "Orders", fr: "Commandes" }, icon: "🧾" },
  { href: "/demo/inventory", label: { zh: "库存", en: "Inventory", fr: "Inventaire" }, icon: "📦" },
  { href: "/demo/suppliers", label: { zh: "供应商", en: "Suppliers", fr: "Fournisseurs" }, icon: "🚚" },
  { href: "/demo/shifts", label: { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" }, icon: "🕒" },
  { href: "/demo/reconcile", label: { zh: "对账", en: "Reconcile", fr: "Rapprochement" }, icon: "💳" },
  { href: "/demo/members", label: { zh: "会员", en: "Members", fr: "Membres" }, icon: "👥" },
  { href: "/demo/reports", label: { zh: "报表", en: "Reports", fr: "Rapports" }, icon: "📈" },
  { href: "/demo/settings", label: { zh: "设置", en: "Settings", fr: "Paramètres" }, icon: "⚙️" },
];

// Fictional demo shop — never a real merchant's name (no written authorization).
export const SHOP = {
  name: "Harvest Seafood House · 丰收海鲜酒家",
  address: { zh: "多伦多 唐人街", en: "Chinatown, Toronto, ON", fr: "Quartier chinois, Toronto (ON)" },
};
