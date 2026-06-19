import { PageHeader, Card, Badge } from "../ui";
import { SHOP } from "../data";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-200"}`}
      aria-hidden
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

const MODULES: { name: string; on: boolean }[] = [
  { name: "Orders", on: true },
  { name: "Inventory", on: true },
  { name: "Suppliers", on: true },
  { name: "Shift & Pay", on: true },
  { name: "Reconcile", on: true },
  { name: "Members", on: true },
  { name: "QR menu", on: true },
  { name: "Reports", on: true },
  { name: "Marketing", on: false },
];

const FIELDS: [string, string][] = [
  ["Shop name", SHOP.name],
  ["Address", SHOP.address],
  ["Phone", "(416) 591-2188"],
  ["Timezone", "America/Toronto (EDT)"],
  ["Currency", "CAD ($)"],
];

const TEAM: [string, string][] = [
  ["Owner", "1 account"],
  ["Managers", "2 accounts"],
  ["Staff", "11 accounts"],
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Shop profile, modules, and billing" />

      <Card title="Shop profile">
        <dl className="divide-y divide-slate-50">
          {FIELDS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-slate-400">{k}</dt>
              <dd className="font-medium text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Modules" action={<span className="text-xs text-slate-400">Tick a feature, the back-office builds it</span>}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <li key={m.name} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
              <span className="text-slate-700">{m.name}</span>
              <span className="flex items-center gap-2">
                {!m.on && <span className="text-[11px] text-slate-400">Soon</span>}
                <Toggle on={m.on} />
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Plan & billing">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">Standard</span>
                <Badge tone="green">Active</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">$49 / mo · next bill Jun 30, 2026</p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Manage</span>
          </div>
        </Card>

        <Card title="Team">
          <dl className="divide-y divide-slate-50">
            {TEAM.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-slate-400">{k}</dt>
                <dd className="font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
