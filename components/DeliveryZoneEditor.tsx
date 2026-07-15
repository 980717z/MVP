"use client";

import { useEffect, useRef, useState } from "react";
import { FSA_NAMES, fsaLabel, getDeliveryFsas, saveDeliveryFsas } from "@/lib/deliveryZone";

// ─────────────────────────────────────────────────────────────────────────
//  Map editor for the delivery zone. Renders every Toronto FSA polygon
//  (public/toronto-fsas.json, StatCan 2021 boundaries) on an OSM base map;
//  the owner clicks districts to toggle them in/out of the whitelist and
//  saves to tenants.delivery_fsas. Leaflet is imported dynamically — it
//  touches `window` at import time, so it must never load during SSR.
// ─────────────────────────────────────────────────────────────────────────

const SELECTED = { color: "#0E9F6E", weight: 1.5, fillColor: "#0E9F6E", fillOpacity: 0.35 };
const UNSELECTED = { color: "#94A3B8", weight: 1, fillColor: "#CBD5E1", fillOpacity: 0.12 };

// Toronto downtown default — matches the DB column default (orders-payment.sql)
const DEFAULT_FSAS = ["M4W", "M4X", "M4Y", "M5A", "M5B", "M5C", "M5E", "M5G", "M5H", "M5J", "M5K", "M5L", "M5S", "M5T", "M5V", "M5X"];

export default function DeliveryZoneEditor({ slug }: { slug: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<Map<string, any>>(new Map());
  const selectedRef = useRef<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // keep the ref in sync so Leaflet click handlers (bound once) see fresh state
  selectedRef.current = selected;

  useEffect(() => {
    let map: any;
    let cancelled = false;
    (async () => {
      const [L, fsasRes, dbFsas] = await Promise.all([
        import("leaflet"),
        fetch("/toronto-fsas.json").then((r) => r.json()),
        getDeliveryFsas(slug),
      ]);
      if (cancelled || !mapRef.current) return;

      const initial = new Set(dbFsas ?? DEFAULT_FSAS);
      setSelected(initial);
      selectedRef.current = initial;
      setLoadedFromDb(true);

      map = L.map(mapRef.current, { scrollWheelZoom: false, attributionControl: true })
        .setView([43.665, -79.395], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      L.geoJSON(fsasRes, {
        style: (f: any) => (initial.has(f.properties.fsa) ? SELECTED : UNSELECTED),
        onEachFeature: (f: any, layer: any) => {
          const fsa = f.properties.fsa;
          layersRef.current.set(fsa, layer);
          layer.bindTooltip(fsaLabel(fsa), { sticky: true, direction: "top" });
          layer.on("click", () => {
            const next = new Set(selectedRef.current);
            const on = !next.has(fsa);
            if (on) next.add(fsa);
            else next.delete(fsa);
            layer.setStyle(on ? SELECTED : UNSELECTED);
            setSelected(next);
            setDirty(true);
            setErr(null);
          });
          layer.on("mouseover", () => layer.setStyle({ weight: 2.5 }));
          layer.on("mouseout", () =>
            layer.setStyle(selectedRef.current.has(fsa) ? SELECTED : UNSELECTED)
          );
        },
      }).addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [slug]);

  const removeChip = (fsa: string) => {
    const next = new Set(selected);
    next.delete(fsa);
    setSelected(next);
    setDirty(true);
    layersRef.current.get(fsa)?.setStyle(UNSELECTED);
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    const { error } = await saveDeliveryFsas(slug, [...selected]);
    setSaving(false);
    if (error) {
      setErr(error);
      return;
    }
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const list = [...selected].sort();

  return (
    <div className="card p-5">
      {/* leaflet core styles, scoped-inline so no global CSS import is needed */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">配送范围</div>
          <p className="mt-0.5 text-xs text-ink-soft">
            点击地图上的邮编分区（前三位 FSA）来开启/关闭配送。顾客填地址时会按邮编自动校验。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && <span className="text-xs font-medium text-brand">已保存 ✓</span>}
          <button
            onClick={save}
            disabled={!dirty || saving || !loadedFromDb}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存配送范围"}
          </button>
        </div>
      </div>

      <div ref={mapRef} className="mt-4 h-[420px] w-full overflow-hidden rounded-xl border border-slate-200" />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-ink-faint">
          已选 {list.length} 个区：
        </span>
        {list.map((fsa) => (
          <button
            key={fsa}
            onClick={() => removeChip(fsa)}
            title="点击移除"
            className="group inline-flex items-center gap-1 rounded-full bg-brand-wash px-2.5 py-1 text-xs font-medium text-brand"
          >
            {fsa}
            {FSA_NAMES[fsa] && <span className="text-brand/70">{FSA_NAMES[fsa].zh}</span>}
            <span className="text-brand/50 group-hover:text-brand">✕</span>
          </button>
        ))}
        {list.length === 0 && <span className="text-xs text-red-600">未选择任何区 —— 顾客将无法下配送单</span>}
      </div>
      {err && <p className="mt-2 text-xs text-red-600">保存失败：{err}</p>}
      {dirty && !err && <p className="mt-2 text-xs text-amber-700">有未保存的改动</p>}
    </div>
  );
}
