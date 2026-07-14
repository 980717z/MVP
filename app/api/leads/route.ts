import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Lead = {
  business_name?: string;
  business_type?: string;
  email?: string;
  phone?: string;
  locations?: string;
  modules?: string[];
  notes?: string;
  lang?: string;
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: Request) {
  let d: Lead;
  try {
    d = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (!d.business_name?.trim() || !d.email?.trim()) {
    return NextResponse.json({ ok: false, error: "missing business_name or email" }, { status: 400 });
  }

  let stored = false;
  let emailed = false;
  let emailStatus: number | null = null;
  let emailId: string | null = null;

  // 1) Persist to Supabase (anon insert allowed by RLS — see supabase/leads.sql)
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    try {
      const res = await fetch(`${sbUrl}/rest/v1/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          business_name: d.business_name,
          business_type: d.business_type ?? null,
          email: d.email,
          phone: d.phone || null,
          locations: d.locations ?? null,
          modules: d.modules ?? [],
          notes: d.notes || null,
          lang: d.lang ?? null,
        }),
      });
      stored = res.ok;
      if (!res.ok) console.error("[leads] supabase insert failed:", res.status, await res.text());
    } catch (e) {
      console.error("[leads] supabase insert error:", e);
    }
  }

  // 2) Notify by email (Resend HTTP API). Every signup goes to BOTH the shop
  //    inbox and the owner (azhang@alpinedd.com) — guaranteed, not env-overridable.
  //    LEADS_TO (comma-separated) can add extra recipients on top.
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM || "BentoOS Leads <onboarding@resend.dev>";
  const recipients = [
    ...new Set([
      "support@bentoos.io",
      "azhang@alpinedd.com",
      ...(process.env.LEADS_TO || "").split(",").map((s) => s.trim()).filter(Boolean),
    ]),
  ];
  const to = recipients.join(", ");

  if (resendKey) {
    const rows: [string, string][] = [
      ["Business", d.business_name || ""],
      ["Type", d.business_type || "—"],
      ["Email", d.email || ""],
      ["Phone", d.phone || "—"],
      ["Locations", d.locations || "—"],
      ["Modules", d.modules && d.modules.length ? d.modules.join(", ") : "—"],
      ["Notes", d.notes || "—"],
      ["Language", d.lang || "—"],
    ];
    const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    const html = `<h2 style="font-family:system-ui,sans-serif">New BentoOS lead</h2>
<table cellpadding="6" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="color:#64748b;vertical-align:top">${k}</td><td><b>${escapeHtml(v)}</b></td></tr>`).join("\n")}
</table>`;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: recipients, reply_to: d.email, subject: `New lead: ${d.business_name}`, text, html }),
      });
      emailStatus = r.status;
      if (r.ok) {
        const j = (await r.json().catch(() => ({}))) as { id?: string };
        emailed = true;
        emailId = j.id ?? null;
        console.log(`[leads] email sent to ${to} (id: ${emailId ?? "?"})`);
      } else {
        console.error("[leads] resend failed:", r.status, await r.text());
      }
    } catch (e) {
      console.error("[leads] email error:", e);
    }
  } else {
    console.warn(`[leads] RESEND_API_KEY not set — email to ${to} skipped`);
  }

  return NextResponse.json({ ok: true, stored, emailed, emailStatus, emailId });
}
