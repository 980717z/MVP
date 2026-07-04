"use client";

import { PageHeader, Card, Badge } from "../ui";
import { SHOP } from "../data";
import { useLang, type Dict } from "../lang";

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

const MODULES: { name: Dict; on: boolean }[] = [
  { name: { zh: "订单", en: "Orders", fr: "Commandes" }, on: true },
  { name: { zh: "库存", en: "Inventory", fr: "Inventaire" }, on: true },
  { name: { zh: "供应商", en: "Suppliers", fr: "Fournisseurs" }, on: true },
  { name: { zh: "排班与薪酬", en: "Shift & Pay", fr: "Horaires et paie" }, on: true },
  { name: { zh: "对账", en: "Reconcile", fr: "Rapprochement" }, on: true },
  { name: { zh: "会员", en: "Members", fr: "Membres" }, on: true },
  { name: { zh: "扫码菜单", en: "QR menu", fr: "Menu QR" }, on: true },
  { name: { zh: "报表", en: "Reports", fr: "Rapports" }, on: true },
  { name: { zh: "营销", en: "Marketing", fr: "Marketing" }, on: false },
];

export default function Settings() {
  const { t } = useLang();

  const FIELDS: [Dict, string][] = [
    [{ zh: "店名", en: "Shop name", fr: "Nom du commerce" }, SHOP.name],
    [{ zh: "地址", en: "Address", fr: "Adresse" }, t(SHOP.address)],
    [{ zh: "电话", en: "Phone", fr: "Téléphone" }, "(416) 591-2188"],
    [{ zh: "时区", en: "Timezone", fr: "Fuseau horaire" }, "America/Toronto (EDT)"],
    [{ zh: "货币", en: "Currency", fr: "Devise" }, "CAD ($)"],
  ];

  const TEAM: [Dict, Dict][] = [
    [{ zh: "店主", en: "Owner", fr: "Propriétaire" }, { zh: "1 个账号", en: "1 account", fr: "1 compte" }],
    [{ zh: "经理", en: "Managers", fr: "Gestionnaires" }, { zh: "2 个账号", en: "2 accounts", fr: "2 comptes" }],
    [{ zh: "员工", en: "Staff", fr: "Personnel" }, { zh: "11 个账号", en: "11 accounts", fr: "11 comptes" }],
  ];

  return (
    <>
      <PageHeader title={t({ zh: "设置", en: "Settings", fr: "Paramètres" })} subtitle={t({ zh: "店铺资料、模块与账单", en: "Shop profile, modules, and billing", fr: "Profil du commerce, modules et facturation" })} />

      <Card title={t({ zh: "店铺资料", en: "Shop profile", fr: "Profil du commerce" })}>
        <dl className="divide-y divide-slate-50">
          {FIELDS.map(([k, v]) => (
            <div key={k.en} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-slate-400">{t(k)}</dt>
              <dd className="font-medium text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title={t({ zh: "模块", en: "Modules", fr: "Modules" })} action={<span className="text-xs text-slate-400">{t({ zh: "勾选功能，后台自动生成", en: "Tick a feature, the back-office builds it", fr: "Cochez une fonction, le back-office se construit" })}</span>}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m.name.en} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
              <span className="text-slate-700">{t(m.name)}</span>
              <span className="flex items-center gap-2">
                {!m.on && <span className="text-[11px] text-slate-400">{t({ zh: "即将推出", en: "Soon", fr: "Bientôt" })}</span>}
                <Toggle on={m.on} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t({ zh: "套餐与账单", en: "Plan & billing", fr: "Forfait et facturation" })}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{t({ zh: "定制方案", en: "Personalized plan", fr: "Forfait sur mesure" })}</span>
                <Badge tone="green">{t({ zh: "使用中", en: "Active", fr: "Actif" })}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">{t({ zh: "按店配置 · 零抽成", en: "Tailored to your shop · 0% commission", fr: "Adapté à votre commerce · 0% commission" })}</p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">{t({ zh: "管理", en: "Manage", fr: "Gérer" })}</span>
          </div>
        </Card>

        <Card title={t({ zh: "团队", en: "Team", fr: "Équipe" })}>
          <dl className="divide-y divide-slate-50">
            {TEAM.map(([k, v]) => (
              <div key={k.en} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-slate-400">{t(k)}</dt>
                <dd className="font-medium text-slate-700">{t(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
