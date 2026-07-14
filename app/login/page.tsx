"use client";

import { useEffect, useRef, useState } from "react";
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
  demoHint: {
    en: "Demo account filled in — just tap Sign in to explore the back office.",
    zh: "演示账号已填好 —— 直接点「登录」即可体验后台。",
    fr: "Compte démo pré-rempli — appuyez sur « Se connecter » pour explorer.",
  },
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

export default function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [demo, setDemo] = useState(false); // ?demo=1 → prefill the public demo account
  // Uncontrolled inputs (ref + read at submit). iPad/iOS Safari (iCloud Keychain)
  // autofills without firing React's onChange; with controlled inputs a re-render
  // would then wipe the autofilled text back to empty. Uncontrolled keeps it.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
    // Invite link: /login?invite=1&email=… → prefill email, default to sign-up.
    const params = new URLSearchParams(window.location.search);
    const inviteEmail = params.get("email");
    if (inviteEmail && emailRef.current) emailRef.current.value = inviteEmail;
    if (params.get("invite") === "1") setMode("signup");
    // Public demo entrance (utoronto landing): /login?demo=1 → prefill the shared
    // demo merchant so a vendor can tap straight into the real back office.
    if (params.get("demo") === "1") {
      setDemo(true);
      setMode("signin");
      if (emailRef.current) emailRef.current.value = "demo@bentoos.io";
      if (passwordRef.current) passwordRef.current.value = "demo123";
    }
  }, [router]);

  const submit = async () => {
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
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await claimInvites(); // link any pending staff invites for this email
          router.replace("/app");
        } else {
          setMsg(t(T.signupOk));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: emailVal, password: passwordVal });
        if (error) throw error;
        // Confirm the session actually persisted before redirecting; if not, the
        // /app guard would bounce us right back to an empty login form.
        const { data } = await supabase.auth.getSession();
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

          {demo && (
            <div className="mb-3 rounded-lg bg-brand-wash px-3 py-2 text-center text-xs font-medium text-brand-ink">
              🎬 {t(T.demoHint)}
            </div>
          )}

          {/* No <form>: a native form submit reloads the page (GET with the creds in
              the URL) if a tap lands before React hydrates — which never reaches
              Supabase and looks like "it just refreshes". Plain button + explicit
              onClick means a pre-hydration tap does nothing; Enter is handled here. */}
          <div>
            <label className="label">{t(T.email)}</label>
            <input
              ref={emailRef}
              className="input mb-3"
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@example.com"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <label className="label">{t(T.password)}</label>
            <input
              ref={passwordRef}
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t(T.pwPlaceholder)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />

            {msg && <div className="mt-3 text-sm text-amber-700">{msg}</div>}

            <button className="btn-primary mt-4 w-full" type="button" onClick={() => submit()} disabled={busy}>
              {busy ? t(T.wait) : mode === "signin" ? t(T.ctaSignin) : t(T.ctaSignup)}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">{t(T.footer)}</p>
      </div>
    </main>
  );
}
