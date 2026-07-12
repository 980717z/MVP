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
  storageBlocked: {
    en: "Your browser is blocking sign-in from being saved. Turn off Private Browsing and \"Prevent Cross-Site Tracking\" (Settings → Safari), then try again.",
    zh: "浏览器阻止了登录状态的保存，导致登录后又被退回。请关闭 Safari 的「无痕浏览」，并在「设置 → Safari」里关掉「阻止跨网站跟踪 / 屏蔽所有 Cookie」，然后重试。",
    fr: "Votre navigateur empêche l'enregistrement de la connexion. Désactivez la navigation privée et « Empêcher le suivi intersites » (Réglages → Safari), puis réessayez.",
  },
};

// localStorage is where supabase-js persists the session. In Safari Private
// Browsing or with cookies/storage blocked, writes throw or are dropped — login
// then "succeeds" but bounces straight back to /login with empty fields. Detect
// it so we can tell the user instead of looping silently.
const BUILD_TAG = "diag-2026-07-11a";

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

export default function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // TEMP diagnostic line (remove once the iPad login issue is resolved). Proves
  // which build is loaded + whether this device can persist a session, so a
  // single screenshot tells us the state without a Mac/Web Inspector.
  const [diag, setDiag] = useState<string>("");
  // Uncontrolled inputs (ref + read at submit). iPad/iOS Safari (iCloud Keychain)
  // autofills without firing React's onChange; with controlled inputs a re-render
  // would then wipe the autofilled text back to empty state. Uncontrolled keeps it.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
    // Warn up front if the browser won't persist the session (private mode etc.).
    const stg = storageWorks();
    if (!stg) setMsg(t(T.storageBlocked));
    setDiag(`build:${BUILD_TAG} · storage:${stg ? "ok" : "BLOCKED"}`);
    // Invite link: /login?invite=1&email=… → prefill email, default to sign-up.
    const params = new URLSearchParams(window.location.search);
    const inviteEmail = params.get("email");
    if (inviteEmail && emailRef.current) emailRef.current.value = inviteEmail;
    if (params.get("invite") === "1") setMode("signup");
  }, [router, t]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const emailVal = (emailRef.current?.value ?? "").trim();
    const passwordVal = passwordRef.current?.value ?? "";
    if (!emailVal || !passwordVal) {
      setMsg(t(T.needCreds));
      return;
    }
    // If storage is blocked, login would succeed then bounce back. Stop early
    // with a clear instruction rather than looping.
    if (!storageWorks()) {
      setMsg(t(T.storageBlocked));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: emailVal, password: passwordVal });
        if (error) throw error;
        // If email confirmation is OFF, a session is returned immediately.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await claimInvites(); // link any pending staff invites for this email
          router.replace("/app");
        } else {
          setMsg(t(T.signupOk));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailVal, password: passwordVal });
        if (error) {
          setDiag(`build:${BUILD_TAG} · signin:ERR(${error.message})`);
          throw error;
        }
        // Confirm the session actually landed in storage before redirecting; if
        // not, the /app guard would bounce us right back to an empty login form.
        const { data } = await supabase.auth.getSession();
        setDiag(`build:${BUILD_TAG} · signin:ok · session:${data.session ? "yes" : "NONE"} · storage:${storageWorks() ? "ok" : "BLOCKED"}`);
        if (!data.session) {
          setMsg(t(T.storageBlocked));
          return;
        }
        await claimInvites();
        router.replace("/app");
      }
    } catch (e: any) {
      setMsg(e.message ?? t(T.genericErr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
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
        {/* TEMP: remove once iPad login is fixed. Screenshot this line to diagnose. */}
        {diag && <p className="mt-2 break-all text-center text-[10px] text-slate-400">{diag}</p>}
      </div>
    </main>
  );
}
