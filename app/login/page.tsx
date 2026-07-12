"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { claimInvites } from "@/lib/store";
import { useLang, LangToggle, type Dict } from "@/app/i18n";

// Trilingual copy (EN default, + 中 / FR). Chrome only — Supabase auth errors
// come back in English and are shown as-is.
const T: Record<string, Dict> = {
  signin: { en: "Sign in", zh: "登录", fr: "Connexion" },
  signup: { en: "Sign up", zh: "注册", fr: "Inscription" },
  email: { en: "Email", zh: "邮箱", fr: "Courriel" },
  password: { en: "Password", zh: "密码", fr: "Mot de passe" },
  pwPlaceholder: { en: "At least 6 characters", zh: "至少 6 位", fr: "Au moins 6 caractères" },
  wait: { en: "Please wait…", zh: "请稍候…", fr: "Un instant…" },
  ctaSignin: { en: "Sign in", zh: "登录", fr: "Se connecter" },
  ctaSignup: { en: "Sign up & continue", zh: "注册并登录", fr: "S'inscrire et continuer" },
  footer: {
    en: "Demo environment. Signing up creates your merchant account.",
    zh: "演示环境。注册即创建你的商家账号。",
    fr: "Environnement de démo. L'inscription crée votre compte marchand.",
  },
  signupOk: {
    en: "Account created. If email verification is on, check your inbox before signing in.",
    zh: "注册成功。如开启了邮箱验证，请查收邮件后再登录。",
    fr: "Compte créé. Si la vérification par courriel est activée, consultez votre boîte avant de vous connecter.",
  },
  genericErr: { en: "Something went wrong", zh: "出错了", fr: "Une erreur s'est produite" },
  needCreds: {
    en: "Enter your email and password.",
    zh: "请填写邮箱和密码。",
    fr: "Saisissez votre courriel et votre mot de passe.",
  },
};

// ⚠️ TEMP DIAGNOSTIC BUILD — remove this whole block + the modal once the iPad
// login issue is pinned down. Bump the tag on every deploy so a screenshot proves
// which build the device actually loaded (rules out Safari caching an old page).
const BUILD_TAG = "diag-2026-07-11c";

// localStorage is where supabase-js persists the session. In Safari Private
// Browsing or with cookies/storage blocked, writes throw or are dropped — login
// then "succeeds" but bounces straight back to /login with empty fields.
function storageWorks(): boolean {
  try {
    const k = "__bento_probe__";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

// Snapshot of the device/browser state — every report starts with this.
function envLines(): string[] {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  let sbKeys = "?";
  try {
    sbKeys =
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase") || k.includes("auth"))
        .join(", ") || "（无）";
  } catch (e: any) {
    sbKeys = `读取异常: ${e?.message ?? e}`;
  }
  return [
    `构建 build: ${BUILD_TAG}`,
    `时间 time: ${new Date().toString()}`,
    `网址 url: ${typeof location !== "undefined" ? location.href : "?"}`,
    `联网 online: ${(nav as any).onLine}`,
    `Cookie启用: ${(nav as any).cookieEnabled}`,
    `本地存储 storage: ${storageWorks() ? "可用 ok" : "被阻断 BLOCKED"}`,
    `已存登录键 sb-keys: ${sbKeys}`,
    `UA: ${(nav as any).userAgent ?? "?"}`,
  ];
}

export default function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // TEMP: full-screen diagnostic report. Non-null → modal is shown. `ok` decides
  // header color (green success vs red problem) and whether "continue" appears.
  const [report, setReport] = useState<{ lines: string[]; ok: boolean } | null>(null);

  // Uncontrolled inputs (ref + read at submit). iPad/iOS Safari (iCloud Keychain)
  // autofills without firing React's onChange; with controlled inputs a re-render
  // would then wipe the autofilled text back to empty. Uncontrolled keeps it.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Catch ANY mysterious failure (crashes outside the submit flow) and surface it
  // in the same modal — nothing fails silently.
  useEffect(() => {
    const onErr = (ev: ErrorEvent) =>
      setReport({
        ok: false,
        lines: ["【全局 JS 错误 window.onerror】", ...envLines(), `error: ${ev.message}`, `位置: ${ev.filename}:${ev.lineno}:${ev.colno}`],
      });
    const onRej = (ev: PromiseRejectionEvent) => {
      const r: any = ev.reason;
      setReport({
        ok: false,
        lines: ["【未处理的 Promise 拒绝 unhandledrejection】", ...envLines(), `reason: ${r?.message ?? String(r)}`, `stack: ${r?.stack ?? "无"}`],
      });
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
    // Invite link: /login?invite=1&email=… → prefill email, default to sign-up.
    const params = new URLSearchParams(window.location.search);
    const inviteEmail = params.get("email");
    if (inviteEmail && emailRef.current) emailRef.current.value = inviteEmail;
    if (params.get("invite") === "1") setMode("signup");
  }, [router]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const lines: string[] = ["【登录诊断 Login diagnostic】", ...envLines()];
    const emailVal = (emailRef.current?.value ?? "").trim();
    const passwordVal = passwordRef.current?.value ?? "";
    lines.push(`邮箱是否填入: ${emailVal ? `是 → ${emailVal}` : "否（空）"}`);
    lines.push(`密码是否填入: ${passwordVal ? `是 → ${passwordVal.length} 位` : "否（空）"}`);

    if (!emailVal || !passwordVal) {
      lines.push("结论: 邮箱或密码为空，未提交。");
      setMsg(t(T.needCreds));
      setReport({ ok: false, lines });
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        lines.push("→ 调用 signUp …");
        const { error } = await supabase.auth.signUp({ email: emailVal, password: passwordVal });
        if (error) {
          lines.push(`signUp 失败: ${error.message}`);
          setReport({ ok: false, lines });
          return;
        }
        const { data } = await supabase.auth.getSession();
        lines.push(`signUp 成功, getSession: ${data.session ? "有 session" : "无 session（可能需邮箱验证）"}`);
        setReport({ ok: !!data.session, lines });
        if (!data.session) setMsg(t(T.signupOk));
        return;
      }

      lines.push("→ 调用 signInWithPassword …");
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      });
      if (error) {
        lines.push(`❌ 登录失败: ${error.message} (status ${(error as any).status ?? "?"})`);
        lines.push("→ 多半是邮箱/密码不对（这台设备钥匙串可能存了旧密码）。");
        setReport({ ok: false, lines });
        return;
      }
      lines.push(`✅ signInWithPassword 成功, 返回 session: ${signInData.session ? "有" : "无"}`);

      // Did the session actually land in storage? (the real iPad failure mode)
      const { data: after } = await supabase.auth.getSession();
      lines.push(`登录后 getSession(): ${after.session ? "有 session" : "❌ 无 session（没存住！）"}`);
      lines.push(`登录后 storage: ${storageWorks() ? "可用" : "❌ 被阻断"}`);
      lines.push(...envLines().filter((l) => l.startsWith("已存登录键")));

      if (!after.session) {
        lines.push("结论: 登录成功但登录态存不住 → 进后台会被立刻退回本页。");
        lines.push("→ 关闭 Safari「无痕浏览」+「阻止跨网站跟踪/屏蔽所有Cookie」后重试。");
        setReport({ ok: false, lines });
        return;
      }

      lines.push("结论: 一切正常 ✅ 可进入后台（点下方绿色按钮）。");
      setReport({ ok: true, lines });
      // NOTE: do NOT auto-redirect — we want the success report visible/screenshot-able.
      // The "继续进入后台" button performs the redirect.
    } catch (e: any) {
      lines.push(`💥 异常 exception: ${e?.message ?? String(e)}`);
      lines.push(`stack: ${e?.stack ?? "无"}`);
      setMsg(e?.message ?? t(T.genericErr));
      setReport({ ok: false, lines });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-t from-emerald-200 via-emerald-50 to-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 text-lg shadow-sm">🍱</div>
            <span className="text-lg font-bold tracking-tight text-slate-900">BentoOS</span>
          </div>
          <LangToggle />
        </div>

        <div className="card p-6">
          <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              className={`flex-1 rounded-md min-h-11 py-1.5 ${mode === "signin" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setMode("signin")}
            >
              {t(T.signin)}
            </button>
            <button
              className={`flex-1 rounded-md min-h-11 py-1.5 ${mode === "signup" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setMode("signup")}
            >
              {t(T.signup)}
            </button>
          </div>

          <form onSubmit={submit}>
            <label className="label">{t(T.email)}</label>
            <input
              ref={emailRef}
              className="input mb-3"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@example.com"
            />
            <label className="label">{t(T.password)}</label>
            <input
              ref={passwordRef}
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t(T.pwPlaceholder)}
            />

            {msg && <div className="mt-3 text-sm text-amber-700">{msg}</div>}

            {/* type="submit" → iPad keyboard "return/Go" and taps both fire the form.
                Only disabled while a request is in flight (not on empty state, which
                autofill leaves stale). */}
            <button className="btn-primary mt-4 w-full" type="submit" disabled={busy}>
              {busy ? t(T.wait) : mode === "signin" ? t(T.ctaSignin) : t(T.ctaSignup)}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">{t(T.footer)}</p>
        <p className="mt-1 text-center text-[10px] text-slate-400">{BUILD_TAG}</p>
      </div>

      {/* ⚠️ TEMP diagnostic modal — pops up on EVERY sign-in attempt (success or
          failure) and on any global JS error. Screenshot it and send to support.
          Remove together with BUILD_TAG / envLines / report state once resolved. */}
      {report && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className={`px-4 py-3 text-center text-base font-bold text-white ${report.ok ? "bg-emerald-600" : "bg-red-600"}`}>
              {report.ok ? "✅ 登录诊断（成功）" : "⚠️ 登录诊断（有问题）"}
              <div className="text-xs font-normal opacity-90">请把这个框截图发给技术 · Screenshot this</div>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-800">
                {report.lines.join("\n")}
              </pre>
            </div>
            <div className="flex gap-2 border-t border-slate-200 p-3">
              <button
                className="flex-1 rounded-lg bg-slate-200 py-2.5 text-sm font-medium text-slate-800"
                onClick={() => setReport(null)}
              >
                关闭 Close
              </button>
              {report.ok && (
                <button
                  className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white"
                  onClick={() => router.replace("/app")}
                >
                  继续进入后台 →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
