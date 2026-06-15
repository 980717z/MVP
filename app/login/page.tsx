"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is OFF, a session is returned immediately.
        const { data } = await supabase.auth.getSession();
        if (data.session) router.replace("/");
        else setMsg("注册成功。如开启了邮箱验证，请查收邮件后再登录。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
      }
    } catch (e: any) {
      setMsg(e.message ?? "出错了");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand font-bold text-white">A</div>
          <span className="text-lg font-semibold">Alpine · 商家系统平台</span>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              className={`flex-1 rounded-md py-1.5 ${mode === "signin" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setMode("signin")}
            >
              登录
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 ${mode === "signup" ? "bg-white font-medium shadow-sm" : "text-ink-faint"}`}
              onClick={() => setMode("signup")}
            >
              注册
            </button>
          </div>

          <label className="label">邮箱</label>
          <input
            className="input mb-3"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label className="label">密码</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="至少 6 位"
          />

          {msg && <div className="mt-3 text-sm text-amber-700">{msg}</div>}

          <button className="btn-primary mt-4 w-full" onClick={submit} disabled={busy || !email || !password}>
            {busy ? "请稍候…" : mode === "signin" ? "登录" : "注册并登录"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          演示环境。注册即创建你的商家账号。
        </p>
      </div>
    </main>
  );
}
