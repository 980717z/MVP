import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Invite = {
  email?: string;
  tenantName?: string;
  inviteUrl?: string;
  inviterEmail?: string;
  lang?: string;
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  let d: Invite;
  try {
    d = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  if (!d.email?.trim() || !d.inviteUrl?.trim()) {
    return NextResponse.json({ ok: false, error: "missing email or inviteUrl" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM || "BentoOS <onboarding@resend.dev>";
  if (!resendKey) {
    // No mail configured — caller still has the copyable invite link as a fallback.
    return NextResponse.json({ ok: true, emailed: false, reason: "no RESEND_API_KEY" });
  }

  const shop = d.tenantName || "the team";
  const zh = (d.lang ?? "").startsWith("zh");
  const subject = zh ? `邀请你加入 ${shop} 的 BentoOS 后台` : `You're invited to ${shop} on BentoOS`;
  const cta = zh ? "设置密码并登录" : "Set your password & sign in";
  const intro = zh
    ? `${esc(d.inviterEmail || "")} 邀请你协助管理 ${esc(shop)} 的后台。点击下方按钮，用本邮箱注册并设置密码即可登录。`
    : `${esc(d.inviterEmail || "")} invited you to help run ${esc(shop)} on BentoOS. Sign up with this email and set a password to get in.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1A1D1B">
    <h2 style="margin:0 0 12px">${esc(subject)}</h2>
    <p style="color:#5B635E;line-height:1.5">${intro}</p>
    <p style="margin:18px 0"><a href="${esc(d.inviteUrl)}" style="display:inline-block;background:#0E9F6E;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:700">${cta}</a></p>
    <p style="color:#8E948F;font-size:12px;word-break:break-all">${esc(d.inviteUrl)}</p>
  </div>`;
  const text = `${zh ? d.inviterEmail + " 邀请你加入 " + shop : (d.inviterEmail || "") + " invited you to " + shop}\n\n${d.inviteUrl}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from, to: d.email, subject, html, text }),
    });
    if (!res.ok) console.error("[invite] resend failed:", res.status, await res.text());
    return NextResponse.json({ ok: true, emailed: res.ok, status: res.status });
  } catch (e) {
    console.error("[invite] resend error:", e);
    return NextResponse.json({ ok: true, emailed: false, error: String(e) });
  }
}
