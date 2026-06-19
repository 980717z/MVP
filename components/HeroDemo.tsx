"use client";

import { useState, type ReactNode } from "react";
import { useLang, type Dict } from "@/app/i18n";

const NAV: { id: string; icon: string; label: Dict }[] = [
  { id: "overview", icon: "▦", label: { zh: "概览", en: "Overview", fr: "Aperçu" } },
  { id: "orders", icon: "🧾", label: { zh: "订单", en: "Orders", fr: "Commandes" } },
  { id: "inventory", icon: "📦", label: { zh: "库存", en: "Inventory", fr: "Inventaire" } },
  { id: "suppliers", icon: "🚚", label: { zh: "供应商", en: "Suppliers", fr: "Fournisseurs" } },
  { id: "shifts", icon: "🕒", label: { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" } },
  { id: "reconcile", icon: "💳", label: { zh: "对账", en: "Reconcile", fr: "Rapprochement" } },
  { id: "members", icon: "👥", label: { zh: "会员", en: "Members", fr: "Membres" } },
  { id: "reports", icon: "📈", label: { zh: "报表", en: "Reports", fr: "Rapports" } },
  { id: "settings", icon: "⚙️", label: { zh: "设置", en: "Settings", fr: "Paramètres" } },
];

const TAG: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-sky-50 text-sky-700",
};
function Tag({ tone = "slate", children }: { tone?: keyof typeof TAG | string; children: ReactNode }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${TAG[tone] ?? TAG.slate}`}>{children}</span>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-100 p-3">
      <div className="text-[11px] font-medium text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function MiniTable({ head, rows, right = [] }: { head: ReactNode[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <table className="mt-2 w-full text-[10px]">
      <thead>
        <tr className="text-left text-slate-400">
          {head.map((h, i) => (
            <th key={i} className={`pb-1 font-medium ${right.includes(i) ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-t border-slate-50">
            {r.map((c, ci) => (
              <td key={ci} className={`py-1 align-middle text-slate-600 ${right.includes(ci) ? "text-right" : ""}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kpis({ items }: { items: { label: Dict; value: string; delta?: string }[] }) {
  const { t } = useLang();
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label.en} className="rounded-xl bg-slate-50 p-2.5">
          <div className="truncate text-[10px] text-slate-400">{t(k.label)}</div>
          <div className="mt-0.5 text-sm font-bold tracking-tight text-slate-800">{k.value}</div>
          {k.delta && <div className="text-[10px] font-medium text-emerald-600">{k.delta}</div>}
        </div>
      ))}
    </div>
  );
}

function Spark() {
  return (
    <svg viewBox="0 0 300 70" className="mt-1 h-16 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,52 L25,46 L50,50 L75,34 L100,40 L125,24 L150,30 L175,18 L200,24 L225,12 L250,20 L275,8 L300,14 L300,70 L0,70 Z" fill="url(#heroSpark)" />
      <polyline points="0,52 25,46 50,50 75,34 100,40 125,24 150,30 175,18 200,24 225,12 250,20 275,8 300,14" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="mt-2 flex items-end gap-1.5" style={{ height: 70 }}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-gradient-to-t from-emerald-400 to-sky-400" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-[8px] text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Body({ tab }: { tab: string }) {
  const { t } = useLang();
  const cur = "$";

  if (tab === "orders") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "今日订单", en: "Orders today", fr: "Commandes auj." }, value: "86", delta: "+9" },
            { label: { zh: "今日营收", en: "Revenue today", fr: "Revenus auj." }, value: `${cur}2,540`, delta: "+6.1%" },
            { label: { zh: "客单价", en: "Avg ticket", fr: "Panier moyen" }, value: `${cur}29.5` },
            { label: { zh: "待处理", en: "Pending", fr: "En attente" }, value: "4" },
          ]}
        />
        <Section title={t({ zh: "最近订单", en: "Recent orders", fr: "Commandes récentes" })}>
          <MiniTable
            head={[t({ zh: "订单", en: "Order", fr: "Commande" }), t({ zh: "渠道", en: "Channel", fr: "Canal" }), t({ zh: "金额", en: "Total", fr: "Total" }), t({ zh: "状态", en: "Status", fr: "Statut" })]}
            right={[2]}
            rows={[
              ["#1042", t({ zh: "堂食", en: "Dine-in", fr: "Sur place" }), `${cur}186`, <Tag key="1" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Tag>],
              ["#1041", t({ zh: "外卖", en: "Takeout", fr: "À emporter" }), `${cur}92`, <Tag key="2" tone="green">{t({ zh: "已付", en: "Paid", fr: "Payé" })}</Tag>],
              ["#1039", t({ zh: "扫码", en: "QR / online", fr: "QR / en ligne" }), `${cur}54`, <Tag key="3" tone="amber">{t({ zh: "待处理", en: "Pending", fr: "En attente" })}</Tag>],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "inventory") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "在管 SKU", en: "SKUs", fr: "SKU" }, value: "142" },
            { label: { zh: "库存偏低", en: "Low stock", fr: "Stock faible" }, value: "7" },
            { label: { zh: "缺货", en: "Out", fr: "Rupture" }, value: "2" },
            { label: { zh: "库存价值", en: "Value", fr: "Valeur" }, value: `${cur}11,240` },
          ]}
        />
        <Section title={t({ zh: "库存水平", en: "Stock levels", fr: "Niveaux de stock" })}>
          <MiniTable
            head={[t({ zh: "品项", en: "Item", fr: "Article" }), t({ zh: "现有", en: "On hand", fr: "Dispo." }), t({ zh: "状态", en: "Status", fr: "Statut" })]}
            rows={[
              [t({ zh: "猪排骨", en: "Pork ribs", fr: "Côtes de porc" }), "12 kg", <Tag key="1" tone="amber">{t({ zh: "偏低", en: "Low", fr: "Faible" })}</Tag>],
              [t({ zh: "活鲈鱼", en: "Live sea bass", fr: "Bar vivant" }), "0", <Tag key="2" tone="red">{t({ zh: "缺货", en: "Out", fr: "Rupture" })}</Tag>],
              [t({ zh: "小白菜", en: "Bok choy", fr: "Bok choy" }), t({ zh: "9 箱", en: "9 cases", fr: "9 caisses" }), <Tag key="3" tone="green">{t({ zh: "有货", en: "In stock", fr: "En stock" })}</Tag>],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "suppliers") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "活跃供应商", en: "Suppliers", fr: "Fournisseurs" }, value: "12" },
            { label: { zh: "在途采购", en: "Open POs", fr: "Bons" }, value: "5" },
            { label: { zh: "本月采购", en: "Spend", fr: "Dépenses" }, value: `${cur}9,420`, delta: "+4.7%" },
            { label: { zh: "平均交期", en: "Lead time", fr: "Délai" }, value: t({ zh: "2.1天", en: "2.1d", fr: "2,1 j" }) },
          ]}
        />
        <Section title={t({ zh: "供应商", en: "Suppliers", fr: "Fournisseurs" })}>
          <MiniTable
            head={[t({ zh: "供应商", en: "Supplier", fr: "Fournisseur" }), t({ zh: "准时率", en: "On-time", fr: "Ponctualité" }), t({ zh: "状态", en: "Status", fr: "Statut" })]}
            right={[1]}
            rows={[
              ["金记海鲜", "96%", <Tag key="1" tone="green">{t({ zh: "优选", en: "Preferred", fr: "Préféré" })}</Tag>],
              [t({ zh: "幸运蔬果", en: "Lucky Produce", fr: "Légumes Lucky" }), "92%", <Tag key="2" tone="green">{t({ zh: "优选", en: "Preferred", fr: "Préféré" })}</Tag>],
              [t({ zh: "金牌肉类", en: "Golden Meats", fr: "Viandes Golden" }), "88%", <Tag key="3" tone="slate">{t({ zh: "合作中", en: "Active", fr: "Actif" })}</Tag>],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "shifts") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "员工", en: "Staff", fr: "Personnel" }, value: "14" },
            { label: { zh: "本周工时", en: "Hours", fr: "Heures" }, value: "612" },
            { label: { zh: "人力成本", en: "Labor cost", fr: "Coût m.-o." }, value: `${cur}9,180` },
            { label: { zh: "人力占比", en: "Labor %", fr: "M.-o. %" }, value: "26%" },
          ]}
        />
        <Section title={t({ zh: "今日排班", en: "Today's schedule", fr: "Horaire du jour" })}>
          <MiniTable
            head={[t({ zh: "姓名", en: "Name", fr: "Nom" }), t({ zh: "岗位", en: "Role", fr: "Poste" }), t({ zh: "状态", en: "Status", fr: "Statut" })]}
            rows={[
              ["Wei Chen", t({ zh: "服务员", en: "Server", fr: "Serveur" }), <Tag key="1" tone="green">{t({ zh: "上班中", en: "Clocked in", fr: "Pointé" })}</Tag>],
              ["David Ng", t({ zh: "主厨", en: "Chef", fr: "Chef" }), <Tag key="2" tone="green">{t({ zh: "上班中", en: "Clocked in", fr: "Pointé" })}</Tag>],
              ["Mei Zhou", t({ zh: "服务员", en: "Server", fr: "Serveur" }), <Tag key="3" tone="slate">{t({ zh: "已排班", en: "Scheduled", fr: "Planifié" })}</Tag>],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "reconcile") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "应收", en: "Expected", fr: "Attendu" }, value: `${cur}2,540` },
            { label: { zh: "实点", en: "Counted", fr: "Compté" }, value: `${cur}2,512` },
            { label: { zh: "差异", en: "Variance", fr: "Écart" }, value: "-$28" },
            { label: { zh: "刷卡", en: "Card", fr: "Carte" }, value: `${cur}1,980` },
          ]}
        />
        <Section title={t({ zh: "每日对账", en: "Daily reconciliation", fr: "Rapprochement quotidien" })}>
          <MiniTable
            head={[t({ zh: "日期", en: "Date", fr: "Date" }), t({ zh: "营业额", en: "Sales", fr: "Ventes" }), t({ zh: "差异", en: "Variance", fr: "Écart" })]}
            right={[1, 2]}
            rows={[
              ["Jun 1", `${cur}2,540`, <Tag key="1" tone="amber">-$28</Tag>],
              ["May 31", `${cur}3,120`, <Tag key="2" tone="green">$0</Tag>],
              ["May 30", `${cur}2,880`, <Tag key="3" tone="green">+$12</Tag>],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "members") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "会员总数", en: "Members", fr: "Membres" }, value: "1,248", delta: "+86" },
            { label: { zh: "活跃", en: "Active", fr: "Actifs" }, value: "712" },
            { label: { zh: "客均消费", en: "Avg spend", fr: "Dépense moy." }, value: `${cur}34` },
            { label: { zh: "已兑积分", en: "Points", fr: "Points" }, value: "12,400" },
          ]}
        />
        <Section title={t({ zh: "高价值会员", en: "Top members", fr: "Meilleurs membres" })}>
          <MiniTable
            head={[t({ zh: "姓名", en: "Name", fr: "Nom" }), t({ zh: "等级", en: "Tier", fr: "Niveau" }), t({ zh: "消费", en: "Spend", fr: "Dépenses" })]}
            right={[2]}
            rows={[
              ["Jenny Wong", <Tag key="1" tone="green">VIP</Tag>, `${cur}2,140`],
              ["Michael Tan", <Tag key="2" tone="amber">{t({ zh: "金牌", en: "Gold", fr: "Or" })}</Tag>, `${cur}1,420`],
              ["Grace Liu", <Tag key="3" tone="amber">{t({ zh: "金牌", en: "Gold", fr: "Or" })}</Tag>, `${cur}1,180`],
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "reports") {
    return (
      <>
        <Kpis
          items={[
            { label: { zh: "营收(6月)", en: "Revenue 6mo", fr: "Revenus 6m" }, value: "$162k", delta: "+14%" },
            { label: { zh: "订单(6月)", en: "Orders 6mo", fr: "Cmd. 6m" }, value: "7,310" },
            { label: { zh: "客单价", en: "Avg ticket", fr: "Panier moy." }, value: "$28.40" },
            { label: { zh: "毛利率", en: "Margin", fr: "Marge" }, value: "31%" },
          ]}
        />
        <Section title={t({ zh: "各月营收", en: "Revenue by month", fr: "Revenus par mois" })}>
          <Bars
            data={[
              { label: t({ zh: "12", en: "Dec", fr: "déc" }), value: 22 },
              { label: t({ zh: "1", en: "Jan", fr: "jan" }), value: 24 },
              { label: t({ zh: "2", en: "Feb", fr: "fév" }), value: 26 },
              { label: t({ zh: "3", en: "Mar", fr: "mar" }), value: 27 },
              { label: t({ zh: "4", en: "Apr", fr: "avr" }), value: 29 },
              { label: t({ zh: "5", en: "May", fr: "mai" }), value: 31 },
            ]}
          />
        </Section>
      </>
    );
  }

  if (tab === "settings") {
    const mods: Dict[] = [
      { zh: "订单", en: "Orders", fr: "Commandes" },
      { zh: "库存", en: "Inventory", fr: "Inventaire" },
      { zh: "供应商", en: "Suppliers", fr: "Fournisseurs" },
      { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" },
      { zh: "扫码菜单", en: "QR menu", fr: "Menu QR" },
      { zh: "会员", en: "Members", fr: "Membres" },
    ];
    return (
      <>
        <Section title={t({ zh: "模块", en: "Modules", fr: "Modules" })}>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mods.map((m) => (
              <span key={m.en} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                ✓ {t(m)}
              </span>
            ))}
          </div>
        </Section>
        <Section title={t({ zh: "套餐", en: "Plan", fr: "Forfait" })}>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-800">{t({ zh: "标准版", en: "Standard", fr: "Standard" })} · $49/mo</span>
            <Tag tone="green">{t({ zh: "使用中", en: "Active", fr: "Actif" })}</Tag>
          </div>
        </Section>
      </>
    );
  }

  // overview (default)
  return (
    <>
      <Kpis
        items={[
          { label: { zh: "本月营收", en: "Revenue", fr: "Revenus" }, value: `${cur}28,540`, delta: "+12%" },
          { label: { zh: "订单", en: "Orders", fr: "Commandes" }, value: "1,248", delta: "+8%" },
          { label: { zh: "毛利", en: "Gross profit", fr: "Marge brute" }, value: `${cur}8,730`, delta: "+5%" },
          { label: { zh: "新会员", en: "New members", fr: "Nouv. membres" }, value: "86", delta: "+23" },
        ]}
      />
      <Section title={t({ zh: "销售趋势", en: "Sales trend", fr: "Tendance des ventes" })}>
        <Spark />
      </Section>
    </>
  );
}

/** Interactive product demo embedded directly in the landing hero. */
export default function HeroDemo() {
  const { t } = useLang();
  const [tab, setTab] = useState("overview");
  const active = NAV.find((n) => n.id === tab) ?? NAV[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl shadow-slate-900/15">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 text-[10px] text-slate-400">app.bentoos.io</span>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
          {t({ zh: "可点击体验", en: "Interactive", fr: "Interactif" })}
        </span>
      </div>

      <div className="flex">
        {/* sidebar — clickable tabs */}
        <aside className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/40 p-2 sm:block">
          <div className="mb-3 flex items-center gap-1.5 px-1">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-emerald-500 to-sky-500 text-[10px]">🍱</span>
            <span className="text-[11px] font-bold text-slate-800">BentoOS</span>
          </div>
          <nav className="space-y-0.5">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[10px] transition ${
                  n.id === tab ? "bg-emerald-50 font-medium text-emerald-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <span>{n.icon}</span>
                <span>{t(n.label)}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          {/* mobile tab row */}
          <div className="mb-2 flex gap-1 overflow-x-auto sm:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] transition ${
                  n.id === tab ? "bg-emerald-100 font-medium text-emerald-700" : "text-slate-500"
                }`}
              >
                {t(n.label)}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{t(active.label)}</span>
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400">
              {t({ zh: "5月1日 – 5月31日", en: "May 1 – May 31", fr: "1–31 mai" })}
            </span>
          </div>

          <Body tab={tab} />
        </div>
      </div>
    </div>
  );
}
