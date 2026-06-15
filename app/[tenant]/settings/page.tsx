"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addMember,
  getTenant,
  removeMember,
  setEnabled,
  type Role,
  type Tenant,
} from "@/lib/store";
import { CATEGORIES, MODULE_BY_ID, MODULES } from "@/lib/catalog";

const ROLE_LABEL: Record<Role, string> = {
  owner: "老板（全部权限）",
  manager: "主管",
  staff: "员工",
};

export default function Settings() {
  const slug = useParams().tenant as string;
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [tick, setTick] = useState(0);

  // new-user form
  const [uName, setUName] = useState("");
  const [uRole, setURole] = useState<Role>("staff");
  const [uAccess, setUAccess] = useState<Set<string>>(new Set());

  useEffect(() => {
    getTenant(slug).then(setTenant);
  }, [slug, tick]);

  if (!tenant) return null;

  const reload = () => setTick((x) => x + 1);

  const toggleModule = async (id: string) => {
    const enabled = new Set(tenant.enabled);
    enabled.has(id) ? enabled.delete(id) : enabled.add(id);
    await setEnabled(slug, Array.from(enabled));
    reload();
  };

  const addUser = async () => {
    if (!uName.trim()) return;
    await addMember(slug, { name: uName.trim(), role: uRole, access: Array.from(uAccess) });
    setUName("");
    setURole("staff");
    setUAccess(new Set());
    reload();
  };

  const removeUser = async (id: string) => {
    await removeMember(id);
    reload();
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold text-ink">设置</h1>

      {/* ── Users ─────────────────────────────────────────── */}
      <section className="card mb-8 p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">员工账号</h2>
        <p className="mb-4 text-sm text-ink-soft">
          主账号下可添加多个员工子账号，按岗位分配可见的功能模块。
        </p>

        <div className="mb-5 divide-y divide-slate-100">
          {tenant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-ink">{u.name}</div>
                <div className="text-xs text-ink-faint">
                  {ROLE_LABEL[u.role]}
                  {u.role !== "owner" && (
                    <> · 可见 {u.access.length === 0 ? "全部" : u.access.map((id) => MODULE_BY_ID[id]?.label.zh).filter(Boolean).join("、")}</>
                  )}
                </div>
              </div>
              {u.role !== "owner" && (
                <button onClick={() => removeUser(u.id)} className="text-xs text-ink-faint hover:text-red-600">
                  移除
                </button>
              )}
            </div>
          ))}
        </div>

        {/* add user */}
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <div className="mb-3 text-sm font-medium text-ink">+ 添加员工</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">姓名</label>
              <input className="input" value={uName} onChange={(e) => setUName(e.target.value)} placeholder="员工姓名" />
            </div>
            <div>
              <label className="label">岗位</label>
              <select className="input" value={uRole} onChange={(e) => setURole(e.target.value as Role)}>
                <option value="staff">员工</option>
                <option value="manager">主管</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="label">可见模块（不选 = 全部已启用模块）</label>
            <div className="flex flex-wrap gap-2">
              {tenant.enabled.map((id) => {
                const m = MODULE_BY_ID[id];
                if (!m) return null;
                const on = uAccess.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setUAccess((prev) => {
                        const n = new Set(prev);
                        n.has(id) ? n.delete(id) : n.add(id);
                        return n;
                      })
                    }
                    className={`pill border ${on ? "border-brand bg-brand-wash text-brand" : "border-slate-300 text-ink-soft"}`}
                  >
                    {m.icon} {m.label.zh}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary mt-4" onClick={addUser}>添加员工</button>
        </div>
      </section>

      {/* ── Modules ───────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">功能模块</h2>
        <p className="mb-4 text-sm text-ink-soft">
          随时增减功能 —— 勾选即生成对应录入与报表，无需重建系统。需要清单外的功能？我们可以为你定制适配。
        </p>
        <div className="space-y-5">
          {CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="mb-2 text-sm font-semibold text-ink">{c.label.zh}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.filter((m) => m.category === c.id).map((m) => {
                  const on = tenant.enabled.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                        on ? "border-brand bg-brand-wash" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggleModule(m.id)} className="h-4 w-4 accent-brand" />
                      <span className="text-ink">{m.icon} {m.label.zh}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
