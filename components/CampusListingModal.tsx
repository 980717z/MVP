"use client";

// Campus-listing editor for /admin (internal, EN-only per the ratified
// platform-admin exception). Reads + writes a vendor's campus_vendors row via
// /api/admin/vendor so listing never needs SQL. Hours here also drive the
// pickup ordering gate, so getting them right matters twice.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hoursStatus, type Hours } from "@/lib/hours";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1";
const DAYS: [string, string][] = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];
const ZONES = ["Spadina", "Robarts", "Bahen / BA", "Sidney Smith", "Con Hall", "Gerstein", "Front Campus"];
const DIETARY: [string, string][] = [["halal", "Halal"], ["veg", "Vegetarian"], ["vegan", "Vegan"], ["gf", "Gluten-free"]];

type DayHours = { open: boolean; from: string; to: string };
type Form = {
  listed: boolean;
  status: "open" | "busy" | "closed";
  zone: string;
  price_band: "$" | "$$" | "$$$";
  dietary: string[];
  cuisine: string;
  hours: Record<string, DayHours>;
};

const blankHours = (): Record<string, DayHours> =>
  Object.fromEntries(DAYS.map(([k]) => [k, { open: k !== "sat" && k !== "sun", from: "11:00", to: "20:00" }]));

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export default function CampusListingModal({ slug, name, onClose, onSaved }: { slug: string; name: string; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/vendor?slug=${encodeURIComponent(slug)}`, { headers: await authHeader() });
        const d = await res.json();
        const v = d.vendor ?? {};
        const hoursIn = (v.hours ?? {}) as Record<string, [string, string][]>;
        const hours = blankHours();
        for (const [k] of DAYS) {
          const r = hoursIn[k]?.[0];
          hours[k] = r ? { open: true, from: r[0], to: r[1] } : { open: false, from: "11:00", to: "20:00" };
        }
        // if the row had no hours at all, keep the sensible Mon-Fri default
        const anyHours = Object.values(hoursIn).some((a) => (a ?? []).length > 0);
        setForm({
          listed: !!v.listed,
          status: STATUS_OK(v.status) ? v.status : "open",
          zone: v.zone || ZONES[0],
          price_band: PRICE_OK(v.price_band) ? v.price_band : "$",
          dietary: Array.isArray(v.dietary_tags) ? v.dietary_tags : [],
          cuisine: Array.isArray(v.cuisine_tags) ? v.cuisine_tags.join(", ") : "",
          hours: anyHours ? hours : blankHours(),
        });
      } catch {
        setErr("Couldn't load this vendor.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const set = <K extends keyof Form>(k: K, val: Form[K]) => setForm((f) => (f ? { ...f, [k]: val } : f));
  const setDay = (day: string, patch: Partial<DayHours>) =>
    setForm((f) => (f ? { ...f, hours: { ...f.hours, [day]: { ...f.hours[day], ...patch } } } : f));
  const copyMonToWeek = () =>
    setForm((f) => {
      if (!f) return f;
      const mon = f.hours.mon;
      const hours = { ...f.hours };
      for (const [k] of DAYS) if (k !== "sat" && k !== "sun") hours[k] = { ...mon };
      return { ...f, hours };
    });

  const menuUrl = useMemo(() => (typeof window !== "undefined" ? `${window.location.origin}/menu/${slug}?m=pickup` : ""), [slug]);
  const eatUrl = useMemo(() => (typeof window !== "undefined" ? `${window.location.origin}/eat` : ""), []);
  const backOfficeUrl = useMemo(() => (typeof window !== "undefined" ? `${window.location.origin}/${slug}` : ""), [slug]);

  // A day toggled open whose end is not after its start would silently save as
  // "closed" (a real trap on the field that gates ordering) — flag it, block save.
  const invalidDays = form ? DAYS.filter(([k]) => { const d = form.hours[k]; return d.open && !(d.to > d.from); }).map(([k]) => k) : [];
  // Live "right now" status, computed from the hours BEING EDITED via the same
  // pure fn the ordering gate uses — so the preview can never diverge from
  // enforcement. Recomputed each render (cheap, keeps the clock honest).
  const live = useMemo(() => {
    if (!form) return null;
    const h: Hours = {};
    for (const [k] of DAYS) { const d = form.hours[k]; h[k] = d.open && d.to > d.from ? [[d.from, d.to]] : []; }
    return hoursStatus(h, new Date());
  }, [form]);

  const save = async () => {
    if (!form) return;
    setErr(""); setSaving(true); setSaved(false);
    if (invalidDays.length) {
      setErr("Fix the days marked in red (end time must be after start)."); setSaving(false); return;
    }
    const hours: Record<string, [string, string][]> = {};
    for (const [k] of DAYS) {
      const d = form.hours[k];
      hours[k] = d.open && d.to > d.from ? [[d.from, d.to]] : [];
    }
    if (form.listed && Object.values(hours).every((r) => r.length === 0)) {
      setErr("Set at least one open day before listing (hours gate ordering)."); setSaving(false); return;
    }
    try {
      const res = await fetch("/api/admin/vendor", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({
          slug,
          patch: {
            listed: form.listed, status: form.status, zone: form.zone, price_band: form.price_band,
            dietary_tags: form.dietary, cuisine_tags: form.cuisine.split(",").map((s) => s.trim()).filter(Boolean), hours,
          },
        }),
      });
      const d = await res.json();
      if (!d.ok) { setErr(d.error || "Save failed."); return; }
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSaving(false);
    }
  };

  const Pill = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-slate-50 ${focusRing}`}>
      {children} ↗
    </a>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Campus listing</h2>
            <p className="text-xs text-ink-faint">{name} · {slug}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className={`grid h-9 w-9 place-items-center rounded-lg text-xl leading-none text-ink-faint hover:bg-slate-50 ${focusRing}`}>✕</button>
        </div>

        {/* one-click previews — available regardless of load state */}
        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          <Pill href={menuUrl}>Preview ordering menu</Pill>
          <Pill href={eatUrl}>Campus directory</Pill>
          <Pill href={backOfficeUrl}>Back-office</Pill>
        </div>

        {loading || !form ? (
          <div className="flex-1 px-5 py-10 text-center text-sm text-ink-faint">{err || "Loading…"}</div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* listed toggle */}
              <label className="flex items-center justify-between">
                <span>
                  <span className="text-sm font-semibold text-ink">Listed on /eat</span>
                  <span className="block text-xs text-ink-faint">Show this vendor in the student directory</span>
                </span>
                <button
                  role="switch" aria-checked={form.listed} onClick={() => set("listed", !form.listed)}
                  className={`inline-flex h-7 w-12 flex-none items-center rounded-full px-0.5 transition ${focusRing} ${form.listed ? "justify-end bg-brand" : "justify-start bg-slate-300"}`}
                >
                  <span className="h-6 w-6 rounded-full bg-white shadow" />
                </button>
              </label>

              {/* status */}
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink">Status now</div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                  {(["open", "busy", "closed"] as const).map((s) => (
                    <button key={s} onClick={() => set("status", s)} className={`min-h-11 rounded-md px-3.5 text-sm font-medium capitalize transition ${focusRing} ${form.status === s ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}>{s}</button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-faint">Hours below still auto-close it outside open times.</p>
              </div>

              {/* hours */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Hours <span className="font-normal text-ink-faint">(Toronto)</span></span>
                  <button onClick={copyMonToWeek} className={`text-xs font-semibold text-brand-ink hover:underline ${focusRing}`}>Copy Mon → weekdays</button>
                </div>
                <div className="space-y-1.5">
                  {DAYS.map(([k, label]) => {
                    const d = form.hours[k];
                    const bad = d.open && !(d.to > d.from);
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <button onClick={() => setDay(k, { open: !d.open })} className={`min-h-11 w-14 rounded-md border text-xs font-semibold transition ${focusRing} ${d.open ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-faint"}`}>{label}</button>
                        {d.open ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <input type="time" value={d.from} onChange={(e) => setDay(k, { from: e.target.value })} className={`min-h-11 rounded-md border px-2 text-sm ${bad ? "border-red-400" : "border-slate-300"}`} />
                            <span className="text-ink-faint">to</span>
                            <input type="time" value={d.to} onChange={(e) => setDay(k, { to: e.target.value })} className={`min-h-11 rounded-md border px-2 text-sm ${bad ? "border-red-400" : "border-slate-300"}`} />
                            {bad && <span className="text-xs font-medium text-red-600">end &gt; start</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-ink-faint">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Live result of the hours above — the same fn that gates
                    ordering, so what you see is what students get. */}
                {live && !live.unconfigured && (
                  <p className={`mt-2 text-xs font-medium ${live.open ? "text-brand-ink" : "text-amber-700"}`}>
                    {live.open
                      ? `🟢 Right now: Open${live.closesAt ? ` · closes ${live.closesAt}` : ""}`
                      : `⏸ Right now: Closed${live.opensAt ? ` · opens ${live.opensAt}` : ""}`}
                  </p>
                )}
              </div>

              {/* zone + price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-ink">Zone</div>
                  <select value={form.zone} onChange={(e) => set("zone", e.target.value)} className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${focusRing}`}>
                    {ZONES.map((z) => <option key={z} value={z}>St. George — {z}</option>)}
                    {!ZONES.includes(form.zone) && form.zone && <option value={form.zone}>{form.zone}</option>}
                  </select>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-semibold text-ink">Price</div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                    {(["$", "$$", "$$$"] as const).map((p) => (
                      <button key={p} onClick={() => set("price_band", p)} className={`min-h-11 rounded-md px-3.5 text-sm font-medium transition ${focusRing} ${form.price_band === p ? "bg-brand-wash text-brand-ink" : "text-ink-soft hover:bg-slate-50"}`}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* dietary */}
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink">Dietary tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY.map(([k, label]) => {
                    const on = form.dietary.includes(k);
                    return (
                      <button key={k} onClick={() => set("dietary", on ? form.dietary.filter((t) => t !== k) : [...form.dietary, k])} className={`min-h-11 rounded-full border px-3.5 text-sm font-medium transition ${focusRing} ${on ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"}`}>{on ? "✓ " : ""}{label}</button>
                    );
                  })}
                </div>
              </div>

              {/* cuisine */}
              <div>
                <div className="mb-1.5 text-xs font-semibold text-ink">Cuisine tags <span className="font-normal text-ink-faint">(comma-separated)</span></div>
                <input value={form.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="shawarma, middle-eastern" className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${focusRing}`} />
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
              <button onClick={save} disabled={saving || invalidDays.length > 0} className={`btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
                {saving ? "Saving…" : saved ? "✓ Saved" : "Save listing"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function STATUS_OK(s: unknown): s is "open" | "busy" | "closed" { return s === "open" || s === "busy" || s === "closed"; }
function PRICE_OK(s: unknown): s is "$" | "$$" | "$$$" { return s === "$" || s === "$$" || s === "$$$"; }
