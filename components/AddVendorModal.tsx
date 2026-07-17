"use client";

// Add-vendor flow for /admin (approved mockup A, /plan-design-review 2026-07-16).
// English-only, consistent with the /admin EN-only decision. The form collects
// the vendor identity + handle (live availability), then POSTs to
// /api/admin/provision which returns REVIEWABLE SQL to paste into Supabase —
// provisioning stays SQL-gated by design (QR contract). The handle carries a
// permanence warning because printed QR signs bake in /menu/<slug> forever.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1";
const input = `w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand ${focusRing}`;

// St. George grouping labels for the campus directory (editable later).
const ZONES = ["Spadina", "Robarts", "Bahen / BA", "Sidney Smith", "Con Hall", "Gerstein", "Front Campus"];

type Avail = { state: "idle" | "checking" | "ok" | "bad"; reason?: string };
type Result = { sql: string; menuUrl: string; backOfficeUrl: string; ownerEmail: string; slug: string };

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export default function AddVendorModal({ onClose, onProvisioned }: { onClose: () => void; onProvisioned: () => void }) {
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [slug, setSlug] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [avail, setAvail] = useState<Avail>({ state: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState<"" | "sql" | "link">("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live handle availability (debounced). Server checks format + reserved + taken.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const s = slug.trim();
    if (s.length < 3) { setAvail({ state: "idle" }); return; }
    setAvail({ state: "checking" });
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/provision?check=${encodeURIComponent(s)}`, { headers: await authHeader() });
        const d = await res.json();
        setAvail(d.available ? { state: "ok" } : { state: "bad", reason: d.reason });
      } catch {
        setAvail({ state: "idle" });
      }
    }, 450);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [slug]);

  const onSlug = (v: string) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));

  const provision = async () => {
    setErr("");
    if (!(nameZh.trim() || nameEn.trim())) { setErr("Enter the shop name."); return; }
    if (avail.state !== "ok") { setErr("Pick an available handle first."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ name_en: nameEn, name_zh: nameZh, slug, zone, ownerEmail }),
      });
      const d = await res.json();
      if (!d.ok) { setErr(d.error || "Couldn't build the provisioning SQL."); return; }
      setResult(d as Result);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async (text: string, which: "sql" | "link") => {
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(""), 2000); } catch { /* visible in the box */ }
  };

  const availLine = () => {
    if (avail.state === "checking") return <span className="text-ink-faint">checking…</span>;
    if (avail.state === "ok") return <span className="font-semibold text-brand-ink">✓ available</span>;
    if (avail.state === "bad") {
      const msg = avail.reason === "taken" ? "already in use" : avail.reason === "reserved" ? "reserved word" : avail.reason === "format" ? "3–30 chars, a–z 0–9 and hyphens" : "unavailable";
      return <span className="font-semibold text-red-600">{msg}</span>;
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-ink">{result ? "Provision this vendor" : "Add a vendor"}</h2>
          <button onClick={onClose} aria-label="Close" className={`grid h-9 w-9 place-items-center rounded-lg text-xl leading-none text-ink-faint hover:bg-slate-50 ${focusRing}`}>✕</button>
        </div>

        {!result ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-4 text-xs text-ink-soft">Provisions the menu, QR ordering and back-office in one step.</p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Shop name</label>
                  <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="e.g. Fu Lai Noodle Bar" className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Chinese name <span className="font-normal text-ink-faint">(optional)</span></label>
                  <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder="例如 福来面家" className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">URL handle</label>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand">
                    <span className="flex items-center bg-slate-50 px-3 text-sm text-ink-faint">bentoos.io/menu/</span>
                    <input value={slug} onChange={(e) => onSlug(e.target.value)} placeholder="fu-lai" className="min-w-0 flex-1 px-2 py-2.5 text-sm text-ink outline-none" />
                    <span className="flex items-center pr-3 text-xs">{availLine()}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-700">⚠ Permanent. Printed QR signs use this URL; it can’t be renamed.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Campus zone</label>
                  <select value={zone} onChange={(e) => setZone(e.target.value)} className={input}>
                    {ZONES.map((z) => <option key={z} value={z}>St. George — {z}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Owner email <span className="font-normal text-ink-faint">(optional, invite them later)</span></label>
                  <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} inputMode="email" placeholder="owner@truck.ca" className={input} />
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-ink">What gets created</div>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                  {["QR menu page", "Back-office login (you own it; invite the vendor later)", "Campus directory listing (off until they opt in)"].map((x) => (
                    <li key={x} className="flex items-center gap-2"><span aria-hidden className="text-brand">✓</span>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4">
              {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
              <button onClick={provision} disabled={submitting || avail.state !== "ok"} className={`btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
                {submitting ? "Building…" : "Provision vendor"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-lg bg-brand-wash/60 px-3 py-2.5 text-sm text-brand-ink">
                Ready to provision <b>{result.slug}</b>. It goes live once you run the SQL below.
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">1 · Paste into Supabase → SQL Editor → Run</span>
                  <button onClick={() => copy(result.sql, "sql")} className={`rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-50 ${focusRing}`}>
                    {copied === "sql" ? "✓ Copied" : "Copy SQL"}
                  </button>
                </div>
                <pre className="max-h-52 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-ink-soft">{result.sql}</pre>
                <p className="mt-1 text-xs text-ink-faint">Read it first; it’s the whole change. Idempotent, safe to re-run.</p>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">2 · Once it’s run, the vendor is live at</span>
                  <button onClick={() => copy(result.menuUrl, "link")} className={`rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-slate-50 ${focusRing}`}>
                    {copied === "link" ? "✓ Copied" : "Copy link"}
                  </button>
                </div>
                <div className="truncate rounded-lg border border-slate-200 px-3 py-2 text-sm text-brand-ink">{result.menuUrl}</div>
                <p className="mt-1.5 text-xs text-ink-faint">Print the table/pickup QR from the vendor’s <b>QR Code Menu</b> module in the back-office.</p>
                {result.ownerEmail && <p className="mt-1.5 text-xs text-ink-faint">Invite <b>{result.ownerEmail}</b> to the back-office from Members once they have an account.</p>}
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
              <button onClick={() => { setResult(null); setNameEn(""); setNameZh(""); setSlug(""); setOwnerEmail(""); setAvail({ state: "idle" }); }} className={`rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-slate-50 ${focusRing}`}>
                Provision another
              </button>
              <button onClick={() => { onProvisioned(); onClose(); }} className={`btn-primary flex-1 text-sm ${focusRing}`}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
