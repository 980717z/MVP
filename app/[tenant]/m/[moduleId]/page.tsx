"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type ReactElement } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addRecord,
  deleteRecord,
  updateRecord,
  getTenant,
  syncMemberFromOrder,
  syncMenuToMargin,
  syncPurchasingToStock,
  type RecordRow,
  type Tenant,
} from "@/lib/store";
import { MODULE_BY_ID, type ComputedRule, type Field, type ModuleDef } from "@/lib/catalog";
import { money, num, sum } from "@/lib/format";
import { GST_RATE, PST_RATE } from "@/lib/tax";
import MenuGeneratorPortal from "@/components/MenuGeneratorPortal";
import QrMenuPortal from "@/components/QrMenuPortal";
import OrdersPortal from "@/components/OrdersPortal";
import SalesPortal from "@/components/SalesPortal";

/** Custom portals keyed by module id (modules with `portal: true`). */
const PORTALS: Record<string, (p: { slug: string; mod: ModuleDef }) => ReactElement> = {
  "menu-generator": MenuGeneratorPortal,
  "qr-menu": QrMenuPortal,
  "online-orders": OrdersPortal,
  "sales": SalesPortal,
};

function applyComputed(form: Record<string, string>, rules?: ComputedRule[]): Record<string, string> {
  if (!rules) return form;
  const next = { ...form };
  for (const rule of rules) {
    const vals = rule.fields.map((f) => {
      const neg = f.startsWith("-");
      const key = neg ? f.slice(1) : f;
      const v = parseFloat(next[key] || "0") || 0;
      return neg ? -v : v;
    });
    let result = 0;
    if (rule.formula === "sum") {
      result = vals.reduce((a, b) => a + b, 0);
    } else if (rule.formula === "subtract") {
      result = vals.reduce((a, b) => a + b, 0);
    } else if (rule.formula === "multiply") {
      result = vals.reduce((a, b) => a * b, 1);
    }
    next[rule.target] = result ? String(Math.round(result * 100) / 100) : "";
  }
  return next;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMoneyFields(mod: ModuleDef): Field[] {
  return mod.fields.filter((f) => f.type === "money" || f.type === "number");
}

function avg(rows: any[], key: string): number {
  if (!rows.length) return 0;
  return sum(rows, key) / rows.length;
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function exportCsv(mod: ModuleDef, rows: RecordRow[]) {
  const headers = mod.fields.map((f) => f.label.zh);
  const csvRows = [
    "﻿" + headers.map(escapeCsv).join(","),
    ...rows.map((r) =>
      mod.fields.map((f) => escapeCsv(String(r[f.key] ?? ""))).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${mod.label.zh}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        current.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        current.push(cell);
        cell = "";
        if (current.some((c) => c.trim())) rows.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }
  current.push(cell);
  if (current.some((c) => c.trim())) rows.push(current);
  return rows;
}

async function importCsv(
  file: File,
  mod: ModuleDef,
  slug: string,
  moduleId: string,
): Promise<{ count: number; error?: string }> {
  const text = await file.text();
  const clean = text.replace(/^﻿/, "");
  const parsed = parseCsv(clean);
  if (parsed.length < 2) return { count: 0, error: "CSV 文件为空或只有表头" };

  const headerRow = parsed[0].map((h) => h.trim());
  const fieldMap: (Field | null)[] = headerRow.map((h) => {
    return mod.fields.find((f) => f.label.zh === h || f.label.en === h || f.key === h) ?? null;
  });

  if (fieldMap.every((f) => f === null)) {
    return { count: 0, error: "表头无法匹配任何字段，请确认 CSV 列名与模块字段一致" };
  }

  let count = 0;
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    const data: Record<string, string> = {};
    for (let j = 0; j < row.length; j++) {
      const field = fieldMap[j];
      if (field && row[j].trim()) {
        data[field.key] = row[j].trim();
      }
    }
    if (Object.keys(data).length > 0) {
      await addRecord(slug, moduleId, data);
      count++;
    }
  }
  return { count };
}

function filterByDateRange(rows: RecordRow[], days: number): RecordRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => {
    const d = r.date || r.time;
    return d && d >= cutoffStr;
  });
}

export default function ModulePage() {
  const params = useParams();
  const slug = params.tenant as string;
  const moduleId = params.moduleId as string;
  const mod = MODULE_BY_ID[moduleId];

  const [tenant, setTenant] = useState<Tenant | undefined>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [statsRange, setStatsRange] = useState<7 | 30 | 0>(0);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getTenant(slug).then(setTenant);
  }, [slug, moduleId, tick]);

  useEffect(() => {
    if (!filterOpen) return;
    const close = () => setFilterOpen(null);
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", close); };
  }, [filterOpen]);

  const rawRows: RecordRow[] = useMemo(
    () => tenant?.records[moduleId] ?? [],
    [tenant, moduleId]
  );

  const rows: RecordRow[] = useMemo(() => {
    if (moduleId === "stock-loss") {
      const totals: Record<string, { inQty: number; lossQty: number }> = {};
      for (const r of rawRows) {
        const item = r.item || "";
        if (!item) continue;
        if (!totals[item]) totals[item] = { inQty: 0, lossQty: 0 };
        totals[item].inQty += parseFloat(r.inQty) || 0;
        totals[item].lossQty += parseFloat(r.lossQty) || 0;
      }
      return rawRows.map((r) => {
        const t = totals[r.item || ""];
        if (!t) return r;
        const onHand = Math.round((t.inQty - t.lossQty) * 100) / 100;
        return { ...r, onHand: onHand > 0 ? String(onHand) : "0" };
      });
    }
    if (moduleId === "dish-margin") {
      // Ontario sales tax: HST 13% = 5% federal (GST) + 8% provincial.
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return rawRows.map((r) => {
        const revenue = r2((parseFloat(r.price) || 0) * (parseFloat(r.soldMonth) || 0));
        const gst = r2(revenue * GST_RATE);
        const pst = r2(revenue * PST_RATE);
        return {
          ...r,
          revenue: String(revenue),
          gst: String(gst),
          pst: String(pst),
          afterTax: String(r2(revenue + gst + pst)),
        };
      });
    }
    return rawRows;
  }, [rawRows, moduleId]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (dateFrom || dateTo) {
      result = result.filter((r) => {
        const d = r.date || r.time || "";
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }
    for (const [key, allowed] of Object.entries(colFilters)) {
      if (allowed.size > 0) {
        result = result.filter((r) => {
          const v = r[key] != null ? String(r[key]) : "";
          return allowed.has(v);
        });
      }
    }
    return result;
  }, [rows, colFilters, dateFrom, dateTo]);

  const hasAnyFilter = Object.values(colFilters).some((s) => s.size > 0) || !!dateFrom || !!dateTo;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const alerts = useMemo(() => {
    const list: { type: "warn" | "info"; text: string }[] = [];
    if (moduleId === "stock-loss") {
      const totals: Record<string, number> = {};
      for (const r of rows) {
        const item = r.item || "";
        if (!item) continue;
        const oh = parseFloat(r.onHand) || 0;
        totals[item] = oh;
      }
      const low = Object.entries(totals).filter(([, v]) => v > 0 && v <= 5);
      const zero = Object.entries(totals).filter(([, v]) => v <= 0);
      if (zero.length) list.push({ type: "warn", text: `⚠️ 零库存：${zero.map(([k]) => k).join("、")}` });
      if (low.length) list.push({ type: "warn", text: `📉 低库存（≤5）：${low.map(([k, v]) => `${k}(${v})`).join("、")}` });
    }
    if (moduleId === "group-booking") {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = rows.filter((r) => r.date && r.date >= today && r.date <= addDays(today, 3));
      if (upcoming.length) list.push({ type: "info", text: `📅 近3天有 ${upcoming.length} 个预订：${upcoming.map((r) => `${r.date} ${r.customer || ""}(${r.guests || "?"}人)`).join("、")}` });
    }
    if (moduleId === "equipment") {
      const open = rows.filter((r) => r.status === "待处理" || r.status === "处理中");
      if (open.length) list.push({ type: "warn", text: `🔧 ${open.length} 个设备问题待处理：${open.map((r) => `${r.equipment || ""}${r.issue ? "-" + r.issue : ""}`).join("、")}` });
    }
    if (moduleId === "reviews") {
      const unreplied = rows.filter((r) => r.replied !== "是" && parseFloat(r.rating) <= 3);
      if (unreplied.length) list.push({ type: "warn", text: `💬 ${unreplied.length} 条低分评价未回复` });
    }
    if (moduleId === "food-safety") {
      const failed = rows.filter((r) => r.ok === "否");
      if (failed.length) list.push({ type: "warn", text: `🧊 ${failed.length} 条不合格记录需关注` });
    }
    if (moduleId === "social") {
      const drafts = rows.filter((r) => r.status === "草稿" || r.status === "待发");
      if (drafts.length) list.push({ type: "info", text: `📣 ${drafts.length} 条内容待发布` });
    }
    return list;
  }, [rows, moduleId]);

  const autoFields = useMemo(() => {
    if (moduleId === "stock-loss") return new Set(["onHand"]);
    if (moduleId === "dish-margin") return new Set(["revenue", "gst", "pst", "afterTax"]);
    return new Set<string>();
  }, [moduleId]);

  const computedTargets = useMemo(
    () => {
      const set = new Set((mod?.computed ?? []).map((r) => r.target));
      autoFields.forEach((f) => set.add(f));
      return set;
    },
    [mod, autoFields]
  );

  const updateForm = useCallback(
    (key: string, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        return applyComputed(next, mod?.computed);
      });
    },
    [mod]
  );

  if (!mod) {
    return (
      <main className="px-6 py-8">
        <p className="text-ink-soft">未知模块。</p>
        <Link href={`/${slug}`} className="text-brand">← 返回总览</Link>
      </main>
    );
  }
  if (!tenant) return null;

  if (mod.portal && PORTALS[moduleId]) {
    const Portal = PORTALS[moduleId];
    return <Portal slug={slug} mod={mod} />;
  }

  const enabled = tenant.enabled.includes(moduleId);

  const submit = async () => {
    const missing = mod.fields.filter((f) => f.required && !form[f.key]?.trim());
    if (missing.length) {
      alert("请填写：" + missing.map((f) => f.label.zh).join("、"));
      return;
    }
    await addRecord(slug, moduleId, form);
    const orderModules = ["phone-orders", "group-booking"];
    if (orderModules.includes(moduleId) && form.phone) {
      await syncMemberFromOrder(
        slug,
        form.phone,
        form.customer || "",
        parseFloat(form.amount || form.total || "0") || 0,
      );
    }
    setForm({});
    setOpen(false);
    setTick((t) => t + 1);
  };

  const startEdit = (r: RecordRow) => {
    const data: Record<string, string> = {};
    for (const f of mod.fields) {
      data[f.key] = r[f.key] != null ? String(r[f.key]) : "";
    }
    setEditingId(r.id);
    setEditForm(data);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateRecord(editingId, editForm);
    setEditingId(null);
    setEditForm({});
    setTick((t) => t + 1);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const total = mod.amountKey ? sum(rows, mod.amountKey) : 0;
  const statsRows = statsRange > 0 ? filterByDateRange(rows, statsRange) : rows;
  const summableFields = getMoneyFields(mod);

  return (
    <main className="px-6 py-8 lg:px-10">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">← 总览</Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {mod.icon} {mod.label.zh}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{mod.pain.zh}</p>
        </div>
        {enabled && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
              {open ? "收起" : "+ 新增记录"}
            </button>
            <button
              className="btn-ghost border border-slate-300"
              onClick={() => exportCsv(mod, rows)}
              disabled={rows.length === 0}
            >
              导出 CSV
            </button>
            <label className={`btn-ghost border border-slate-300 cursor-pointer ${importing ? "opacity-50" : ""}`}>
              {importing ? "导入中…" : "导入 CSV"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                disabled={importing}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  const { count, error } = await importCsv(file, mod, slug, moduleId);
                  setImporting(false);
                  if (fileRef.current) fileRef.current.value = "";
                  if (error) {
                    alert("导入失败：" + error);
                  } else {
                    alert(`成功导入 ${count} 条记录`);
                    setTick((t) => t + 1);
                  }
                }}
              />
            </label>
            {moduleId === "stock-loss" && (
              <button
                className="btn-ghost border border-slate-300"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  const { added, updated } = await syncPurchasingToStock(slug);
                  setSyncing(false);
                  setTick((t) => t + 1);
                  alert(`从采购导入完成：新增 ${added} 条，更新 ${updated} 条`);
                }}
              >
                {syncing ? "同步中…" : "从采购导入"}
              </button>
            )}
            {moduleId === "dish-margin" && (
              <button
                className="btn-ghost border border-slate-300"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  const { added, updated } = await syncMenuToMargin(slug);
                  setSyncing(false);
                  setTick((t) => t + 1);
                  alert(`从菜单导入完成：新增 ${added} 道菜，更新 ${updated} 道菜售价`);
                }}
              >
                {syncing ? "同步中…" : "从菜单导入"}
              </button>
            )}
          </div>
        )}
      </header>

      {!enabled && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          该模块未启用。到 <Link href={`/${slug}/settings`} className="underline">设置</Link> 中开启后即可录入。
        </div>
      )}

      {/* ── Stats section ── */}
      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">数据统计</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {([0, 7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setStatsRange(d)}
                className={`rounded-md px-2.5 py-1 ${statsRange === d ? "bg-white font-medium shadow-sm text-ink" : "text-ink-faint"}`}
              >
                {d === 0 ? "全部" : `近${d}天`}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* record count */}
          <div className="card p-4">
            <div className="text-xs text-ink-faint">记录数</div>
            <div className="mt-1 text-xl font-bold text-ink">{statsRows.length}</div>
          </div>
          {/* KPI total */}
          {mod.amountKey && (
            <div className="card p-4">
              <div className="text-xs text-ink-faint">{mod.amountLabel?.zh ?? "合计"}</div>
              <div className="mt-1 text-xl font-bold text-ink">
                {mod.amountKind === "money" ? money(sum(statsRows, mod.amountKey)) : num(sum(statsRows, mod.amountKey))}
              </div>
            </div>
          )}
          {/* summable field stats */}
          {summableFields
            .filter((f) => f.key !== mod.amountKey)
            .slice(0, mod.amountKey ? 2 : 3)
            .map((f) => (
              <div key={f.key} className="card p-4">
                <div className="text-xs text-ink-faint">{f.label.zh}（合计 / 均值）</div>
                <div className="mt-1 text-xl font-bold text-ink">
                  {f.type === "money" ? money(sum(statsRows, f.key)) : num(sum(statsRows, f.key))}
                </div>
                <div className="text-xs text-ink-faint">
                  均值: {f.type === "money" ? money(avg(statsRows, f.key)) : num(avg(statsRows, f.key))}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-2.5 text-sm ${
                a.type === "warn"
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border border-blue-200 bg-blue-50 text-blue-800"
              }`}
            >
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* trend chart */}
      {mod.amountKey && rows.length >= 2 && (
        <div className="mb-6">
          <TrendChart
            rows={rows}
            valueKey={mod.amountKey}
            label={mod.amountLabel?.zh ?? "数值"}
            isMoney={mod.amountKind === "money"}
          />
        </div>
      )}

      {/* entry form */}
      {open && enabled && (
        <section className="card mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-ink">新增记录</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mod.fields.map((f) => (
              <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                <FieldInput
                  field={f}
                  value={form[f.key] ?? ""}
                  onChange={(v) => updateForm(f.key, v)}
                  readOnly={computedTargets.has(f.key)}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={submit}>保存</button>
            <button className="btn-ghost" onClick={() => { setForm({}); setOpen(false); }}>取消</button>
          </div>
        </section>
      )}

      {/* date range & filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-ink-faint">
          <span>日期</span>
          <input
            type="date"
            className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          />
          <span>—</span>
          <input
            type="date"
            className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          />
        </div>
        {hasAnyFilter && (
          <>
            <span className="text-ink-faint">筛选中：{filteredRows.length} / {rows.length} 条</span>
            <button
              className="text-brand hover:text-brand-soft"
              onClick={() => { setColFilters({}); setDateFrom(""); setDateTo(""); setPage(1); }}
            >
              清除全部筛选
            </button>
          </>
        )}
      </div>

      {/* records table */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
                {mod.fields.map((f) => {
                  const isOpen = filterOpen === f.key;
                  const active = colFilters[f.key]?.size > 0;
                  const allVals = Array.from(new Set(rows.map((r) => r[f.key] != null ? String(r[f.key]) : "").filter((v) => v !== "")));
                  allVals.sort();
                  const searched = filterSearch
                    ? allVals.filter((v) => v.toLowerCase().includes(filterSearch.toLowerCase()))
                    : allVals;
                  return (
                    <th key={f.key} className="px-4 py-2.5 font-medium relative">
                      <button
                        className="flex items-center gap-1 hover:text-ink"
                        onClick={() => { setFilterOpen(isOpen ? null : f.key); setFilterSearch(""); }}
                      >
                        {f.label.zh}
                        <span className={`text-[10px] ${active ? "text-brand" : "text-slate-400"}`}>
                          {active ? "▼" : "▽"}
                        </span>
                      </button>
                      {isOpen && allVals.length > 0 && (
                        <div
                          className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {allVals.length > 6 && (
                            <div className="border-b border-slate-100 p-2">
                              <input
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
                                placeholder="搜索..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                autoFocus
                              />
                            </div>
                          )}
                          <div className="max-h-48 overflow-y-auto p-1">
                            <label className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer font-medium">
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-brand"
                                checked={!active}
                                onChange={() => {
                                  setColFilters((prev) => {
                                    const next = { ...prev };
                                    delete next[f.key];
                                    return next;
                                  });
                                }}
                              />
                              全选
                            </label>
                            {searched.map((v) => {
                              const checked = !active || (colFilters[f.key]?.has(v) ?? false);
                              return (
                                <label key={v} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-brand"
                                    checked={checked}
                                    onChange={() => {
                                      setColFilters((prev) => {
                                        const cur = prev[f.key] ? new Set(prev[f.key]) : new Set(allVals);
                                        if (cur.has(v)) {
                                          cur.delete(v);
                                        } else {
                                          cur.add(v);
                                        }
                                        if (cur.size === allVals.length || cur.size === 0) {
                                          const next = { ...prev };
                                          delete next[f.key];
                                          return next;
                                        }
                                        return { ...prev, [f.key]: cur };
                                      });
                                    }}
                                  />
                                  {renderCell(f, v)}
                                </label>
                              );
                            })}
                          </div>
                          <div className="border-t border-slate-100 p-1.5 flex justify-end">
                            <button
                              className="text-xs text-brand hover:text-brand-soft px-2 py-0.5"
                              onClick={() => setFilterOpen(null)}
                            >
                              确定
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  {editingId === r.id ? (
                    <>
                      {mod.fields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5">
                          <EditCellInput
                            field={f}
                            value={editForm[f.key] ?? ""}
                            onChange={(v) => setEditForm((prev) => ({ ...prev, [f.key]: v }))}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        <button onClick={saveEdit} className="text-xs text-brand hover:text-brand-soft mr-2">保存</button>
                        <button onClick={cancelEdit} className="text-xs text-ink-faint hover:text-ink">取消</button>
                      </td>
                    </>
                  ) : (
                    <>
                      {mod.fields.map((f) => (
                        <td key={f.key} className="px-4 py-2.5 text-ink-soft">
                          {renderCell(f, r[f.key])}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs text-brand hover:text-brand-soft mr-2"
                        >
                          修改
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm("删除这条记录？")) {
                              await deleteRecord(r.id);
                              setTick((t) => t + 1);
                            }
                          }}
                          className="text-xs text-ink-faint hover:text-red-600"
                        >
                          删除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={mod.fields.length + 1} className="px-4 py-10 text-center text-sm text-ink-faint">
                    {rows.length === 0
                      ? (enabled ? "还没有记录，点「+ 新增记录」开始录入。" : "还没有记录。")
                      : "没有匹配的记录，试试调整筛选条件。"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-ink-faint">
            <span>
              第 {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} 条，共 {filteredRows.length} 条
            </span>
            <div className="flex items-center gap-1">
              <button
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
              >
                ««
              </button>
              <button
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ 上一页
              </button>
              <span className="px-2 font-medium text-ink">{safePage} / {totalPages}</span>
              <button
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                下一页 ›
              </button>
              <button
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                »»
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="label">
        {field.label.zh}
        {field.required && <span className="text-red-500"> *</span>}
        {field.suffix && <span className="text-ink-faint"> ({field.suffix})</span>}
        {readOnly && <span className="text-brand"> (自动计算)</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea className="input min-h-[72px]" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
      ) : field.type === "select" ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.zh} value={o.zh}>{o.zh}</option>
          ))}
        </select>
      ) : (
        <input
          className={`input ${readOnly ? "bg-slate-50 text-ink-faint" : ""}`}
          type={
            field.type === "money" || field.type === "number"
              ? "number"
              : field.type === "date"
              ? "date"
              : field.type === "time"
              ? "time"
              : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function EditCellInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  if (field.type === "select") {
    return (
      <select className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options?.map((o) => <option key={o.zh} value={o.zh}>{o.zh}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") {
    return <input className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <input
      className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
      type={field.type === "money" || field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "time" ? "time" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function renderCell(field: Field, value: any) {
  if (value === undefined || value === "" || value === null) return <span className="text-slate-300">—</span>;
  if (field.type === "money") return money(value);
  return String(value);
}

function TrendChart({ rows, valueKey, label, isMoney }: { rows: RecordRow[]; valueKey: string; label: string; isMoney?: boolean }) {
  const grouped = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const d = r.date || r.createdAt?.slice(0, 10) || "";
      if (!d) continue;
      map[d] = (map[d] || 0) + (parseFloat(r[valueKey]) || 0);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  }, [rows, valueKey]);

  if (grouped.length < 2) return null;

  const vals = grouped.map(([, v]) => v);
  const maxVal = Math.max(...vals, 1);
  const minVal = Math.min(...vals, 0);
  const range = maxVal - minVal || 1;

  const W = 400;
  const H = 160;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 36;
  const cw = W - PAD_L - PAD_R;
  const ch = H - PAD_T - PAD_B;

  const points = grouped.map(([, v], i) => {
    const x = PAD_L + (i / (grouped.length - 1)) * cw;
    const y = PAD_T + ch - ((v - minVal) / range) * ch;
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${PAD_T + ch} L${points[0].x},${PAD_T + ch} Z`;

  const fmt = (v: number) => isMoney ? `$${Math.round(v).toLocaleString()}` : String(Math.round(v * 10) / 10);

  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-ink-faint mb-2">{label} 趋势（近14天）</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 180 }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = PAD_T + ch - pct * ch;
          const v = minVal + pct * range;
          return (
            <g key={pct}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">{fmt(v)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill="url(#chartGrad)" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#2563eb" />
            {grouped.length <= 10 && (
              <text x={p.x} y={H - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
                {grouped[i][0].slice(5)}
              </text>
            )}
          </g>
        ))}
        {grouped.length > 10 && grouped.filter((_, i) => i % 3 === 0 || i === grouped.length - 1).map(([d], i) => {
          const origIdx = i === 0 ? 0 : grouped.findIndex(([dd]) => dd === d);
          return (
            <text key={d} x={points[origIdx]?.x} y={H - 6} textAnchor="middle" fontSize="8" fill="#94a3b8">
              {d.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
