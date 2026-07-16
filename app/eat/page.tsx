"use client";

// /eat — campus marketplace "what to eat today" discovery view (Phase 1).
// Reads the public directory via get_campus_directory (effective status computed
// server-side). App-UI surface on the DESIGN-PLATFORM emerald brand; mobile-first.
// Design decisions locked in /plan-design-review 2026-07-15 (card hierarchy,
// status-chip language, ghost-town empty state, opt-in geolocation walk times).
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLang, LangToggle, type Dict } from "@/app/i18n";
import { pickupUrl } from "@/lib/qrContract";
import { BentoMark } from "@/components/BentoMark";
import { track } from "@/lib/track";
import {
  listCampusDirectory,
  walkMinutes,
  nextOpenLabel,
  type CampusVendor,
  type EffectiveStatus,
} from "@/lib/marketplace";

const SHELL_FONT =
  '"Plus Jakarta Sans","Noto Sans SC",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';

const T = {
  title: { zh: "今天吃什么", en: "What to eat today", fr: "Que manger aujourd'hui" },
  campus: { zh: "圣乔治校区", en: "St. George", fr: "St. George" },
  openNow: { zh: "现在营业", en: "Open now", fr: "Ouvert" },
  under10: { zh: "$10 以内", en: "Under $10", fr: "Moins de 10 $" },
  halal: { zh: "清真", en: "Halal", fr: "Halal" },
  veg: { zh: "素食", en: "Veg", fr: "Végé" },
  showWalk: { zh: "显示步行时间", en: "Show walk times", fr: "Temps de marche" },
  locating: { zh: "定位中…", en: "Locating…", fr: "Localisation…" },
  statusOpen: { zh: "营业中", en: "Open", fr: "Ouvert" },
  statusBusy: { zh: "繁忙", en: "Busy", fr: "Occupé" },
  waitShort: { zh: "排队短", en: "short wait", fr: "attente courte" },
  waitLong: { zh: "排队长", en: "long wait", fr: "longue attente" },
  soldOut: { zh: "已售罄", en: "Sold out", fr: "Épuisé" },
  opens: { zh: "营业", en: "Opens", fr: "Ouvre" }, // + time label
  walkMin: { zh: "分钟步行", en: "min walk", fr: "min à pied" },
  ghostTitle: { zh: "现在暂无营业", en: "Nothing open right now", fr: "Rien d'ouvert" },
  ghostBody: {
    zh: "校园餐点晚上陆续打烊。以下是接下来的营业时间。",
    en: "Campus eats wind down in the evening. Here's what's back next.",
    fr: "Les cantines ferment le soir. Voici les prochaines ouvertures.",
  },
  backNext: { zh: "接下来营业", en: "Back next", fr: "Prochainement" },
  emptyTitle: { zh: "敬请期待", en: "Vendors coming soon", fr: "Bientôt disponible" },
  emptyBody: {
    zh: "我们正在邀请校园餐车加入,很快见。",
    en: "We're signing up campus trucks now. Check back soon.",
    fr: "Nous recrutons les camions du campus. Revenez bientôt.",
  },
  noMatch: { zh: "没有符合筛选的餐点", en: "No spots match your filters", fr: "Aucun résultat" },
  clearFilters: { zh: "清除筛选", en: "Clear filters", fr: "Effacer" },
  errRetry: { zh: "加载出错,点击重试", en: "Couldn't load — tap to retry", fr: "Erreur — réessayer" },
  poweredBy: { zh: "由 BentoOS 提供", en: "powered by BentoOS", fr: "propulsé par BentoOS" },
} satisfies Record<string, Dict>;

type FilterKey = "openNow" | "under10" | "halal" | "veg";

export default function EatPage() {
  const { t, lang } = useLang();
  const L = (bi: { zh?: string; en?: string; fr?: string } | null | undefined) =>
    bi ? bi[lang] ?? bi.en ?? bi.zh ?? "" : "";

  const [vendors, setVendors] = useState<CampusVendor[] | null>(null); // null = first load
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "on" | "denied">("idle");

  const load = useCallback(async () => {
    const rows = await listCampusDirectory();
    if (rows === null) {
      // Transient failure: keep whatever we last had on screen; only surface the
      // retry UI when we have nothing to show. Never blank the directory.
      setError(true);
      return;
    }
    setVendors(rows);
    setError(false);
  }, []);

  useEffect(() => { track("directory_view"); }, []); // /admin funnel

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const rows = await listCampusDirectory();
      if (!alive) return;
      if (rows === null) setError(true);
      else { setVendors(rows); setError(false); }
    };
    run();
    const iv = setInterval(load, 60_000); // refetch live status ~every minute
    const onFocus = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  const requestGeo = () => {
    if (!("geolocation" in navigator)) { setGeoState("denied"); return; }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState("on"); },
      () => setGeoState("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  };

  const toggle = (k: FilterKey) =>
    setFilters((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const matches = (v: CampusVendor) =>
    (!filters.has("openNow") || v.effective_status === "open" || v.effective_status === "busy") &&
    (!filters.has("under10") || v.price_band === "$") &&
    (!filters.has("halal") || v.dietary_tags.includes("halal")) &&
    (!filters.has("veg") || v.dietary_tags.includes("veg"));

  const filtered = useMemo(() => (vendors ?? []).filter(matches), [vendors, filters]);
  const allClosed =
    (vendors?.length ?? 0) > 0 && vendors!.every((v) => v.effective_status === "closed");

  // zone → vendors (stable order comes from the RPC's ORDER BY zone, slug)
  const zones = useMemo(() => {
    const m = new Map<string, CampusVendor[]>();
    for (const v of filtered) {
      const arr = m.get(v.zone) ?? [];
      arr.push(v);
      m.set(v.zone, arr);
    }
    return [...m.entries()];
  }, [filtered]);

  const now = new Date();

  return (
    <div className="min-h-screen bg-[#FBFAF8] text-ink" style={{ fontFamily: SHELL_FONT }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
        rel="stylesheet"
      />
      <div className="mx-auto max-w-2xl px-4 pb-16">
        {/* header */}
        <header className="flex items-start justify-between gap-3 pt-6 pb-3">
          <div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.01em]">{t(T.title)}</h1>
            <p className="mt-0.5 text-xs font-semibold text-ink-faint">
              {t(T.campus)} ·{" "}
              {now.toLocaleTimeString(lang === "zh" ? "zh-CN" : lang === "fr" ? "fr-CA" : "en-CA", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <LangToggle className="flex-none" />
        </header>

        {/* filters + walk-time opt-in */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            ["openNow", T.openNow],
            ["under10", T.under10],
            ["halal", T.halal],
            ["veg", T.veg],
          ] as [FilterKey, Dict][]).map(([k, dict]) => (
            <button
              key={k}
              onClick={() => toggle(k)}
              className={`flex-none rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filters.has(k)
                  ? "border-brand-wash bg-brand-wash text-brand-ink"
                  : "border-[#EBEAE5] bg-white text-ink-soft hover:border-brand/40"
              }`}
            >
              {t(dict)}
            </button>
          ))}
          {geoState !== "on" && (
            <button
              onClick={requestGeo}
              disabled={geoState === "locating"}
              className="flex-none rounded-full border border-[#EBEAE5] bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand/40 disabled:opacity-60"
            >
              📍 {geoState === "locating" ? t(T.locating) : t(T.showWalk)}
            </button>
          )}
        </div>

        {/* body */}
        {vendors === null ? (
          error ? (
            <button onClick={load} className="mt-8 w-full rounded-xl border border-[#EBEAE5] bg-white py-6 text-sm font-semibold text-ink-soft">
              {t(T.errRetry)}
            </button>
          ) : (
            <SkeletonList />
          )
        ) : vendors.length === 0 ? (
          <EmptyState title={t(T.emptyTitle)} body={t(T.emptyBody)} icon="🌱" />
        ) : allClosed ? (
          <>
            <EmptyState title={t(T.ghostTitle)} body={t(T.ghostBody)} icon="🌙" />
            <div className="mt-4 pb-1 pl-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {t(T.backNext)}
            </div>
            {vendors.map((v) => (
              <VendorCard key={v.slug} v={v} lang={lang} L={L} t={t} geo={geo} now={now} dimmed />
            ))}
          </>
        ) : filtered.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-sm font-semibold text-ink-soft">{t(T.noMatch)}</p>
            <button onClick={() => setFilters(new Set())} className="mt-3 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white">
              {t(T.clearFilters)}
            </button>
          </div>
        ) : (
          zones.map(([zone, vs]) => (
            <section key={zone} className="mt-1">
              {zone && (
                <div className="pb-1.5 pl-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  {zone}
                </div>
              )}
              {vs.map((v) => (
                <VendorCard key={v.slug} v={v} lang={lang} L={L} t={t} geo={geo} now={now} />
              ))}
            </section>
          ))
        )}

        <footer className="mt-10 flex justify-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-faint transition hover:text-ink">
            <BentoMark className="h-3.5 w-3.5" />
            {t(T.poweredBy)}
          </Link>
        </footer>
      </div>
    </div>
  );
}

// ── status chip ─────────────────────────────────────────────────────────────
function StatusChip({
  status,
  busyBand,
  hours,
  now,
  lang,
  t,
}: {
  status: EffectiveStatus;
  busyBand: "short" | "long" | null;
  hours: CampusVendor["hours"];
  now: Date;
  lang: "zh" | "en" | "fr";
  t: (d: Dict) => string;
}) {
  const cls: Record<EffectiveStatus, string> = {
    open: "bg-brand-wash text-brand-ink",
    busy: "bg-[#FBF1DE] text-[#C77A12]",
    sold_out: "bg-[#FBE9E9] text-[#D14343]",
    closed: "bg-[#F3F2EE] text-ink-faint",
  };
  const dot: Record<EffectiveStatus, string> = {
    open: "bg-brand",
    busy: "bg-[#C77A12]",
    sold_out: "bg-[#D14343]",
    closed: "bg-[#B7BCB6]",
  };
  let label: string;
  if (status === "open") label = t(T.statusOpen);
  else if (status === "busy")
    label = `${t(T.statusBusy)}${busyBand ? ` · ${t(busyBand === "short" ? T.waitShort : T.waitLong)}` : ""}`;
  else if (status === "sold_out") label = t(T.soldOut);
  else {
    const next = nextOpenLabel(hours, now);
    label = next ? `${t(T.opens)} ${next}` : t(T.soldOut);
  }
  return (
    <span
      className={`flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} aria-hidden />
      {label}
    </span>
  );
}

// ── vendor card ─────────────────────────────────────────────────────────────
function VendorCard({
  v,
  lang,
  L,
  t,
  geo,
  now,
  dimmed,
}: {
  v: CampusVendor;
  lang: "zh" | "en" | "fr";
  L: (bi: { zh?: string; en?: string; fr?: string } | null | undefined) => string;
  t: (d: Dict) => string;
  geo: { lat: number; lng: number } | null;
  now: Date;
  dimmed?: boolean;
}) {
  const mins = walkMinutes(geo, v);
  const zh = L(v.name);
  const en = v.name.en && v.name.en !== v.name.zh ? v.name.en : "";
  const card = (
    <div
      className={`mb-2.5 rounded-xl border border-[#EBEAE5] bg-white p-3.5 transition ${
        dimmed ? "opacity-60" : "active:scale-[0.99] hover:border-brand/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold text-ink" style={{ fontFamily: '"Noto Sans SC",sans-serif' }}>
            {zh}
            {en && <span className="ml-1.5 text-xs font-semibold text-ink-faint">{en}</span>}
          </div>
        </div>
        <StatusChip status={v.effective_status} busyBand={v.busy_band} hours={v.hours} now={now} lang={lang} t={t} />
      </div>
      {v.special && !dimmed && (
        <div className="mt-1.5 truncate text-[13px] text-ink-soft">{L(v.special)}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-bold text-ink tabular-nums">{v.price_band}</span>
        {v.dietary_tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[#F3F2EE] px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
            {tag}
          </span>
        ))}
        {mins != null && (
          <span className="text-[11.5px] font-semibold text-ink-faint">· {mins} {t(T.walkMin)}</span>
        )}
      </div>
    </div>
  );
  // Closed vendors aren't orderable — render the card without the order link.
  if (dimmed || v.effective_status === "closed") return card;
  return (
    <Link href={pickupUrl("", v.slug)} className="block" onClick={() => track("vendor_card_tap", { tenant: v.slug })}>
      {card}
    </Link>
  );
}

// ── shared states ───────────────────────────────────────────────────────────
function EmptyState({ title, body, icon }: { title: string; body: string; icon: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-[#E3E2DC] bg-white/60 px-6 py-10 text-center">
      <div className="text-3xl">{icon}</div>
      <div className="mt-3 text-[17px] font-extrabold text-ink">{title}</div>
      <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-2.5 rounded-xl border border-[#EBEAE5] bg-white p-3.5">
          <div className="flex justify-between">
            <div className="h-4 w-32 rounded bg-[#F3F2EE]" />
            <div className="h-5 w-16 rounded-full bg-[#F3F2EE]" />
          </div>
          <div className="mt-3 h-3 w-40 rounded bg-[#F3F2EE]" />
          <div className="mt-2.5 h-3 w-24 rounded bg-[#F3F2EE]" />
        </div>
      ))}
    </div>
  );
}
