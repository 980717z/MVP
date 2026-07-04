import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────
//  Staff-invite email. HARDENED (platform review P1):
//  • Requires the caller's Supabase JWT (Authorization: Bearer) and verifies
//    the caller OWNS the tenant they're inviting for.
//  • The invite URL is built SERVER-SIDE from our own origin — clients can no
//    longer supply an arbitrary link (open-relay/phishing vector closed).
//  • Field length caps. Absent/invalid auth → 401, not an email.
// ─────────────────────────────────────────────────────────────────────────

const ORIGIN = "https://bentoos.io";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "server not configured" }, { status: 500 });

  // 1) authenticate the caller
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: auth, error: authErr } = await db.auth.getUser(jwt);
  const uid = auth?.user?.id;
  if (authErr || !uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // 2) parse + cap inputs
  let d: { email?: string; slug?: string; inviterEmail?: string; lang?: string };
  try {
    d = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const email = (d.email ?? "").trim().toLowerCase().slice(0, 200);
  const slug = (d.slug ?? "").trim().slice(0, 60);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !slug) {
    return NextResponse.json({ ok: false, error: "invalid email or slug" }, { status: 400 });
  }

  // 3) caller must own the tenant
  const { data: tenant } = await db.from("tenants").select("owner_id, name").eq("slug", slug).maybeSingle();
  if (!tenant || tenant.owner_id !== uid) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 4) build the invite link ourselves — never from client input
  const inviteUrl = `${ORIGIN}/login?invite=1&email=${encodeURIComponent(email)}`;

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM || "BentoOS <onboarding@resend.dev>";
  if (!resendKey) return NextResponse.json({ ok: true, emailed: false, reason: "no RESEND_API_KEY" });

  const shop = (tenant.name as any)?.zh || (tenant.name as any)?.en || slug;
  const zh = (d.lang ?? "").startsWith("zh");
  const inviter = (d.inviterEmail ?? auth.user?.email ?? "").slice(0, 200);
  const subject = zh ? `邀请你加入 ${shop} 的 BentoOS 后台` : `You're invited to ${shop} on BentoOS`;
  const cta = zh ? "设置密码并登录" : "Set your password & sign in";
  const intro = zh
    ? `${esc(inviter)} 邀请你协助管理 ${esc(shop)} 的后台。点击下方按钮，用本邮箱注册并设置密码即可登录。`
    : `${esc(inviter)} invited you to help run ${esc(shop)} on BentoOS. Sign up with this email and set a password to get in.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1A1D1B">
    <h2 style="margin:0 0 12px">${esc(subject)}</h2>
    <p style="color:#5B635E;line-height:1.5">${intro}</p>
    <p style="margin:18px 0"><a href="${esc(inviteUrl)}" style="display:inline-block;background:#0E9F6E;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:700">${cta}</a></p>
    <p style="color:#8E948F;font-size:12px;word-break:break-all">${esc(inviteUrl)}</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from, to: email, subject, html, text: `${inviter} — ${inviteUrl}` }),
    });
    if (!res.ok) console.error("[invite] resend failed:", res.status, await res.text());
    return NextResponse.json({ ok: true, emailed: res.ok });
  } catch (e) {
    console.error("[invite] resend error:", e);
    return NextResponse.json({ ok: true, emailed: false });
  }
}
