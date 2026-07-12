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

export default function Login() {
  const router = useRouter();
  const { t } = useLang();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // iPad/iOS Safari (iCloud Keychain) autofills the fields without firing React's
  // onChange, leaving email/password state empty → the button would stay disabled
  // and taps do nothing. Read the live DOM values from refs at submit as a fallback.
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
    // Invite link: /login?invite=1&email=… → prefill email, default to sign-up.
    const params = new URLSearchParams(window.location.search);
    const inviteEmail = params.get("email");
    if (inviteEmail) setEmail(inviteEmail);
    if (params.get("invite") === "1") setMode("signup");
  }, [router]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    // Prefer the live DOM value (survives autofill); fall back to React state.
    const emailVal = (emailRef.current?.value ?? email).trim();
    const passwordVal = passwordRef.current?.value ?? password;
    if (!emailVal || !passwordVal) {
      setMsg(t(T.needCreds));
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
        if (error) throw error;
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <label className="label">{t(T.password)}</label>
            <input
              ref={passwordRef}
              className="input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
      </div>
    </main>
  );
}
