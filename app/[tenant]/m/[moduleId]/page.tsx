"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addRecord,
  deleteRecord,
  getTenant,
  type RecordRow,
  type Tenant,
} from "@/lib/store";
import { MODULE_BY_ID, type Field, type ModuleDef } from "@/lib/catalog";
import { money, num, sum } from "@/lib/format";

export default function ModulePage() {
  const params = useParams();
  const slug = params.tenant as string;
  const moduleId = params.moduleId as string;
  const mod = MODULE_BY_ID[moduleId];

  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getTenant(slug).then(setTenant);
  }, [slug, moduleId, tick]);

  const rows: RecordRow[] = useMemo(
    () => tenant?.records[moduleId] ?? [],
    [tenant, moduleId]
  );

  if (!mod) {
    return (
      <main className="px-6 py-8">
        <p className="text-ink-soft">未知模块。</p>
        <Link href={`/${slug}`} className="text-brand">← 返回总览</Link>
      </main>
    );
  }
  if (!tenant) return null;

  const enabled = tenant.enabled.includes(moduleId);

  const submit = async () => {
    const missing = mod.fields.filter((f) => f.required && !form[f.key]?.trim());
    if (missing.length) {
      alert("请填写：" + missing.map((f) => f.label.zh).join("、"));
      return;
    }
    await addRecord(slug, moduleId, form);
    setForm({});
    setOpen(false);
    setTick((t) => t + 1);
  };

  const total = mod.amountKey ? sum(rows, mod.amountKey) : 0;

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {mod.icon} {mod.label.zh}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
        </div>
        {enabled && (
          <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
            {open ? "收起" : "+ 新增记录"}
          </button>
        )}
      </header>

      {!enabled && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          该模块未启用。到 <Link href={`/${slug}/settings`} className="underline">设置</Link> 中开启后即可录入。
        </div>
      )}

      {/* KPI + outputs */}
      <section className="mb-6 grid gap-4 lg:grid-cols-3">
        {mod.amountKey && (
          <div className="card p-5">
            <div className="text-xs text-ink-faint">{mod.amountLabel?.zh}（累计）</div>
            <div className="mt-1 text-2xl font-bold text-ink">
              {mod.amountKind === "money" ? money(total) : num(total)}
            </div>
            <div className="mt-1 text-xs text-ink-faint">{rows.length} 条记录</div>
          </div>
        )}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            系统输出 Outputs
          </div>
          <ul className="space-y-1">
            {mod.outputs.map((o, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft">
                <span className="text-brand">✓</span>
                <span>{o.zh}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* entry form */}
      {open && enabled && (
        <section className="card mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-ink">新增记录</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mod.fields.map((f) => (
              <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                <FieldInput
                  field={f}
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={submit}>保存</button>
            <button className="btn-ghost" onClick={() => { setForm({}); setOpen(false); }}>取消</button>
          </div>
        </section>
      )}

      {/* records table */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
                {mod.fields.map((f) => (
                  <th key={f.key} className="px-4 py-2.5 font-medium">{f.label.zh}</th>
                ))}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  {mod.fields.map((f) => (
                    <td key={f.key} className="px-4 py-2.5 text-ink-soft">
                      {renderCell(f, r[f.key])}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={async () => {
                        if (confirm("删除这条记录？")) {
                          await deleteRecord(r.id);
                          setTick((t) => t + 1);
                        }
                      }}
                      className="text-xs text-ink-faint hover:text-red-600"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={mod.fields.length + 1} className="px-4 py-10 text-center text-sm text-ink-faint">
                    还没有记录{enabled ? "，点「+ 新增记录」开始录入。" : "。"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">
        {field.label.zh}
        {field.required && <span className="text-red-500"> *</span>}
        {field.suffix && <span className="text-ink-faint"> ({field.suffix})</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea className="input min-h-[72px]" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.zh} value={o.zh}>{o.zh}</option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          type={
            field.type === "money" || field.type === "number"
              ? "number"
              : field.type === "date"
              ? "date"
              : field.type === "time"
              ? "time"
              : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function renderCell(field: Field, value: any) {
  if (value === undefined || value === "" || value === null) return <span className="text-slate-300">—</span>;
  if (field.type === "money") return money(value);
  return String(value);
}
