"use client";

import { useEffect, useMemo, useState, useCallback, useRef, Fragment, type ReactElement } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  addRecord,
  deleteRecord,
  updateRecord,
  getTenant,
  listRecords,
  syncMemberFromOrder,
  syncMenuToMargin,
  syncPurchasingToStock,
  myAccess,
  computeDailyClose,
  autoSyncDailyClose,
  loadTierRules,
  saveTierRules,
  reapplyTiers,
  type TierRule,
  type RecordRow,
  type Tenant,
} from "@/lib/store";
import { MODULE_BY_ID, type ComputedRule, type Field, type ModuleDef } from "@/lib/catalog";
import { money, num, sum } from "@/lib/format";
import { addDays, mondayOf, shopToday, shopYmd } from "@/lib/shopTime";
import { computeStockLossFifo } from "@/lib/inventory";
import { uploadEquipmentPhoto, deleteEquipmentPhoto } from "@/lib/equipmentPhoto";
import MenuGeneratorPortal from "@/components/MenuGeneratorPortal";
import QrMenuPortal from "@/components/QrMenuPortal";
import OrdersPortal from "@/components/OrdersPortal";
import SalesPortal from "@/components/SalesPortal";
import FoodSafetyPortal from "@/components/FoodSafetyPortal";
import SuggestInput from "@/components/SuggestInput";

/** Custom portals keyed by module id (modules with `portal: true`). */
const PORTALS: Record<string, (p: { slug: string; mod: ModuleDef }) => ReactElement> = {
  "menu-generator": MenuGeneratorPortal,
  "qr-menu": QrMenuPortal,
  "online-orders": OrdersPortal,
  "sales": SalesPortal,
  "food-safety": FoodSafetyPortal,
};

/** "HH:MM" → minutes since midnight, or NaN if not a valid time. */
function timeToMinutes(t: string | undefined): number {
  if (!t) return NaN;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function applyComputed(form: Record<string, string>, rules?: ComputedRule[]): Record<string, string> {
  if (!rules) return form;
  const next = { ...form };
  for (const rule of rules) {
    if (rule.formula === "hoursBetween") {
      const [startKey, endKey] = rule.fields;
      const start = timeToMinutes(next[startKey]);
      const end = timeToMinutes(next[endKey]);
      if (isNaN(start) || isNaN(end)) {
        next[rule.target] = "";
      } else {
        let mins = end - start;
        if (mins < 0) mins += 24 * 60; // overnight shift
        next[rule.target] = String(Math.round((mins / 60) * 100) / 100);
      }
      continue;
    }
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

/** "5月26日" from a YYYY-MM-DD string. */
function fmtMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getMoneyFields(mod: ModuleDef): Field[] {
  return mod.fields.filter((f) => f.type === "money" || f.type === "number");
}

/** Quick shift-time presets for the scheduling module's start/end fields.
 *  Default times; a tenant can override them (stored in the "scheduling_presets" record). */
const SHIFT_PRESETS: { key: string; name: string; start: string; end: string }[] = [
  { key: "morning", name: "早班", start: "09:00", end: "17:00" },
  { key: "afternoon", name: "午班", start: "12:00", end: "20:00" },
  { key: "evening", name: "晚班", start: "17:00", end: "23:00" },
];

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
  a.download = `${mod.label.zh}_${shopToday()}.csv`;
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
  let failed = 0;
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
      const { error } = await addRecord(slug, moduleId, applyComputed(data, mod.computed));
      if (error) failed++;
      else count++;
    }
  }
  // Same as the manual single-entry submit(): a batch of imported purchases
  // needs its stock sync too, so imported rows don't just sit unreflected in
  // stock until someone happens to add a purchase by hand.
  if (moduleId === "purchasing" && count > 0) {
    await syncPurchasingToStock(slug);
  }
  return { count, error: failed > 0 ? `${failed} 行导入失败（已成功导入 ${count} 行）` : undefined };
}

/** The YYYY-MM-DD a record belongs to: its `date` field, else when it was created.
 *  (Never `time` — that's HH:MM and breaks date comparisons, e.g. phone orders.) */
function rowDate(r: RecordRow): string {
  return r.date || (r.createdAt ? String(r.createdAt).slice(0, 10) : "");
}

function filterByDateRange(rows: RecordRow[], days: number): RecordRow[] {
  const cutoffStr = addDays(shopToday(), -days);
  return rows.filter((r) => {
    const d = rowDate(r);
    return d && d >= cutoffStr;
  });
}

function renderCell(field: Field, value: any) {
  if (value === undefined || value === "" || value === null) return <span className="text-slate-300">—</span>;
  if (field.type === "money") return money(value);
  return String(value);
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

/** Groups rows by `groupKey` (newest date first within each group), showing
 *  only the latest record per group with a ▾ toggle to reveal the rest —
 *  used by stock-loss (grouped by item) and equipment (grouped by equipment). */
function GroupedRows({
  rows,
  fields,
  groupKey,
  compactDates,
  expandedItems,
  setExpandedItems,
  editingId,
  editForm,
  setEditForm,
  startEdit,
  saveEdit,
  cancelEdit,
  deleteRecord: doDelete,
}: {
  rows: RecordRow[];
  fields: Field[];
  groupKey: string;
  /** Show date-type fields as "7月15日" instead of the raw YYYY-MM-DD. */
  compactDates?: boolean;
  expandedItems: Set<string>;
  setExpandedItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingId: string | null;
  editForm: Record<string, string>;
  setEditForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  startEdit: (r: RecordRow) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  deleteRecord: (id: string) => Promise<void>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, RecordRow[]>();
    for (const r of rows) {
      const group = r[groupKey] || "—";
      const list = map.get(group) ?? [];
      list.push(r);
      map.set(group, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    return map;
  }, [rows, groupKey]);

  const toggle = (group: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const renderCellCompact = (f: Field, value: any) => {
    if (compactDates && f.type === "date" && value) return fmtMonthDay(String(value));
    return renderCell(f, value);
  };

  const renderRow = (r: RecordRow, showToggle: boolean, group: string, count: number) => {
    const isEditing = editingId === r.id;
    return (
      <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
        <td className="px-2 py-2.5 text-center">
          {showToggle && count > 1 && (
            <button
              className="text-2xl leading-none text-ink-faint hover:text-ink transition-transform"
              onClick={() => toggle(group)}
              style={{ transform: expandedItems.has(group) ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ▾
            </button>
          )}
        </td>
        {isEditing ? (
          <>
            {fields.map((f) => {
              const locked = r.purchaseId && (f.key === "inQty" || f.key === "unitCost" || f.key === "item" || f.key === "date" || f.key === "type");
              return (
                <td key={f.key} className="px-2 py-1.5">
                  {locked ? (
                    <span className="text-xs text-ink-faint">{editForm[f.key] ?? ""}</span>
                  ) : (
                    <EditCellInput
                      field={f}
                      value={editForm[f.key] ?? ""}
                      onChange={(v) => setEditForm((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  )}
                </td>
              );
            })}
            <td className="px-2 py-1.5 text-right whitespace-nowrap">
              <button onClick={saveEdit} className="text-xs text-brand hover:text-brand-soft mr-2">保存</button>
              <button onClick={cancelEdit} className="text-xs text-ink-faint hover:text-ink">取消</button>
            </td>
          </>
        ) : (
          <>
            {fields.map((f) => (
              <td key={f.key} className="px-4 py-2.5 text-ink-soft">
                {renderCellCompact(f, r[f.key])}
              </td>
            ))}
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
              {r.photo_url && (
                <a href={r.photo_url} target="_blank" rel="noreferrer" className="text-xs text-ink-faint hover:text-brand mr-2" title="查看照片">
                  📷
                </a>
              )}
              <button onClick={() => startEdit(r)} className="text-xs text-brand hover:text-brand-soft mr-2">修改</button>
              <button
                onClick={async () => { if (confirm("删除这条记录？")) await doDelete(r.id); }}
                className="text-xs text-ink-faint hover:text-red-600"
              >
                删除
              </button>
            </td>
          </>
        )}
      </tr>
    );
  };

  return (
    <>
      {Array.from(groups.entries()).map(([group, list]) => {
        const expanded = expandedItems.has(group);
        const visible = expanded ? list : [list[0]];
        return visible.map((r, i) => renderRow(r, i === 0, group, list.length));
      })}
    </>
  );
}

export default function ModulePage() {
  const params = useParams();
  const slug = params.tenant as string;
  const moduleId = params.moduleId as string;
  const mod = MODULE_BY_ID[moduleId];

  const [tenant, setTenant] = useState<Tenant | undefined>();
  // staff module access: undefined = loading, null = unrestricted
  const [allowed, setAllowed] = useState<string[] | null | undefined>(undefined);
  const [form, setForm] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [statsRange, setStatsRange] = useState<7 | 30 | 0 | "custom">(0);
  const [customStatsFrom, setCustomStatsFrom] = useState("");
  const [customStatsTo, setCustomStatsTo] = useState("");
  const [importing, setImporting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [weekAnchor, setWeekAnchor] = useState(() => shopToday());
  const [shiftPreset, setShiftPreset] = useState<string>("custom");
  const [presetConfigId, setPresetConfigId] = useState<string | null>(null);
  const [presetConfig, setPresetConfig] = useState<Record<string, string>>({});
  const [editingPresets, setEditingPresets] = useState(false);
  const [presetForm, setPresetForm] = useState<Record<string, string>>({});
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [copyingWeek, setCopyingWeek] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [selectedForCopy, setSelectedForCopy] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const fileRef = useRef<HTMLInputElement>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    getTenant(slug).then(setTenant);
    myAccess(slug).then((a) => setAllowed(a ? a.allowed : null));
    if (moduleId === "dish-margin") syncMenuToMargin(slug);
    if (moduleId === "daily-close") autoSyncDailyClose(slug).then(() => getTenant(slug).then(setTenant));
  }, [slug, moduleId, tick]);

  // Scheduling shows one week per table: keep the date-range filter locked to
  // the Monday–Sunday span of `weekAnchor` instead of a free date-range picker.
  useEffect(() => {
    if (moduleId !== "scheduling") return;
    const monday = mondayOf(weekAnchor);
    setDateFrom(monday);
    setDateTo(addDays(monday, 6));
    setPage(1);
    setExpandedStaff(new Set());
  }, [moduleId, weekAnchor]);

  useEffect(() => {
    if (moduleId !== "scheduling") return;
    listRecords(slug, "scheduling_presets").then((recs) => {
      const rec = recs[0];
      setPresetConfigId(rec?.id ?? null);
      const cfg: Record<string, string> = {};
      if (rec) {
        for (const p of SHIFT_PRESETS) {
          if (rec[`${p.key}Start`]) cfg[`${p.key}Start`] = String(rec[`${p.key}Start`]);
          if (rec[`${p.key}End`]) cfg[`${p.key}End`] = String(rec[`${p.key}End`]);
        }
      }
      setPresetConfig(cfg);
    });
  }, [slug, moduleId, tick]);

  const effectivePresets = useMemo(
    () =>
      SHIFT_PRESETS.map((p) => ({
        ...p,
        start: presetConfig[`${p.key}Start`] || p.start,
        end: presetConfig[`${p.key}End`] || p.end,
      })),
    [presetConfig],
  );

  const openPresetEditor = () => {
    const draft: Record<string, string> = {};
    for (const p of effectivePresets) {
      draft[`${p.key}Start`] = p.start;
      draft[`${p.key}End`] = p.end;
    }
    setPresetForm(draft);
    setEditingPresets(true);
  };

  const savePresets = async () => {
    const { error } = presetConfigId
      ? await updateRecord(presetConfigId, presetForm)
      : await addRecord(slug, "scheduling_presets", presetForm);
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    setEditingPresets(false);
    setTick((t) => t + 1);
  };

  /** Enter selection mode: check every shift by default, expand all staff so each row is visible. */
  const startCopySelection = () => {
    if (filteredRows.length === 0) return;
    setSelectedForCopy(new Set(filteredRows.map((r) => r.id)));
    setExpandedStaff(new Set(staffGroups.map((g) => g.name)));
    setCopyMode(true);
  };

  const cancelCopySelection = () => {
    setCopyMode(false);
    setSelectedForCopy(new Set());
  };

  const toggleSelectForCopy = (id: string) => {
    setSelectedForCopy((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllForCopy = () => {
    setSelectedForCopy((prev) => (prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id))));
  };

  /** Duplicate the checked shifts into the following week (dates +7 days). */
  const confirmCopySelection = async () => {
    const toCopy = filteredRows.filter((r) => selectedForCopy.has(r.id));
    if (toCopy.length === 0 || copyingWeek) return;
    setCopyingWeek(true);
    let failed = 0;
    try {
      const results = await Promise.all(
        toCopy.map((r) => {
          const data: Record<string, string> = {};
          for (const f of mod.fields) {
            data[f.key] = r[f.key] != null ? String(r[f.key]) : "";
          }
          if (data.date) data.date = addDays(data.date, 7);
          return addRecord(slug, "scheduling", data);
        }),
      );
      failed = results.filter((r) => r.error).length;
    } finally {
      setCopyingWeek(false);
    }
    if (failed > 0) {
      alert(`${failed} 条排班复制失败，请重试（其余 ${toCopy.length - failed} 条已成功）`);
    }
    setCopyMode(false);
    setSelectedForCopy(new Set());
    setTick((t) => t + 1);
    setWeekAnchor((d) => addDays(d, 7));
  };

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

  /** Distinct prior values per text field, for autocomplete (e.g. staff names already used). */
  const textSuggestions: Record<string, string[]> = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of mod?.fields ?? []) {
      if (f.type !== "text") continue;
      const values = new Set<string>();
      for (const r of rawRows) {
        const v = String(r[f.key] ?? "").trim();
        if (v) values.add(v);
      }
      out[f.key] = Array.from(values).sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [mod, rawRows]);

  /** 设备维护 → 设备: presets + whatever's been typed before, minus anything the
   *  merchant explicitly removed from the dropdown (stored in equipment-options-config). */
  const equipmentOptionConfig = tenant?.records["equipment-options-config"]?.[0];
  const hiddenEquipmentOptions: string[] = Array.isArray(equipmentOptionConfig?.hidden) ? equipmentOptionConfig!.hidden : [];
  const equipmentSuggestions = useMemo(() => {
    if (moduleId !== "equipment") return [];
    const seeds = ["冰箱", "冷柜", "海鲜池", "炉灶", "其他"];
    const used = rawRows.map((r) => (r.equipment || "").trim()).filter(Boolean);
    return Array.from(new Set([...seeds, ...used])).filter((v) => !hiddenEquipmentOptions.includes(v));
  }, [moduleId, rawRows, hiddenEquipmentOptions]);

  const removeEquipmentSuggestion = async (val: string) => {
    const next = Array.from(new Set([...hiddenEquipmentOptions, val]));
    const { error } = equipmentOptionConfig?.id
      ? await updateRecord(equipmentOptionConfig.id, { hidden: next })
      : await addRecord(slug, "equipment-options-config", { hidden: next });
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    setTick((t) => t + 1);
  };

  /** 设备维护 → 维修方: whatever's been typed before, minus anything the merchant
   *  explicitly removed from the dropdown (stored in equipment-vendor-config). */
  const vendorConfig = tenant?.records["equipment-vendor-config"]?.[0];
  const hiddenVendors: string[] = Array.isArray(vendorConfig?.hidden) ? vendorConfig!.hidden : [];
  const vendorSuggestions = useMemo(() => {
    if (moduleId !== "equipment") return [];
    const used = rawRows.map((r) => (r.vendor || "").trim()).filter(Boolean);
    return Array.from(new Set(used)).filter((v) => !hiddenVendors.includes(v));
  }, [moduleId, rawRows, hiddenVendors]);

  const removeVendorSuggestion = async (val: string) => {
    const next = Array.from(new Set([...hiddenVendors, val]));
    const { error } = vendorConfig?.id
      ? await updateRecord(vendorConfig.id, { hidden: next })
      : await addRecord(slug, "equipment-vendor-config", { hidden: next });
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    setTick((t) => t + 1);
  };

  /** 设备维护 → 问题/保养: whatever's been typed before, minus anything the merchant
   *  explicitly removed from the dropdown (stored in equipment-issue-config). */
  const issueConfig = tenant?.records["equipment-issue-config"]?.[0];
  const hiddenIssues: string[] = Array.isArray(issueConfig?.hidden) ? issueConfig!.hidden : [];
  const issueSuggestions = useMemo(() => {
    if (moduleId !== "equipment") return [];
    const used = rawRows.map((r) => (r.issue || "").trim()).filter(Boolean);
    return Array.from(new Set(used)).filter((v) => !hiddenIssues.includes(v));
  }, [moduleId, rawRows, hiddenIssues]);

  const removeIssueSuggestion = async (val: string) => {
    const next = Array.from(new Set([...hiddenIssues, val]));
    const { error } = issueConfig?.id
      ? await updateRecord(issueConfig.id, { hidden: next })
      : await addRecord(slug, "equipment-issue-config", { hidden: next });
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    setTick((t) => t + 1);
  };

  const rows: RecordRow[] = useMemo(() => {
    if (moduleId === "dish-margin") {
      const r2 = (n: number) => Math.round(n * 100) / 100;
      return rawRows.map((r) => {
        const revenue = r2((parseFloat(r.price) || 0) * (parseFloat(r.soldMonth) || 0));
        return { ...r, revenue: String(revenue) };
      });
    }
    if (moduleId === "stock-loss") {
      return computeStockLossFifo(rawRows);
    }
    return rawRows;
  }, [rawRows, moduleId]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (dateFrom || dateTo) {
      result = result.filter((r) => {
        const d = rowDate(r);
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
    if (moduleId === "daily-close") {
      result = [...result].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }
    return result;
  }, [rows, colFilters, dateFrom, dateTo, moduleId]);

  const hasAnyFilter = Object.values(colFilters).some((s) => s.size > 0) || !!dateFrom || !!dateTo;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Scheduling groups the week's rows by staff — one row per person (their
  // latest entry that week), with an arrow to expand the rest of their shifts.
  const groupByStaff = moduleId === "scheduling";
  // Equipment groups the history by device — one row per device (the latest
  // service), with an arrow to expand the rest of its maintenance history.
  const groupByEquipment = moduleId === "equipment";
  const staffGroups = useMemo(() => {
    const map = new Map<string, RecordRow[]>();
    for (const r of filteredRows) {
      const name = (r.staff as string)?.trim() || "—";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    }
    const groups = Array.from(map.entries()).map(([name, list]) => {
      const sorted = [...list].sort((a, b) => {
        const da = rowDate(a), db = rowDate(b);
        if (da !== db) return db.localeCompare(da);
        const sa = (a.start as string) || "", sb = (b.start as string) || "";
        return sb.localeCompare(sa);
      });
      return { name, list: sorted };
    });
    groups.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  }, [filteredRows]);

  const toggleStaffExpanded = (name: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const rowCells = (r: RecordRow, muted?: boolean) =>
    editingId === r.id ? (
      <>
        {mod.fields.map((f) => (
          <td key={f.key} className="px-2 py-1.5">
            <EditCellInput field={f} value={editForm[f.key] ?? ""} onChange={(v) => setEditForm((prev) => ({ ...prev, [f.key]: v }))} />
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
          <td key={f.key} className={`px-4 py-2.5 ${muted ? "text-ink-faint" : "text-ink-soft"}`}>
            {renderCell(f, r[f.key])}
          </td>
        ))}
        <td className="px-4 py-2.5 text-right whitespace-nowrap">
          <button onClick={() => startEdit(r)} className="text-xs text-brand hover:text-brand-soft mr-2">修改</button>
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
    );

  const alerts = useMemo(() => {
    const list: { type: "warn" | "info"; text: string }[] = [];
    if (moduleId === "stock-loss") {
      const latest: Record<string, { d: string; oh: number }> = {};
      const flow: Record<string, { in: number; scrap: number }> = {};
      for (const r of rows) {
        const item = r.item || "";
        if (!item) continue;
        const d = r.date || (r.createdAt ? String(r.createdAt).slice(0, 10) : "");
        if (r.onHand != null && r.onHand !== "" && (!latest[item] || d >= latest[item].d)) {
          latest[item] = { d, oh: parseFloat(r.onHand) || 0 };
        }
        const f = (flow[item] ??= { in: 0, scrap: 0 });
        f.in += parseFloat(r.inQty) || 0;
        f.scrap += parseFloat(r.scrapQty) || 0;
      }
      const totals: Record<string, number> = Object.fromEntries(
        Object.entries(latest).map(([k, v]) => [k, v.oh])
      );
      const low = Object.entries(totals).filter(([, v]) => v > 0 && v <= 5);
      const zero = Object.entries(totals).filter(([, v]) => v <= 0);
      if (zero.length) list.push({ type: "warn", text: `⚠️ 零库存：${zero.map(([k]) => k).join("、")}` });
      if (low.length) list.push({ type: "warn", text: `📉 低库存（≤5）：${low.map(([k, v]) => `${k}(${v})`).join("、")}` });
      const highScrap = Object.entries(flow)
        .filter(([, f]) => f.in > 0 && f.scrap / f.in >= 0.1)
        .map(([k, f]) => `${k}(${Math.round((f.scrap / f.in) * 100)}%)`);
      if (highScrap.length) list.push({ type: "warn", text: `🗑️ 报废率偏高（≥10%）：${highScrap.join("、")}` });
    }
    if (moduleId === "group-booking") {
      const today = shopToday();
      const upcoming = rows.filter((r) => r.date && r.date >= today && r.date <= addDays(today, 3));
      if (upcoming.length) list.push({ type: "info", text: `📅 近3天有 ${upcoming.length} 个预订：${upcoming.map((r) => `${r.date} ${r.customer || ""}(${r.guests || "?"}人)`).join("、")}` });
    }
    if (moduleId === "equipment") {
      // 紧急排在前面，同一优先级内维持原有（最新在前）顺序
      const open = rows
        .filter((r) => r.status === "待处理" || r.status === "处理中")
        .sort((a, b) => (a.priority === "紧急" ? -1 : 0) - (b.priority === "紧急" ? -1 : 0));
      if (open.length) {
        const urgentCount = open.filter((r) => r.priority === "紧急").length;
        list.push({
          type: "warn",
          text: `🔧 ${open.length} 个设备问题待处理${urgentCount ? `（${urgentCount} 个紧急）` : ""}：${open
            .map((r) => `${r.priority === "紧急" ? "⚠️" : ""}${r.equipment || ""}${r.issue ? "-" + r.issue : ""}`)
            .join("、")}`,
        });
      }
      // 保养到期提醒：下次保养日期已过期或在近7天内，跳过已停用和已确认处理过的
      const today = shopToday();
      const soon = addDays(today, 7);
      const due = rows.filter(
        (r) => r.nextService && r.nextService <= soon && r.status !== "停用" && r.servicedThrough !== r.nextService,
      );
      if (due.length) {
        const overdue = due.filter((r) => r.nextService < today);
        list.push({
          type: "warn",
          text: `🛠️ ${due.length} 台设备保养到期${overdue.length ? `（${overdue.length} 台已过期）` : ""}：${due
            .map((r) => `${r.equipment || "设备"}(${r.nextService})`)
            .join("、")}`,
        });
      }
    }
    if (moduleId === "reviews") {
      const unreplied = rows.filter((r) => r.replied !== "是" && parseFloat(r.rating) <= 3);
      if (unreplied.length) list.push({ type: "warn", text: `💬 ${unreplied.length} 条低分评价未回复` });
    }
    if (moduleId === "social") {
      const drafts = rows.filter((r) => r.status === "草稿" || r.status === "待发");
      if (drafts.length) list.push({ type: "info", text: `📣 ${drafts.length} 条内容待发布` });
    }
    if (moduleId === "members") {
      // 近7天（含今天）生日的会员，按 月-日 比对（忽略年份）
      const upcoming = new Set<string>();
      const base = shopToday();
      for (let i = 0; i < 7; i++) {
        upcoming.add(addDays(base, i).slice(5));
      }
      const bday = rows.filter((r) => r.birthday && upcoming.has(String(r.birthday).slice(5)));
      if (bday.length) {
        list.push({
          type: "info",
          text: `🎂 近7天 ${bday.length} 位会员生日：${bday.map((r) => `${r.name || r.phone || "?"}(${String(r.birthday).slice(5)})`).join("、")}`,
        });
      }
    }
    if (moduleId === "prep-signature") {
      // 卖断提醒：实际售出 ≥ 备货份数（且有备货）
      const soldOut = rows.filter((r) => (parseFloat(r.prepped) || 0) > 0 && (parseFloat(r.sold) || 0) >= (parseFloat(r.prepped) || 0));
      if (soldOut.length) {
        list.push({
          type: "warn",
          text: `🔥 卖断 ${soldOut.length} 次：${Array.from(new Set(soldOut.map((r) => r.dish).filter(Boolean))).join("、")}（可能少备了）`,
        });
      }
      // 浪费提醒：剩余/报废合计
      const waste = rows.reduce((a, r) => a + (parseFloat(r.leftover) || 0), 0);
      if (waste > 0) list.push({ type: "info", text: `♻️ 累计剩余/报废 ${Math.round(waste)} 份` });

      // 明日备货建议 = round(近7天该菜日均售出 × 1.1)，多备10%防卖断
      const cutoffStr = addDays(shopToday(), -7);
      const byDish: Record<string, { sold: number; days: Set<string> }> = {};
      for (const r of rows) {
        if (!r.dish || !r.date || r.date < cutoffStr) continue;
        const g = (byDish[r.dish] ??= { sold: 0, days: new Set() });
        g.sold += parseFloat(r.sold) || 0;
        g.days.add(r.date);
      }
      const suggest = Object.entries(byDish)
        .filter(([, g]) => g.days.size > 0)
        .map(([dish, g]) => `${dish} ${Math.round((g.sold / g.days.size) * 1.1)}份`);
      if (suggest.length) list.push({ type: "info", text: `📋 明日备货建议（近7天均销×1.1）：${suggest.join("、")}` });
    }
    return list;
  }, [rows, moduleId]);

  const autoFields = useMemo(() => {
    if (moduleId === "dish-margin") return new Set(["revenue"]);
    if (moduleId === "stock-loss") return new Set(["inQty", "unitCost", "onHand", "scrapValue", "lossValue"]);
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

  const displayFields = useMemo(() => {
    if (!mod) return [];
    if (moduleId === "stock-loss") {
      const order = ["item", "date", "type", "inQty", "unitCost", "scrapQty", "scrapValue", "lossQty", "lossValue", "onHand"];
      return [...mod.fields].sort((a, b) => {
        const ai = order.indexOf(a.key);
        const bi = order.indexOf(b.key);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    if (moduleId === "equipment") {
      const order = ["equipment", "date", "issue", "vendor", "cost", "status", "nextService", "intervalDays"];
      return [...mod.fields].sort((a, b) => {
        const ai = order.indexOf(a.key);
        const bi = order.indexOf(b.key);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return mod.fields;
  }, [mod, moduleId]);

  /** 设备维护 fields backed by a remembered/deletable suggestion list instead of the generic text input. */
  const equipmentSuggestFields: Record<string, { suggestions: string[]; remove: (v: string) => void; placeholder: string }> =
    moduleId === "equipment"
      ? {
          equipment: { suggestions: equipmentSuggestions, remove: removeEquipmentSuggestion, placeholder: "例：冰箱" },
          vendor: { suggestions: vendorSuggestions, remove: removeVendorSuggestion, placeholder: "例：XX 维修公司" },
          issue: { suggestions: issueSuggestions, remove: removeIssueSuggestion, placeholder: "例：压缩机异响" },
        }
      : {};

  useEffect(() => {
    if (!open || moduleId !== "daily-close") return;
    const date = form.date || shopToday();
    setAutoFilling(true);
    computeDailyClose(slug, date).then((result) => {
      setForm((prev) => {
        const next = {
          ...prev,
          date,
          dineIn: result.dineIn !== "0" ? result.dineIn : prev.dineIn ?? "",
          delivery: result.delivery !== "0" ? result.delivery : prev.delivery ?? "",
          expenses: result.expenses !== "0" ? result.expenses : prev.expenses ?? "",
          tips: result.tips !== "0" ? result.tips : prev.tips ?? "",
        };
        return applyComputed(next, mod?.computed);
      });
      setAutoFilling(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateForm = useCallback(
    (key: string, value: string) => {
      setForm((prev) => {
        let next = { ...prev, [key]: value };
        // 设备维护：填了保养周期、但还没手动填下次保养日期时，自动算一个出来
        // （日期字段 + 周期天数，日期没填就用今天）——算出来的值会显示在下次
        // 保养日期那栏，可以直接改掉，不会覆盖已经手动填过的日期。
        if (moduleId === "equipment" && key === "intervalDays" && !prev.nextService) {
          const days = parseInt(value, 10);
          if (days > 0) {
            const base = prev.date || shopToday();
            next = { ...next, nextService: addDays(base, days) };
          }
        }
        return applyComputed(next, mod?.computed);
      });
    },
    [mod, moduleId]
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

  // staff access[] enforcement: a member with a restricted module list can't
  // open other modules by URL (sidebar already hides them).
  if (allowed && !allowed.includes(moduleId)) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <div className="text-3xl">🔒</div>
          <p className="mt-2 text-sm text-ink-soft">你没有这个模块的访问权限，请联系店主。</p>
          <Link href={`/${slug}`} className="btn-primary mt-4 inline-block">← 返回总览</Link>
        </div>
      </main>
    );
  }

  if (mod.portal && PORTALS[moduleId]) {
    const Portal = PORTALS[moduleId];
    return <Portal slug={slug} mod={mod} />;
  }

  const enabled = tenant.enabled.includes(moduleId);

  const handleEquipmentPhotoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingPhoto(true);
    // replace any previously uploaded photo for this draft — re-picking a photo
    // shouldn't leave the first upload orphaned in storage.
    if (form.photo_url) await deleteEquipmentPhoto(form.photo_url);
    const up = await uploadEquipmentPhoto(slug, file);
    setUploadingPhoto(false);
    if (up.error) {
      alert("照片上传失败：" + up.error);
      return;
    }
    updateForm("photo_url", up.url ?? "");
  };

  const submit = async () => {
    const missing = mod.fields.filter((f) => f.required && !form[f.key]?.trim());
    if (missing.length) {
      alert("请填写：" + missing.map((f) => f.label.zh).join("、"));
      return;
    }
    // 设备维护：填了「下次保养日期」的话，这条刚提交的记录本身标记成"已经为这个
    // 下次保养日期建好提醒了"（servicedThrough），不然它自己也会因为没有
    // servicedThrough 而被保养清单/提醒栏当成"还没处理"，跟下面新建的那条提醒
    // 记录重复出现两次。真正承担提醒任务的是下面新建的那条独立记录。
    const toSave = moduleId === "equipment" && form.nextService ? { ...form, servicedThrough: form.nextService } : form;
    const { error } = await addRecord(slug, moduleId, toSave);
    if (error) {
      // The insert never happened, so nothing points at the photo we just
      // uploaded — clean it up instead of leaving an orphan.
      if (form.photo_url) await deleteEquipmentPhoto(form.photo_url);
      alert("保存失败，请重试：" + error);
      return;
    }
    if (moduleId === "purchasing") {
      await syncPurchasingToStock(slug);
    }
    // 和 markServiced 里"自动生成下一周期"是同一套逻辑，只是这里是新增时就建好，
    // 不用等点了"本次已保养"才生成。
    if (moduleId === "equipment" && form.nextService) {
      const { error: reminderError } = await addRecord(slug, "equipment", {
        equipment: form.equipment || "",
        issue: form.issue || "",
        vendor: form.vendor || "",
        cost: "",
        status: "待处理",
        date: form.nextService,
        nextService: form.nextService,
        intervalDays: form.intervalDays || "",
      });
      if (reminderError) alert("记录已保存，但保养提醒创建失败，请手动补上：" + reminderError);
    }
    const orderModules = ["group-booking"];
    if (orderModules.includes(moduleId) && form.phone) {
      await syncMemberFromOrder(
        slug,
        form.phone,
        form.customer || "",
        parseFloat(form.amount || form.total || "0") || 0,
      );
    }
    setForm({});
    setShiftPreset("custom");
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
    // Re-run computed rules (pay=hours×rate, net, balance, total…) so an inline
    // edit keeps derived fields consistent, same as the entry form does.
    const { error } = await updateRecord(editingId, applyComputed(editForm, mod?.computed));
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    setEditingId(null);
    setEditForm({});
    setTick((t) => t + 1);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const total = mod.amountKey ? sum(rows, mod.amountKey) : 0;
  const statsRows =
    statsRange === "custom"
      ? rows.filter((r) => {
          const d = rowDate(r);
          if (!d) return false;
          if (customStatsFrom && d < customStatsFrom) return false;
          if (customStatsTo && d > customStatsTo) return false;
          return true;
        })
      : statsRange > 0
      ? filterByDateRange(rows, statsRange)
      : rows;
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
            <button
              onClick={() => setStatsRange("custom")}
              className={`rounded-md px-2.5 py-1 ${statsRange === "custom" ? "bg-white font-medium shadow-sm text-ink" : "text-ink-faint"}`}
            >
              自定义
            </button>
          </div>
          {statsRange === "custom" && (
            <div className="flex items-center gap-1.5 text-xs text-ink-faint">
              <input
                type="date"
                className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
                value={customStatsFrom}
                onChange={(e) => setCustomStatsFrom(e.target.value)}
              />
              <span>—</span>
              <input
                type="date"
                className="rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
                value={customStatsTo}
                onChange={(e) => setCustomStatsTo(e.target.value)}
              />
            </div>
          )}
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
              <div className="text-xs text-ink-faint">
                {statsRange === "custom" ? "该时段" : statsRange === 0 ? "累计" : `近${statsRange}天`}
                {mod.amountLabel?.zh ?? "合计"}
              </div>
              <div className="mt-1 text-xl font-bold text-ink">
                {mod.amountKind === "money" ? money(sum(statsRows, mod.amountKey)) : num(sum(statsRows, mod.amountKey))}
              </div>
            </div>
          )}
          {moduleId === "stock-loss" && (
            <div className="card p-4">
              <div className="text-xs text-ink-faint">累计报废价值</div>
              <div className="mt-1 text-xl font-bold text-red-600">{money(sum(statsRows, "scrapValue"))}</div>
            </div>
          )}
          {/* summable field stats */}
          {summableFields
            .filter((f) => f.key !== mod.amountKey && moduleId !== "stock-loss")
            .slice(0, mod.amountKey ? 2 : 3)
            .map((f) => {
              const fmt = (v: number) => (f.type === "money" ? money(v) : num(v));
              // 单价类字段（售价/时薪/单价…）求和无意义，只展示均值
              if (f.unit) {
                return (
                  <div key={f.key} className="card p-4">
                    <div className="text-xs text-ink-faint">{f.label.zh}（均值）</div>
                    <div className="mt-1 text-xl font-bold text-ink">{fmt(avg(statsRows, f.key))}</div>
                  </div>
                );
              }
              return (
                <div key={f.key} className="card p-4">
                  <div className="text-xs text-ink-faint">{f.label.zh}（合计 / 均值）</div>
                  <div className="mt-1 text-xl font-bold text-ink">{fmt(sum(statsRows, f.key))}</div>
                  <div className="text-xs text-ink-faint">均值: {fmt(avg(statsRows, f.key))}</div>
                </div>
              );
            })}
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

      {/* module-specific analytics (毛利排行 / 供应商比价 / 评价类别 / 本月保养清单…) */}
      <ModuleInsights moduleId={moduleId} rows={rows} slug={slug} refresh={() => setTick((t) => t + 1)} />

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
          {moduleId === "daily-close" && autoFilling && (
            <div className="mb-4 text-xs text-ink-faint">汇算中…</div>
          )}

          {moduleId === "scheduling" && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">班次</label>
                <button
                  type="button"
                  onClick={() => (editingPresets ? setEditingPresets(false) : openPresetEditor())}
                  className="text-xs font-medium text-brand hover:text-brand-soft"
                >
                  {editingPresets ? "完成" : "修改默认班次"}
                </button>
              </div>

              {editingPresets ? (
                <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                  {SHIFT_PRESETS.map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs font-medium text-ink-soft">{p.name}</span>
                      <input
                        type="time"
                        value={presetForm[`${p.key}Start`] ?? p.start}
                        onChange={(e) => setPresetForm((f) => ({ ...f, [`${p.key}Start`]: e.target.value }))}
                        className="input !w-auto !py-1.5 !text-xs"
                      />
                      <span className="text-xs text-ink-faint">–</span>
                      <input
                        type="time"
                        value={presetForm[`${p.key}End`] ?? p.end}
                        onChange={(e) => setPresetForm((f) => ({ ...f, [`${p.key}End`]: e.target.value }))}
                        className="input !w-auto !py-1.5 !text-xs"
                      />
                    </div>
                  ))}
                  <button type="button" onClick={savePresets} className="btn-primary !py-1.5 !text-xs">
                    保存默认班次
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {effectivePresets.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setShiftPreset(p.key);
                        updateForm("start", p.start);
                        updateForm("end", p.end);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        shiftPreset === p.key ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"
                      }`}
                    >
                      {p.name} {p.start}–{p.end}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShiftPreset("custom")}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      shiftPreset === "custom" ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-slate-50"
                    }`}
                  >
                    自定义
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {mod.fields
              .filter((f) => !(moduleId === "stock-loss" && autoFields.has(f.key)))
              .map((f) => (
              <div key={f.key} className={f.half ? "" : "sm:col-span-2"}>
                {equipmentSuggestFields[f.key] ? (
                  <div>
                    <label className="label">
                      {f.label.zh}
                      {f.required && <span className="text-red-500"> *</span>}
                    </label>
                    <SuggestInput
                      value={form[f.key] ?? ""}
                      onChange={(v) => updateForm(f.key, v)}
                      suggestions={equipmentSuggestFields[f.key].suggestions}
                      onRemoveSuggestion={equipmentSuggestFields[f.key].remove}
                      placeholder={equipmentSuggestFields[f.key].placeholder}
                    />
                  </div>
                ) : (
                  <FieldInput
                    field={f}
                    value={form[f.key] ?? ""}
                    onChange={(v) => {
                      updateForm(f.key, v);
                      if (moduleId === "scheduling" && (f.key === "start" || f.key === "end")) setShiftPreset("custom");
                    }}
                    readOnly={computedTargets.has(f.key)}
                    suggestions={textSuggestions[f.key]}
                  />
                )}
              </div>
            ))}
          </div>
          {moduleId === "equipment" && (
            <div className="mt-3">
              <label className="label">照片（可选）</label>
              {form.photo_url ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.photo_url} alt="设备照片" className="h-16 w-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    className="text-xs text-ink-faint hover:text-red-600"
                    onClick={async () => {
                      await deleteEquipmentPhoto(form.photo_url);
                      updateForm("photo_url", "");
                    }}
                  >
                    移除
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingPhoto}
                  className="input !py-1.5 text-xs"
                  onChange={(e) => handleEquipmentPhotoUpload(e.target.files?.[0] ?? null)}
                />
              )}
              {uploadingPhoto && <p className="mt-1 text-xs text-ink-faint">上传中…</p>}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={submit}>保存</button>
            <button
              className="btn-ghost"
              onClick={() => {
                if (form.photo_url) deleteEquipmentPhoto(form.photo_url);
                setForm({});
                setShiftPreset("custom");
                setOpen(false);
              }}
            >
              取消
            </button>
          </div>
        </section>
      )}

      {/* date range & filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {moduleId === "scheduling" ? (
          <div className="flex items-center gap-1.5">
            <button
              className="rounded border border-slate-200 px-2 py-1 text-ink-soft hover:bg-slate-50"
              onClick={() => setWeekAnchor((d) => addDays(d, -7))}
            >
              ‹ 上一周
            </button>
            <span className="min-w-[9.5rem] text-center font-medium text-ink">
              {fmtMonthDay(dateFrom)} – {fmtMonthDay(dateTo)}
            </span>
            <button
              className="rounded border border-slate-200 px-2 py-1 text-ink-soft hover:bg-slate-50"
              onClick={() => setWeekAnchor((d) => addDays(d, 7))}
            >
              下一周 ›
            </button>
            <button
              className="text-brand hover:text-brand-soft"
              onClick={() => setWeekAnchor(shopToday())}
            >
              本周
            </button>
            {copyMode ? (
              <>
                <span className="text-ink-faint">已选 {selectedForCopy.size} / {filteredRows.length} 条</span>
                <button
                  disabled={selectedForCopy.size === 0 || copyingWeek}
                  onClick={confirmCopySelection}
                  className="rounded-full border border-brand bg-brand px-3 py-1 font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copyingWeek ? "复制中…" : `复制 ${selectedForCopy.size} 条到下一周 →`}
                </button>
                <button onClick={cancelCopySelection} className="text-ink-faint hover:text-ink">
                  取消
                </button>
              </>
            ) : (
              <button
                disabled={filteredRows.length === 0}
                onClick={startCopySelection}
                className="rounded-full border border-brand px-3 py-1 font-semibold text-brand hover:bg-brand-wash disabled:cursor-not-allowed disabled:opacity-40"
              >
                复制到下一周 →
              </button>
            )}
          </div>
        ) : (
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
        )}
        {moduleId === "scheduling"
          ? Object.values(colFilters).some((s) => s.size > 0) && (
              <>
                <span className="text-ink-faint">筛选中：{filteredRows.length} / {rows.length} 条</span>
                <button className="text-brand hover:text-brand-soft" onClick={() => { setColFilters({}); setPage(1); }}>
                  清除筛选
                </button>
              </>
            )
          : hasAnyFilter && (
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

      {moduleId === "scheduling" && <AttendanceAnomalies rows={filteredRows} />}

      {/* records table */}
      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
                {(moduleId === "stock-loss" || groupByEquipment) && <th className="w-8 px-2 py-2.5"></th>}
                {groupByStaff && (
                  <th className="w-8 px-2 py-2.5">
                    {copyMode && (
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-brand"
                        checked={filteredRows.length > 0 && selectedForCopy.size === filteredRows.length}
                        onChange={toggleSelectAllForCopy}
                        aria-label="全选"
                      />
                    )}
                  </th>
                )}
                {displayFields.map((f) => {
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
              {moduleId === "stock-loss" || groupByEquipment ? (
                <GroupedRows
                  rows={pagedRows}
                  fields={displayFields}
                  groupKey={groupByEquipment ? "equipment" : "item"}
                  compactDates={groupByEquipment}
                  expandedItems={expandedItems}
                  setExpandedItems={setExpandedItems}
                  editingId={editingId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  startEdit={startEdit}
                  saveEdit={saveEdit}
                  cancelEdit={cancelEdit}
                  deleteRecord={async (id) => {
                    if (moduleId === "equipment") {
                      const photoUrl = filteredRows.find((r) => r.id === id)?.photo_url;
                      if (photoUrl) await deleteEquipmentPhoto(photoUrl);
                    }
                    await deleteRecord(id);
                    setTick((t) => t + 1);
                  }}
                />
              ) : groupByStaff
                ? staffGroups.map((g) => {
                    const [latest, ...rest] = g.list;
                    if (!latest) return null;
                    const isExpanded = expandedStaff.has(g.name);
                    return (
                      <Fragment key={g.name}>
                        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                          <td className="px-2 py-2.5 text-center">
                            {copyMode ? (
                              <input
                                type="checkbox"
                                className="h-3.5 w-3.5 accent-brand"
                                checked={selectedForCopy.has(latest.id)}
                                onChange={() => toggleSelectForCopy(latest.id)}
                              />
                            ) : (
                              rest.length > 0 && (
                                <button
                                  onClick={() => toggleStaffExpanded(g.name)}
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-xl leading-none text-ink-soft hover:border-brand hover:bg-brand-wash hover:text-brand-ink"
                                  aria-label={isExpanded ? "收起" : "展开"}
                                >
                                  {isExpanded ? "▾" : "▸"}
                                </button>
                              )
                            )}
                          </td>
                          {rowCells(latest)}
                        </tr>
                        {isExpanded &&
                          rest.map((r) => (
                            <tr key={r.id} className="border-b border-slate-50 bg-slate-50/40 last:border-0 hover:bg-slate-50">
                              <td className="px-2 py-2.5 text-center">
                                {copyMode && (
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-brand"
                                    checked={selectedForCopy.has(r.id)}
                                    onChange={() => toggleSelectForCopy(r.id)}
                                  />
                                )}
                              </td>
                              {rowCells(r, true)}
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })
                : pagedRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      {rowCells(r)}
                    </tr>
                  ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={mod.fields.length + 1 + (groupByStaff ? 1 : 0)} className="px-4 py-10 text-center text-sm text-ink-faint">
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
        {!groupByStaff && totalPages > 1 && (
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
  suggestions,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  suggestions?: string[];
}) {
  const listId = suggestions?.length ? `dl-${field.key}` : undefined;
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
        <>
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
            list={listId}
          />
          {listId && (
            <datalist id={listId}>
              {suggestions!.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      )}
    </div>
  );
}

/** Weekly attendance-exception summary for the scheduling module: staff with
 *  迟到/请假 this week (计划内的 休息/正常 不算异常). `rows` is expected to
 *  already be scoped to the selected week. */
function AttendanceAnomalies({ rows }: { rows: RecordRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const r of rows) {
      const att = (r.attendance as string) || "";
      if (!att || att === "正常" || att === "休息") continue;
      const name = (r.staff as string)?.trim() || "—";
      if (!map.has(name)) map.set(name, {});
      const counts = map.get(name)!;
      counts[att] = (counts[att] || 0) + 1;
    }
    return Array.from(map.entries())
      .map(([name, counts]) => ({ name, counts }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const g of groups) {
      for (const [k, v] of Object.entries(g.counts)) t[k] = (t[k] || 0) + v;
    }
    return t;
  }, [groups]);

  return (
    <section className="card mb-4 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">本周异常出勤</h2>
        {groups.length > 0 && (
          <span className="text-xs text-ink-faint">{Object.entries(totals).map(([k, v]) => `${k} ${v} 次`).join(" · ")}</span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-faint">本周出勤正常，暂无异常记录。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <div key={g.name} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs">
              <span className="font-medium text-ink">{g.name}</span>
              {Object.entries(g.counts).map(([k, v]) => (
                <span key={k} className="rounded-full bg-white px-2 py-0.5 font-medium text-amber-700">
                  {k} ×{v}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Per-module analytics blocks that the generic stats/alerts can't express. */
function ModuleInsights({ moduleId, rows, slug, refresh }: { moduleId: string; rows: RecordRow[]; slug: string; refresh: () => void }) {
  if (moduleId === "dish-margin") return <DishSalesRanking rows={rows} />;
  if (moduleId === "purchasing") return <SupplierCompare rows={rows} />;
  if (moduleId === "reviews") return <ReviewTopics rows={rows} />;
  if (moduleId === "members") return <TierSettings slug={slug} />;
  if (moduleId === "equipment") {
    return (
      <>
        <EquipmentMonthlyChecklist rows={rows} slug={slug} refresh={refresh} />
        <EquipmentRoster rows={rows} />
      </>
    );
  }
  return null;
}

/** 本月到期保养清单：把「下次保养日期」落在本月及之前（含逾期）的设备列出来，做成
 *  可勾选的清单。这里只看 nextService，不看 status —— status 记录的是"这条维修/问题
 *  是否处理好了"，跟"下次保养提醒是否还没到"是两码事：同一台设备可以问题已解决
 *  （status=已完成）但下次保养日期仍落在本月，这时候仍然要出现在清单里。 */
function EquipmentMonthlyChecklist({ rows, slug, refresh }: { rows: RecordRow[]; slug: string; refresh: () => void }) {
  const [savingId, setSavingId] = useState<string | null>(null);

  const due = useMemo(() => {
    // Shop-timezone Y-M-D throughout, not the viewing device's own clock — a
    // remote owner checking this near midnight or a month boundary must see
    // the same due/overdue list a device physically at the shop would.
    const todayStr = shopToday();
    const [y, m] = todayStr.split("-").map(Number);
    const nextMonthFirst = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const monthEnd = addDays(nextMonthFirst, -1);
    return rows
      // servicedThrough records which nextService value was already acknowledged —
      // once it matches the current nextService, this cycle's reminder is done.
      // (We never touch nextService itself, so the date stays visible in the
      // history table instead of getting wiped out.) 停用设备不再提醒。
      .filter((r) => r.nextService && r.nextService <= monthEnd && r.servicedThrough !== r.nextService && r.status !== "停用")
      .map((r) => ({ ...r, overdue: r.nextService < todayStr }) as RecordRow & { overdue: boolean })
      .sort((a, b) => (a.equipment || "").localeCompare(b.equipment || "") || (a.nextService || "").localeCompare(b.nextService || ""));
  }, [rows]);

  if (due.length === 0) return null;

  /** "本次已保养" acknowledges this cycle's reminder without touching nextService
   *  itself, so the due-date stays intact in the history table. It reappears
   *  once the merchant edits nextService forward to a new date. Doesn't touch
   *  status either — status tracks the logged issue/repair, not this reminder. */
  const markServiced = async (r: RecordRow) => {
    setSavingId(r.id);
    const { id, createdAt, overdue, ...data } = r as any;
    // status is now safe to set here — the checklist's due-list filter only
    // looks at nextService/servicedThrough, not status, so this won't hide a
    // still-due reminder. It just gives clear feedback in the table.
    const { error } = await updateRecord(r.id, { ...data, status: "已完成", servicedThrough: r.nextService });
    if (error) {
      // Don't refresh on failure — it would just reload the same unchanged
      // row, making it look like the action silently did nothing.
      setSavingId(null);
      alert("操作失败，请重试：" + error);
      return;
    }
    // Only spawn the next cycle when there's a fixed 保养周期 to compute it
    // from — otherwise there's nothing to schedule, and an empty placeholder
    // row just clutters the table. `date` mirrors the new nextService: this
    // record represents when that maintenance is due, not when the reminder
    // happened to get auto-generated.
    const intervalDays = parseInt(r.intervalDays, 10);
    if (intervalDays > 0 && r.nextService) {
      const newNextService = addDays(r.nextService, intervalDays);
      const { error: nextError } = await addRecord(slug, "equipment", {
        equipment: r.equipment || "",
        date: newNextService,
        issue: r.issue || "",
        vendor: r.vendor || "",
        cost: "",
        status: "待处理",
        nextService: newNextService,
        intervalDays: r.intervalDays,
      });
      // The "已完成" mark above already succeeded — don't hide that — but the
      // next reminder cycle silently failing to spawn would mean this piece
      // of equipment just stops getting maintenance reminders, unnoticed.
      if (nextError) alert("已保养已记录，但下一周期提醒创建失败，请手动补上：" + nextError);
    }
    setSavingId(null);
    refresh();
  };

  return (
    <section className="card mb-6 p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">本月保养清单</div>
        <span className="text-xs text-ink-faint">{due.length} 项待处理</span>
      </div>
      <p className="mb-3 text-xs text-ink-faint">下次保养日期落在本月（含已逾期）的设备，与「是否合格/已完成」无关</p>
      <div className="space-y-1.5">
        {due.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5 text-sm">
            {r.priority === "紧急" && <span className="text-red-600" title="紧急">⚠️</span>}
            <span className="font-medium text-ink">{r.equipment || "设备"}</span>
            {r.issue && <span className="text-ink-soft">{r.issue}</span>}
            <span className={`ml-auto text-xs font-medium tabular-nums ${r.overdue ? "text-red-600" : "text-ink-faint"}`}>
              {r.overdue ? `已逾期 · ${r.nextService}` : r.nextService}
            </span>
            <button
              className="btn-primary !py-1 !text-xs"
              disabled={savingId === r.id}
              onClick={() => markServiced(r)}
            >
              {savingId === r.id ? "…" : "本次已保养"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 设备总览：每台设备当前状态、下次保养日期、累计维修费用一览——不用逐条翻历史表
 *  去拼"这台设备到底花了多少钱、现在是什么状态"。按累计费用从高到低排，费用最高的
 *  设备最值得关注（可能该考虑换新的了）。 */
function EquipmentRoster({ rows }: { rows: RecordRow[] }) {
  const roster = useMemo(() => {
    const byEquipment = new Map<string, RecordRow[]>();
    for (const r of rows) {
      const name = (r.equipment || "").trim();
      if (!name) continue;
      (byEquipment.get(name) ?? byEquipment.set(name, []).get(name)!).push(r);
    }
    return Array.from(byEquipment.entries())
      .map(([name, recs]) => {
        const sorted = [...recs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        const latest = sorted[0];
        const totalCost = recs.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
        const openCount = recs.filter((r) => r.status === "待处理" || r.status === "处理中").length;
        return { name, latest, totalCost, openCount };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [rows]);

  if (roster.length < 2) return null;

  return (
    <section className="card mb-6 p-5">
      <div className="mb-1 text-sm font-semibold text-ink">设备总览</div>
      <p className="mb-3 text-xs text-ink-faint">按累计维修费用从高到低排——花费最多的设备可能该考虑换新的了</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
              <th className="px-3 py-2 font-medium">设备</th>
              <th className="px-3 py-2 font-medium">当前状态</th>
              <th className="px-3 py-2 font-medium">下次保养</th>
              <th className="px-3 py-2 font-medium text-right">累计维修费用</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((e) => (
              <tr key={e.name} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium text-ink">
                  {e.name}
                  {e.openCount > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700">{e.openCount} 个待处理</span>}
                </td>
                <td className="px-3 py-2 text-ink-soft">
                  {e.latest?.status === "停用" ? <span className="text-ink-faint">已停用</span> : (e.latest?.status || "—")}
                </td>
                <td className="px-3 py-2 text-ink-soft">{e.latest?.nextService || "—"}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{money(e.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TierSettings({ slug }: { slug: string }) {
  const [tiers, setTiers] = useState<TierRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadTierRules(slug).then((t) => { setTiers(t); setLoaded(true); });
  }, [slug]);

  const update = (i: number, field: "name" | "minSpend", value: string) => {
    setTiers((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === "minSpend" ? parseFloat(value) || 0 : value };
      return next;
    });
  };

  const add = () => setTiers((prev) => [...prev, { name: "", minSpend: 0 }]);

  const remove = (i: number) => setTiers((prev) => prev.filter((_, j) => j !== i));

  const save = async () => {
    const valid = tiers.filter((t) => t.name.trim());
    if (!valid.length) return;
    setSaving(true);
    setMsg("");
    await saveTierRules(slug, valid);
    const updated = await reapplyTiers(slug);
    setTiers(valid.sort((a, b) => a.minSpend - b.minSpend));
    setMsg(updated > 0 ? `已保存，${updated} 位会员等级已更新` : "已保存");
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <section className="card mb-6 p-5">
      <button
        className="flex w-full items-center justify-between text-sm font-semibold text-ink"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>会员等级规则</span>
        <span className={`text-xl leading-none transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>
      {expanded && (
        <>
          <p className="mt-3 mb-3 text-xs text-ink-faint">设定累计消费满多少自动升级，保存后立即生效</p>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                  placeholder="等级名称"
                  value={t.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                />
                <span className="text-xs text-ink-faint">满</span>
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-brand"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={t.minSpend || ""}
                  onChange={(e) => update(i, "minSpend", e.target.value)}
                />
                <span className="text-xs text-ink-faint">元</span>
                {tiers.length > 1 && (
                  <button className="text-xs text-red-400 hover:text-red-600" onClick={() => remove(i)}>删除</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-ghost border border-slate-300 text-xs" onClick={add}>+ 新增等级</button>
            <button className="btn-primary text-xs" onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存并应用"}
            </button>
            {msg && <span className="text-xs text-emerald-600">{msg}</span>}
          </div>
        </>
      )}
    </section>
  );
}

function DishSalesRanking({ rows }: { rows: RecordRow[] }) {
  const ranked = useMemo(() => {
    return rows
      .map((r) => {
        const price = parseFloat(r.price) || 0;
        const sold = parseFloat(r.soldMonth) || 0;
        const revenue = price * sold;
        return { dish: r.dish || "—", price, sold, revenue };
      })
      .filter((d) => d.sold > 0)
      .sort((a, b) => b.sold - a.sold);
  }, [rows]);

  if (ranked.length < 2) return null;
  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse().filter((d) => !top.includes(d));

  return (
    <section className="card mb-6 p-5">
      <div className="mb-3 text-sm font-semibold text-ink">销量排行</div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-1.5 text-xs font-semibold text-emerald-700">⭐ 最受欢迎</div>
          {top.map((d) => (
            <div key={d.dish} className="flex justify-between text-xs text-emerald-900">
              <span>{d.dish}</span>
              <span className="font-medium">{d.sold} 份 · {money(d.revenue)}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-1.5 text-xs font-semibold text-amber-700">🐢 销量最低</div>
          {bottom.length ? bottom.map((d) => (
            <div key={d.dish} className="flex justify-between text-xs text-amber-900">
              <span>{d.dish}</span>
              <span className="font-medium">{d.sold} 份 · {money(d.revenue)}</span>
            </div>
          )) : <div className="text-xs text-amber-700/60">菜品太少，暂无</div>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-ink-faint">
              <th className="py-1.5 pr-3 font-medium">菜名</th>
              <th className="py-1.5 px-3 font-medium text-right">售价</th>
              <th className="py-1.5 px-3 font-medium text-right">月销</th>
              <th className="py-1.5 pl-3 font-medium text-right">销售额</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d) => (
              <tr key={d.dish} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-ink">{d.dish}</td>
                <td className="py-1.5 px-3 text-right text-ink-soft">{money(d.price)}</td>
                <td className="py-1.5 px-3 text-right text-ink-soft">{d.sold}</td>
                <td className="py-1.5 pl-3 text-right font-medium text-ink">{money(d.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 供应商比价：同一品项跨供应商的均价对比，标出最低价。 */
function SupplierCompare({ rows }: { rows: RecordRow[] }) {
  const items = useMemo(() => {
    // item → supplier → {sum, n}
    const map: Record<string, Record<string, { sum: number; n: number }>> = {};
    for (const r of rows) {
      const item = r.item || "";
      const supplier = r.supplier || "";
      const price = parseFloat(r.unitPrice) || 0;
      if (!item || !supplier || price <= 0) continue;
      const s = ((map[item] ??= {})[supplier] ??= { sum: 0, n: 0 });
      s.sum += price;
      s.n += 1;
    }
    return Object.entries(map)
      .map(([item, suppliers]) => {
        const list = Object.entries(suppliers)
          .map(([supplier, v]) => ({ supplier, avg: v.sum / v.n }))
          .sort((a, b) => a.avg - b.avg);
        return { item, list };
      })
      .filter((x) => x.list.length >= 2); // 只显示有比价意义的（≥2 家）
  }, [rows]);

  if (!items.length) return null;

  return (
    <section className="card mb-6 p-5">
      <div className="mb-1 text-sm font-semibold text-ink">供应商比价</div>
      <div className="mb-3 text-xs text-ink-faint">同一品项各供应商的平均单价，绿色为最低价</div>
      <div className="space-y-3">
        {items.map(({ item, list }) => {
          const cheapest = list[0].avg;
          const dearest = list[list.length - 1].avg;
          const save = dearest - cheapest;
          return (
            <div key={item} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{item}</span>
                {save > 0 && (
                  <span className="text-xs text-emerald-600">最低比最高省 {money(save)}/单位</span>
                )}
              </div>
              <div className="space-y-1">
                {list.map((s, i) => (
                  <div key={s.supplier} className="flex items-center gap-2 text-xs">
                    <span className={`w-28 shrink-0 ${i === 0 ? "font-medium text-emerald-700" : "text-ink-soft"}`}>
                      {i === 0 ? "✓ " : ""}{s.supplier}
                    </span>
                    <div className="h-2 flex-1 rounded bg-slate-100">
                      <div
                        className={`h-2 rounded ${i === 0 ? "bg-emerald-400" : "bg-slate-300"}`}
                        style={{ width: `${Math.max(6, (s.avg / dearest) * 100)}%` }}
                      />
                    </div>
                    <span className={`w-16 shrink-0 text-right ${i === 0 ? "font-medium text-emerald-700" : "text-ink-soft"}`}>
                      {money(s.avg)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 评价问题类别统计：各 topic 的条数与平均分。 */
function ReviewTopics({ rows }: { rows: RecordRow[] }) {
  const topics = useMemo(() => {
    const map: Record<string, { n: number; ratingSum: number; ratingN: number }> = {};
    for (const r of rows) {
      const topic = r.topic || "";
      if (!topic) continue;
      const t = (map[topic] ??= { n: 0, ratingSum: 0, ratingN: 0 });
      t.n += 1;
      const rating = parseFloat(r.rating);
      if (!isNaN(rating)) { t.ratingSum += rating; t.ratingN += 1; }
    }
    return Object.entries(map)
      .map(([topic, v]) => ({ topic, n: v.n, avg: v.ratingN ? v.ratingSum / v.ratingN : null }))
      .sort((a, b) => b.n - a.n);
  }, [rows]);

  if (!topics.length) return null;
  const max = Math.max(...topics.map((t) => t.n), 1);

  return (
    <section className="card mb-6 p-5">
      <div className="mb-3 text-sm font-semibold text-ink">问题类别统计</div>
      <div className="space-y-2">
        {topics.map((t) => (
          <div key={t.topic} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-ink-soft">{t.topic}</span>
            <div className="h-3 flex-1 rounded bg-slate-100">
              <div
                className={`h-3 rounded ${t.topic === "好评" ? "bg-emerald-400" : "bg-brand/60"}`}
                style={{ width: `${(t.n / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-ink">{t.n} 条</span>
            <span className="w-14 shrink-0 text-right text-ink-faint">
              {t.avg != null ? `${(Math.round(t.avg * 10) / 10)}★` : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
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
