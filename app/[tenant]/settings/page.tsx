"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  inviteMember,
  getTenant,
  removeMember,
  setEnabled,
  setDayStartHour,
  setTrackPayments,
  type Role,
  type Tenant,
} from "@/lib/store";
import { MODULE_BY_ID, READY_MODULES, readyByCategory, readyCategoriesInDomain, readyDomains } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";
import { useLang, type Dict } from "@/app/i18n";

const ROLE_LABEL: Record<Role, Dict> = {
  owner: { en: "Owner (full access)", zh: "老板（全部权限）", fr: "Propriétaire (accès complet)" },
  manager: { en: "Manager", zh: "主管", fr: "Gérant" },
  staff: { en: "Staff", zh: "员工", fr: "Employé" },
};

// Trilingual UI chrome (EN default, + 中 / FR). Merchant data (store name,
// staff names/emails, tenant slug) is never translated. Supabase auth errors
// come back in English and are shown as-is.
const T: Record<string, Dict> = {
  back: { en: "← Overview", zh: "← 总览", fr: "← Aperçu" },
  title: { en: "Settings", zh: "设置", fr: "Paramètres" },

  // Users section
  staffAccounts: { en: "Staff accounts", zh: "员工账号", fr: "Comptes du personnel" },
  staffBlurb: {
    en: "Add multiple staff sub-accounts under the main account, assigning visible feature modules by role.",
    zh: "主账号下可添加多个员工子账号，按岗位分配可见的功能模块。",
    fr: "Ajoutez plusieurs sous-comptes de personnel sous le compte principal, en attribuant les modules visibles par rôle.",
  },
  pending: { en: "Pending", zh: "待加入", fr: "En attente" },
  visible: { en: "sees", zh: "可见", fr: "voit" },
  all: { en: "All", zh: "全部", fr: "Tout" },
  copyInviteLink: { en: "Copy invite link", zh: "复制邀请链接", fr: "Copier le lien d'invitation" },
  remove: { en: "Remove", zh: "移除", fr: "Retirer" },

  inviteStaff: { en: "+ Invite staff (by email)", zh: "+ 邀请员工（邮箱）", fr: "+ Inviter du personnel (courriel)" },
  emailRequired: { en: "Email (required)", zh: "邮箱（必填）", fr: "Courriel (obligatoire)" },
  nameOptional: { en: "Name (optional)", zh: "姓名（可选）", fr: "Nom (facultatif)" },
  namePlaceholder: { en: "Staff name", zh: "员工姓名", fr: "Nom de l'employé" },
  role: { en: "Role", zh: "岗位", fr: "Rôle" },
  roleStaff: { en: "Staff", zh: "员工", fr: "Employé" },
  roleManager: { en: "Manager", zh: "主管", fr: "Gérant" },
  visibleModules: {
    en: "Visible modules (none = all enabled modules)",
    zh: "可见模块（不选 = 全部已启用模块）",
    fr: "Modules visibles (aucun = tous les modules activés)",
  },
  sending: { en: "Sending…", zh: "发送中…", fr: "Envoi…" },
  sendInvite: { en: "Send invite", zh: "发送邀请", fr: "Envoyer l'invitation" },
  copy: { en: "Copy", zh: "复制", fr: "Copier" },
  inviteHint: {
    en: "Once they register with this email and set a password, they can sign in and see this store's back office (with the modules checked above).",
    zh: "对方用此邮箱注册并设置密码后，即可登录看到本店后台（按上面勾选的模块）。",
    fr: "Une fois inscrit avec ce courriel et un mot de passe défini, l'utilisateur peut se connecter et voir l'arrière-guichet de ce magasin (avec les modules cochés ci-dessus).",
  },

  // Invite alert/status messages
  invalidEmail: { en: "Please enter a valid email", zh: "请输入有效邮箱", fr: "Veuillez saisir un courriel valide" },
  inviteFailed: { en: "Invite failed: {x}", zh: "邀请失败：{x}", fr: "Échec de l'invitation : {x}" },
  inviteEmailSent: { en: "Invite email sent ✓", zh: "已发送邀请邮件 ✓", fr: "Courriel d'invitation envoyé ✓" },
  inviteCreated: {
    en: "Invite created — copy the link and send it over",
    zh: "邀请已创建 —— 复制链接发给对方",
    fr: "Invitation créée — copiez le lien et envoyez-le",
  },
  linkCopied: { en: "Link copied ✓", zh: "链接已复制 ✓", fr: "Lien copié ✓" },

  // Modules section
  modules: { en: "Feature modules", zh: "功能模块", fr: "Modules de fonctionnalités" },
  modulesBlurb: {
    en: "Add or remove features anytime — check a box to generate its entry forms and reports, no rebuild needed. Need something not listed? We can build a custom fit for you.",
    zh: "随时增减功能 —— 勾选即生成对应录入与报表，无需重建系统。需要清单外的功能？我们可以为你定制适配。",
    fr: "Ajoutez ou retirez des fonctionnalités à tout moment — cochez une case pour générer ses formulaires et rapports, sans reconstruction. Besoin d'autre chose ? Nous pouvons créer une solution sur mesure.",
  },
  frontOffice: { en: "🛎️ Front", zh: "🛎️ 前台", fr: "🛎️ Front" },
  backOffice: { en: "🗄️ Back", zh: "🗄️ 后台", fr: "🗄️ Arrière" },
  selectedCount: { en: "Selected", zh: "已选", fr: "Sélectionnés" },
  featuresUnit: { en: "features", zh: "个功能", fr: "fonctionnalités" },
  unsavedChanges: { en: "· Unsaved changes", zh: "· 有未保存的更改", fr: "· Modifications non enregistrées" },
  generating: { en: "Generating…", zh: "生成中…", fr: "Génération…" },
  generate: { en: "Generate back office →", zh: "生成后台 →", fr: "Générer l'arrière-guichet →" },

  // Operations
  opsTitle: { en: "Operations", zh: "运营设置", fr: "Exploitation" },
  opsBlurb: { en: "How the day is counted and whether payment methods are recorded.", zh: "如何划分营业日,以及是否记录付款方式。", fr: "Comment compter la journée et si les modes de paiement sont enregistrés." },
  dayStartLabel: { en: "New business day starts at", zh: "新营业日开始于", fr: "La nouvelle journée commence à" },
  dayStartHint: { en: "Sales after midnight but before this hour count toward the previous day. Use this for late-night shops.", zh: "凌晨此时间点之前的销售计入前一天。适合营业到深夜的店。", fr: "Les ventes après minuit mais avant cette heure comptent pour la veille." },
  midnight: { en: "12am (midnight)", zh: "0 点(午夜)", fr: "0 h (minuit)" },
  trackPayLabel: { en: "Record payment method", zh: "记录付款方式", fr: "Enregistrer le mode de paiement" },
  trackPayHint: { en: "On: choose cash / card / EMT at checkout and see the split in sales stats. Off: everything is plain sales.", zh: "开:结账时选择现金/刷卡/EMT,销售统计显示占比。关:一律记为普通销售。", fr: "Activé : choisir espèces / carte / EMT à la caisse. Désactivé : tout en ventes simples." },
  saved: { en: "Saved", zh: "已保存", fr: "Enregistré" },

  // Account & login
  accountLogin: { en: "Account & login", zh: "账户与登录", fr: "Compte et connexion" },
  accountBlurb: {
    en: "Your current login. You can change your password anytime.",
    zh: "当前登录账号，可随时修改密码。",
    fr: "Votre connexion actuelle. Vous pouvez changer votre mot de passe à tout moment.",
  },
  loginUsername: { en: "Login username", zh: "登录用户名", fr: "Nom d'utilisateur" },
  newPassword: { en: "New password", zh: "新密码", fr: "Nouveau mot de passe" },
  pwPlaceholder: { en: "At least 6 characters", zh: "至少 6 位", fr: "Au moins 6 caractères" },
  confirmPassword: { en: "Confirm new password", zh: "确认新密码", fr: "Confirmer le nouveau mot de passe" },
  updating: { en: "Updating…", zh: "更新中…", fr: "Mise à jour…" },
  changePassword: { en: "Change password", zh: "修改密码", fr: "Changer le mot de passe" },
  pwTooShort: { en: "Password must be at least 6 characters", zh: "密码至少 6 位", fr: "Le mot de passe doit comporter au moins 6 caractères" },
  pwMismatch: { en: "Passwords don't match", zh: "两次输入不一致", fr: "Les mots de passe ne correspondent pas" },
  pwUpdated: { en: "Password updated ✓", zh: "密码已更新 ✓", fr: "Mot de passe mis à jour ✓" },
};

/** Localize a catalog label ({ zh, en } only — no fr; fr falls back to en). */
function moduleLabel(bi: { zh: string; en: string } | undefined, lang: "zh" | "en" | "fr"): string {
  if (!bi) return "";
  return lang === "zh" ? bi.zh : bi.en;
}

export default function Settings() {
  const { t, lang } = useLang();
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
      setInviteMsg(t(T.invalidEmail));
      return;
    }
    setInviteBusy(true);
    setInviteMsg(null);
    setInviteLink(null);
    const { error } = await inviteMember(slug, { name: uName.trim() || email, email, role: uRole, access: Array.from(uAccess) });
    if (error) {
      setInviteBusy(false);
      setInviteMsg(t(T.inviteFailed).replace("{x}", error));
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
    setInviteMsg(emailed ? t(T.inviteEmailSent) : t(T.inviteCreated));
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
    setInviteMsg(t(T.linkCopied));
  };

  const removeUser = async (id: string) => {
    await removeMember(id);
    reload();
  };

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">{t(T.back)}</Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold text-ink">{t(T.title)}</h1>

      {/* ── Account & login ─────────────────────────────────── */}
      <AccountLogin />

      {/* ── Operations (business-day cutoff + payment tracking) ── */}
      <OpsSettings slug={slug} tenant={tenant} />

      {/* ── Users ─────────────────────────────────────────── */}
      <section className="card mb-8 p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">{t(T.staffAccounts)}</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {t(T.staffBlurb)}
        </p>

        <div className="mb-5 divide-y divide-slate-100">
          {tenant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-ink">
                  {u.name}
                  {u.pending && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{t(T.pending)}</span>
                  )}
                </div>
                <div className="truncate text-xs text-ink-faint">
                  {t(ROLE_LABEL[u.role])}
                  {u.email && <> · {u.email}</>}
                  {u.role !== "owner" && (
                    <> · {t(T.visible)} {u.access.length === 0 ? t(T.all) : u.access.map((id) => moduleLabel(MODULE_BY_ID[id]?.label, lang)).filter(Boolean).join("、")}</>
                  )}
                </div>
              </div>
              <div className="flex flex-none items-center gap-3">
                {u.pending && u.email && (
                  <button onClick={() => copyInvite(u.email!)} className="text-xs font-medium text-brand hover:underline">{t(T.copyInviteLink)}</button>
                )}
                {u.role !== "owner" && (
                  <button onClick={() => removeUser(u.id)} className="text-xs text-ink-faint hover:text-red-600">{t(T.remove)}</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* invite staff by email */}
        <div className="rounded-xl border border-dashed border-slate-300 p-4">
          <div className="mb-3 text-sm font-medium text-ink">{t(T.inviteStaff)}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">{t(T.emailRequired)}</label>
              <input className="input" type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} placeholder="staff@example.com" />
            </div>
            <div>
              <label className="label">{t(T.nameOptional)}</label>
              <input className="input" value={uName} onChange={(e) => setUName(e.target.value)} placeholder={t(T.namePlaceholder)} />
            </div>
            <div>
              <label className="label">{t(T.role)}</label>
              <select className="input" value={uRole} onChange={(e) => setURole(e.target.value as Role)}>
                <option value="staff">{t(T.roleStaff)}</option>
                <option value="manager">{t(T.roleManager)}</option>
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="label">{t(T.visibleModules)}</label>
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
                    {m.icon} {moduleLabel(m.label, lang)}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-primary mt-4" onClick={inviteUser} disabled={inviteBusy || !uEmail.trim()}>
            {inviteBusy ? t(T.sending) : t(T.sendInvite)}
          </button>
          {inviteMsg && <div className="mt-3 text-sm text-brand">{inviteMsg}</div>}
          {inviteLink && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs text-ink-soft">{inviteLink}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(inviteLink).catch(() => {})}
                className="flex-none rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white"
              >
                {t(T.copy)}
              </button>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-faint">{t(T.inviteHint)}</p>
        </div>
      </section>

      {/* ── Modules ───────────────────────────────────────── */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-semibold text-ink">{t(T.modules)}</h2>
        <p className="mb-4 text-sm text-ink-soft">
          {t(T.modulesBlurb)}
        </p>
        <div className="space-y-6">
          {readyDomains().map((dom) => (
            <div key={dom.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-baseline gap-2">
                <span className={`pill ${dom.id === "frontend" ? "bg-amber-100 text-amber-700" : "bg-brand-wash text-brand"}`}>
                  {dom.id === "frontend" ? t(T.frontOffice) : t(T.backOffice)}
                </span>
                <span className="text-xs text-ink-faint">{moduleLabel(dom.blurb, lang)}</span>
              </div>
              <div className="space-y-4">
                {readyCategoriesInDomain(dom.id).map((c) => (
                  <div key={c.id}>
                    <div className="mb-2 text-sm font-semibold text-ink">{moduleLabel(c.label, lang)}</div>
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
                      <span className="text-ink">{m.icon} {moduleLabel(m.label, lang)}</span>
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
            {t(T.selectedCount)} <b className="text-ink">{picked.size}</b> {t(T.featuresUnit)}
            {dirty && <span className="ml-2 text-amber-600">{t(T.unsavedChanges)}</span>}
          </span>
          <button
            className="btn-primary px-6 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={generate}
            disabled={!dirty || genBusy}
          >
            {genBusy ? t(T.generating) : t(T.generate)}
          </button>
        </div>
      </section>
    </main>
  );
}

/** Account & login: shows the current login and lets the user change the password anytime. */
function OpsSettings({ slug, tenant }: { slug: string; tenant?: Tenant }) {
  const { t } = useLang();
  const [hour, setHour] = useState(0);
  const [track, setTrack] = useState(true);
  const [savedTag, setSavedTag] = useState(false);
  useEffect(() => {
    if (!tenant) return;
    setHour(tenant.dayStartHour ?? 0);
    setTrack(tenant.trackPayments ?? true);
  }, [tenant]);
  const flash = () => { setSavedTag(true); setTimeout(() => setSavedTag(false), 1600); };
  const onHour = (h: number) => { setHour(h); setDayStartHour(slug, h); flash(); };
  const onTrack = (on: boolean) => { setTrack(on); setTrackPayments(slug, on); flash(); };
  const HOURS = [0, 4, 5, 6, 7, 8, 9, 10, 11];
  const hourLabel = (h: number) => (h === 0 ? t(T.midnight) : `${h}am`);

  return (
    <section className="card mb-8 p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-ink">{t(T.opsTitle)}</h2>
        {savedTag && <span className="rounded-full bg-brand-wash px-2 py-0.5 text-xs font-semibold text-brand-ink">{t(T.saved)}</span>}
      </div>
      <p className="mb-5 text-sm text-ink-soft">{t(T.opsBlurb)}</p>

      <div className="mb-5">
        <label className="text-sm font-semibold text-ink">{t(T.dayStartLabel)}</label>
        <select value={hour} onChange={(e) => onHour(Number(e.target.value))} className="input mt-2 !w-auto min-w-[9rem]">
          {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <p className="mt-1.5 text-xs text-ink-faint">{t(T.dayStartHint)}</p>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-[#F3F2EE] pt-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink">{t(T.trackPayLabel)}</div>
          <p className="mt-1 text-xs text-ink-faint">{t(T.trackPayHint)}</p>
        </div>
        <button
          onClick={() => onTrack(!track)}
          role="switch"
          aria-checked={track}
          className={`relative h-6 w-11 flex-none rounded-full transition ${track ? "bg-brand" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${track ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    </section>
  );
}

function AccountLogin() {
  const { t } = useLang();
  const { email } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async () => {
    if (pw.length < 6) { setMsg({ ok: false, text: t(T.pwTooShort) }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: t(T.pwMismatch) }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setPw(""); setPw2("");
    setMsg({ ok: true, text: t(T.pwUpdated) });
  };

  return (
    <section className="card mb-8 p-5">
      <h2 className="mb-1 text-lg font-semibold text-ink">{t(T.accountLogin)}</h2>
      <p className="mb-4 text-sm text-ink-soft">{t(T.accountBlurb)}</p>

      <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <div className="text-xs text-ink-faint">{t(T.loginUsername)}</div>
        <div className="font-medium text-ink">{email ?? "…"}</div>
      </div>

      <div className="grid gap-3 sm:max-w-sm">
        <div>
          <label className="label">{t(T.newPassword)}</label>
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t(T.pwPlaceholder)} />
        </div>
        <div>
          <label className="label">{t(T.confirmPassword)}</label>
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && change()} />
        </div>
        {msg && <div className={`text-sm ${msg.ok ? "text-brand" : "text-red-600"}`}>{msg.text}</div>}
        <button className="btn-primary w-fit" onClick={change} disabled={busy || !pw || !pw2}>
          {busy ? t(T.updating) : t(T.changePassword)}
        </button>
      </div>
    </section>
  );
}
