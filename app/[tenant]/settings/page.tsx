"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  inviteMember,
  getTenant,
  removeMember,
  setEnabled,
  type Role,
  type Tenant,
} from "@/lib/store";
import { MODULE_BY_ID, READY_MODULES, readyByCategory, readyCategoriesInDomain, readyDomains } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

const ROLE_LABEL: Record<Role, string> = {
  owner: "老板（全部权限）",
  manager: "主管",
  staff: "员工",
};

export default function Settings() {
  const slug = useParams().tenant as string;
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [tick, setTick] = useState(0);

  // staged module selection (applied on「生成后台」)
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [genBusy, setGenBusy] = useState(false);

  const { email: ownerEmail } = useAuth();

  // invite-staff form
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uRole, setURole] = useState<Role>("staff");
  const [uAccess, setUAccess] = useState<Set<string>>(new Set());
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    getTenant(slug).then((t) => {
      setTenant(t);
      setPicked(new Set(t?.enabled ?? []));
    });
  }, [slug, tick]);

  if (!tenant) return null;

  const reload = () => setTick((x) => x + 1);

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const saved = tenant.enabled;
  const dirty = picked.size !== saved.length || saved.some((id) => !picked.has(id));

  const generate = async () => {
    setGenBusy(true);
    await setEnabled(slug, Array.from(picked));
    setGenBusy(false);
    // go to the dashboard so the regenerated sidebar shows up
    router.push(`/${slug}`);
  };

  const inviteLinkFor = (email: string) =>
    `${window.location.origin}/login?invite=1&email=${encodeURIComponent(email)}`;

  const inviteUser = async () => {
    const email = uEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setInviteMsg("请输入有效邮箱");
      return;
    }
    setInviteBusy(true);
    setInviteMsg(null);
    setInviteLink(null);
    const { error } = await inviteMember(slug, { name: uName.trim() || email, email, role: uRole, access: Array.from(uAccess) });
    if (error) {
      setInviteBusy(false);
      setInviteMsg(`邀请失败：${error}`);
      return;
    }
    const link = inviteLinkFor(email);
    let emailed = false;
    try {
      // authenticated invite email (route verifies the caller owns this tenant)
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ email, slug, inviterEmail: ownerEmail, lang: "zh" }),
      });
      emailed = !!(await res.json().catch(() => ({}))).emailed;
    } catch {
      /* link fallback below */
    }
    setInviteBusy(false);
    setInviteLink(link);
    setInviteMsg(emailed ? "已发送邀请邮件 ✓" : "邀请已创建 —— 复制链接发给对方");
    setUName("");
    setUEmail("");
    setURole("staff");
    setUAccess(new Set());
    reload();
  };

  const copyInvite = (email: string) => {
    const link = inviteLinkFor(email);
    navigator.clipboard?.writeText(link).catch(() => {});
    setInviteLink(link);
    setInviteMsg("链接已复制 ✓");
  };

  const removeUser = async (id: string) => {
    await removeMember(id);
    reload();
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold text-ink">设置</h1>

      {/* ── Account & login ─────────────────────────────────── */}
      <AccountLogin />

      {/* ── Users ─────────────────────────────────────────── */}
      <section className="card mb-8 p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">员工账号</h2>
        <p className="mb-4 text-sm text-ink-soft">
          主账号下可添加多个员工子账号，按岗位分配可见的功能模块。
        </p>

        <div className="mb-5 divide-y divide-slate-100">
          {tenant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  {u.name}
                  {u.pending && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">待加入</span>
                  )}
                </div>
                <div className="truncate text-xs text-ink-faint">
                  {ROLE_LABEL[u.role]}
                  {u.email && <> · {u.email}</>}
                  {u.role !== "owner" && (
                    <> · 可见 {u.access.length === 0 ? "全部" : u.access.map((id) => MODULE_BY_ID[id]?.label.zh).filter(Boolean).join("、")}</>
                  )}
                </div>
              </div>
              <div className="flex flex-none items-center gap-3">
                {u.pending && u.email && (
                  <button onClick={() => copyInvite(u.email!)} className="text-xs font-medium text-brand hover:underline">复制邀请链接</button>
                )}
                {u.role !== "owner" && (
                  <button onClick={() => removeUser(u.id)} className="text-xs text-ink-faint hover:text-red-600">移除</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* invite staff by email */}
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <div className="mb-3 text-sm font-medium text-ink">+ 邀请员工（邮箱）</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">邮箱（必填）</label>
              <input className="input" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder="staff@example.com" />
            </div>
            <div>
              <label className="label">姓名（可选）</label>
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
                    {m.label.zh}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary mt-4" onClick={inviteUser} disabled={inviteBusy || !uEmail.trim()}>
            {inviteBusy ? "发送中…" : "发送邀请"}
          </button>
          {inviteMsg && <div className="mt-3 text-sm text-brand">{inviteMsg}</div>}
          {inviteLink && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-ink-soft">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(inviteLink).catch(() => {})}
                className="flex-none rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white"
              >
                复制
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-faint">对方用此邮箱注册并设置密码后，即可登录看到本店后台（按上面勾选的模块）。</p>
        </div>
      </section>

      {/* ── Modules ───────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">功能模块</h2>
        <p className="mb-4 text-sm text-ink-soft">
          随时增减功能 —— 勾选即生成对应录入与报表，无需重建系统。需要清单外的功能？我们可以为你定制适配。
        </p>
        <div className="space-y-6">
          {readyDomains().map((dom) => (
            <div key={dom.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`pill ${dom.id === "frontend" ? "bg-amber-100 text-amber-700" : "bg-brand-wash text-brand"}`}>
                  {dom.id === "frontend" ? "前台" : "后台"}
                </span>
                <span className="text-xs text-ink-faint">{dom.blurb.zh}</span>
              </div>
              <div className="space-y-4">
                {readyCategoriesInDomain(dom.id).map((c) => (
                  <div key={c.id}>
                    <div className="mb-2 text-sm font-semibold text-ink">{c.label.zh}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {readyByCategory(c.id).map((m) => {
                  const on = picked.has(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${
                        on ? "border-brand bg-brand-wash" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => togglePick(m.id)} className="h-4 w-4 accent-brand" />
                      <span className="text-ink">{m.label.zh}</span>
                    </label>
                  );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* generate */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-sm text-ink-faint">
            已选 <b className="text-ink">{picked.size}</b> 个功能
            {dirty && <span className="ml-2 text-amber-600">· 有未保存的更改</span>}
          </span>
          <button
            className="btn-primary px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={generate}
            disabled={!dirty || genBusy}
          >
            {genBusy ? "生成中…" : "生成后台 →"}
          </button>
        </div>
      </section>
    </main>
  );
}

/** Account & login: shows the current login and lets the user change the password anytime. */
function AccountLogin() {
  const { email } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async () => {
    if (pw.length < 6) { setMsg({ ok: false, text: "密码至少 6 位" }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: "两次输入不一致" }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(""); setPw2("");
    setMsg({ ok: true, text: "密码已更新 ✓" });
  };

  return (
    <section className="card mb-8 p-5">
      <h2 className="mb-1 text-lg font-semibold text-ink">账户与登录</h2>
      <p className="mb-4 text-sm text-ink-soft">当前登录账号，可随时修改密码。</p>

      <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <div className="text-xs text-ink-faint">登录用户名</div>
        <div className="font-medium text-ink">{email ?? "…"}</div>
      </div>

      <div className="grid gap-3 sm:max-w-sm">
        <div>
          <label className="label">新密码</label>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="至少 6 位" />
        </div>
        <div>
          <label className="label">确认新密码</label>
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && change()} />
        </div>
        {msg && <div className={`text-sm ${msg.ok ? "text-brand" : "text-red-600"}`}>{msg.text}</div>}
        <button className="btn-primary w-fit" onClick={change} disabled={busy || !pw || !pw2}>
          {busy ? "更新中…" : "修改密码"}
        </button>
      </div>
    </section>
  );
}
