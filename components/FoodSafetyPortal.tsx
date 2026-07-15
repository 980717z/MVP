"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ModuleDef } from "@/lib/catalog";
import { listRecords, addRecord, updateRecord, deleteRecord, type RecordRow } from "@/lib/store";
import { addDays, mondayOf, shopHm, shopToday } from "@/lib/shopTime";
import { useLang, type Dict } from "@/app/i18n";
import SuggestInput from "@/components/SuggestInput";

const CATEGORIES: Dict[] = [
  { zh: "温度", en: "Temp", fr: "Température" },
  { zh: "开店清单", en: "Opening", fr: "Ouverture" },
  { zh: "关店清单", en: "Closing", fr: "Fermeture" },
  { zh: "清洁", en: "Cleaning", fr: "Nettoyage" },
  { zh: "其他", en: "Other", fr: "Autre" },
];

const WEEKDAYS: { d: number; zh: string; en: string; fr: string }[] = [
  { d: 1, zh: "一", en: "Mon", fr: "Lun" },
  { d: 2, zh: "二", en: "Tue", fr: "Mar" },
  { d: 3, zh: "三", en: "Wed", fr: "Mer" },
  { d: 4, zh: "四", en: "Thu", fr: "Jeu" },
  { d: 5, zh: "五", en: "Fri", fr: "Ven" },
  { d: 6, zh: "六", en: "Sat", fr: "Sam" },
  { d: 0, zh: "日", en: "Sun", fr: "Dim" },
];

const PASS_OPTIONS: { value: string; zh: string; en: string; fr: string }[] = [
  { value: "是", zh: "合格", en: "Pass", fr: "Conforme" },
  { value: "否", zh: "不合格", en: "Fail", fr: "Non conforme" },
];

/** Match a stored category value against a preset by ANY of its languages —
 *  storage is always meant to be the canonical `zh` key, but this also
 *  matches en/fr so a pre-fix record saved under a translated label still
 *  resolves back to the same preset instead of looking like a distinct,
 *  unrelated custom category. */
function matchPreset(raw: string): Dict | undefined {
  return CATEGORIES.find((c) => c.zh === raw || c.en === raw || c.fr === raw);
}

/** Translate a stored category for display. Anything that matches no preset
 *  is a merchant's own custom category and shows as-is. */
function catLabel(raw: string, t: (d: Dict) => string): string {
  if (!raw) return "";
  const preset = matchPreset(raw);
  return preset ? t(preset) : raw;
}

function weekdayOf(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getDay();
}
function fmtMonthDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
/** Record data without the store-managed id/createdAt, safe to spread back into an update. */
function toData(r: RecordRow): Record<string, any> {
  const { id, createdAt, ...rest } = r;
  return rest;
}

type Status = "pending" | "overdue" | "done";

interface DueItem {
  key: string;
  templateId: string;
  name: string;
  category: string;
  date: string;
  time: string;
  status: Status;
  record?: RecordRow;
}

interface TemplateDraft {
  name: string;
  category: string;
  weekdays: number[];
  time: string;
  active: boolean;
}

const emptyDraft = (): TemplateDraft => ({ name: "", category: "", weekdays: [], time: "09:00", active: true });

export default function FoodSafetyPortal({ slug, mod }: { slug: string; mod: ModuleDef }) {
  const { t, lang } = useLang();
  const bi = (b: { zh: string; en: string }) => (lang === "zh" ? b.zh : b.en);
  const label = (raw: string) => catLabel(raw, t);
  const wdLabel = (d: number) => t(WEEKDAYS.find((w) => w.d === d) ?? WEEKDAYS[0]);

  const [templates, setTemplates] = useState<RecordRow[]>([]);
  const [completions, setCompletions] = useState<RecordRow[]>([]);
  const [catConfigId, setCatConfigId] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [byConfigId, setByConfigId] = useState<string | null>(null);
  const [hiddenBy, setHiddenBy] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /** Preset suggestions + every category the merchant has already typed, minus
   *  any the merchant explicitly removed from the dropdown (hiddenCategories).
   *  Values are always the canonical `zh` key — never the current display
   *  language — so a category picked in EN mode still matches back up when
   *  viewed in ZH (see catLabel). SuggestInput shows the translated label via
   *  `labelFor` but stores this canonical value on pick. */
  const categorySuggestions = useMemo(() => {
    // Normalize legacy values saved under a translated label (e.g. "Temp"
    // from a pre-fix EN-mode save) back to their preset's zh key, so they
    // merge with the same category instead of listing as a separate one.
    const used = templates
      .map((tpl) => (tpl.category || "").trim())
      .filter(Boolean)
      .map((c) => matchPreset(c)?.zh ?? c);
    const all = Array.from(new Set([...CATEGORIES.map((c) => c.zh), ...used]));
    return all.filter((c) => !hiddenCategories.includes(c));
  }, [templates, hiddenCategories]);

  /** Every 记录人 name already used on a past check, minus any explicitly removed. */
  const bySuggestions = useMemo(() => {
    const used = completions.map((r) => (r.by || "").trim()).filter(Boolean);
    return Array.from(new Set(used)).filter((b) => !hiddenBy.includes(b));
  }, [completions, hiddenBy]);

  const load = useCallback(async () => {
    const [tpls, comps, catConfig, byConfig] = await Promise.all([
      listRecords(slug, "food-safety-templates"),
      listRecords(slug, "food-safety"),
      listRecords(slug, "food-safety-category-config"),
      listRecords(slug, "food-safety-by-config"),
    ]);
    setTemplates(tpls);
    setCompletions(comps.map((r) => (r.category == null && r.type != null ? { ...r, category: r.type } : r)));
    const cfg = catConfig[0];
    setCatConfigId(cfg?.id ?? null);
    setHiddenCategories(Array.isArray(cfg?.hidden) ? cfg.hidden : []);
    const byCfg = byConfig[0];
    setByConfigId(byCfg?.id ?? null);
    setHiddenBy(Array.isArray(byCfg?.hidden) ? byCfg.hidden : []);
    setLoading(false);
  }, [slug]);

  /** Remove a suggestion from the category dropdown (doesn't touch templates that already use it). */
  const removeCategorySuggestion = async (cat: string) => {
    const next = Array.from(new Set([...hiddenCategories, cat]));
    const { error } = catConfigId
      ? await updateRecord(catConfigId, { hidden: next })
      : await addRecord(slug, "food-safety-category-config", { hidden: next });
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    await load();
  };

  /** Remove a suggestion from the 记录人 dropdown (doesn't touch past records that already used it). */
  const removeBySuggestion = async (name: string) => {
    const next = Array.from(new Set([...hiddenBy, name]));
    const { error } = byConfigId
      ? await updateRecord(byConfigId, { hidden: next })
      : await addRecord(slug, "food-safety-by-config", { hidden: next });
    if (error) {
      alert("保存失败，请重试：" + error);
      return;
    }
    await load();
  };

  useEffect(() => {
    load();
  }, [load]);

  // ── weekly checklist (Monday–Sunday of the current week) ──────────────
  const monday = useMemo(() => mondayOf(shopToday()), []);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);

  const dueItems: DueItem[] = useMemo(() => {
    const today = shopToday();
    const nowTime = shopHm();
    const list: DueItem[] = [];
    for (const tpl of templates) {
      if (tpl.active === "否") continue;
      const weekdays: number[] = Array.isArray(tpl.weekdays) ? tpl.weekdays : [];
      for (const date of weekDates) {
        if (!weekdays.includes(weekdayOf(date))) continue;
        const match = completions.find((r) => r.templateId === tpl.id && r.date === date);
        let status: Status = "pending";
        if (match) status = "done";
        else if (date < today) status = "overdue";
        else if (date === today && nowTime > (tpl.time || "23:59")) status = "overdue";
        list.push({
          key: `${tpl.id}_${date}`,
          templateId: tpl.id,
          name: tpl.name || "",
          category: tpl.category || "",
          date,
          time: tpl.time || "",
          status,
          record: match,
        });
      }
    }
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [templates, completions, weekDates]);

  const byDay = useMemo(() => {
    const map = new Map<string, DueItem[]>();
    for (const d of weekDates) map.set(d, []);
    for (const it of dueItems) map.get(it.date)?.push(it);
    return map;
  }, [dueItems, weekDates]);

  const overdueCount = dueItems.filter((i) => i.status === "overdue").length;
  const doneCount = dueItems.filter((i) => i.status === "done").length;
  const failCount = useMemo(() => dueItems.filter((i) => i.record?.ok === "否").length, [dueItems]);

  // ── complete / edit a check ────────────────────────────────────────────
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [checkForm, setCheckForm] = useState({ ok: "", value: "", by: "", note: "" });
  const [saving, setSaving] = useState(false);

  const openCheck = (item: DueItem) => {
    if (openKey === item.key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(item.key);
    setCheckForm(
      item.record
        ? { ok: item.record.ok || "", value: item.record.value || "", by: item.record.by || "", note: item.record.note || "" }
        : { ok: "", value: "", by: "", note: "" },
    );
  };

  const saveCheck = async (item: DueItem) => {
    if (!checkForm.ok) {
      alert(t({ zh: "请选择合格 / 不合格", en: "Please select pass or fail", fr: "Veuillez sélectionner conforme ou non conforme" }));
      return;
    }
    setSaving(true);
    const data = {
      templateId: item.templateId,
      date: item.date,
      item: item.name,
      category: item.category,
      ok: checkForm.ok,
      value: checkForm.value.trim(),
      by: checkForm.by.trim(),
      note: checkForm.note.trim(),
    };
    if (item.record) {
      const { error } = await updateRecord(item.record.id, data);
      if (error) {
        setSaving(false);
        alert(t({ zh: "保存失败，请重试：", en: "Save failed, please retry: ", fr: "Échec de l'enregistrement, veuillez réessayer : " }) + error);
        return;
      }
    } else {
      const { error } = await addRecord(slug, "food-safety", data);
      if (error) {
        setSaving(false);
        alert(t({ zh: "保存失败，请重试：", en: "Save failed, please retry: ", fr: "Échec de l'enregistrement, veuillez réessayer : " }) + error);
        return;
      }
    }
    setSaving(false);
    setOpenKey(null);
    await load();
  };

  // ── template CRUD (检查项设置) ──────────────────────────────────────────
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [addingTpl, setAddingTpl] = useState(false);
  const [tplDraft, setTplDraft] = useState<TemplateDraft>(emptyDraft());
  const [savingTpl, setSavingTpl] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const startEditTpl = (tpl: RecordRow) => {
    setAddingTpl(false);
    setEditingTplId(tpl.id);
    setTplDraft({
      name: tpl.name || "",
      category: tpl.category || "",
      weekdays: Array.isArray(tpl.weekdays) ? tpl.weekdays : [],
      time: tpl.time || "09:00",
      active: tpl.active !== "否",
    });
  };

  const startAddTpl = () => {
    setEditingTplId(null);
    setAddingTpl(true);
    setTplDraft(emptyDraft());
  };

  const cancelTplEdit = () => {
    setAddingTpl(false);
    setEditingTplId(null);
  };

  const toggleDraftWeekday = (d: number) => {
    setTplDraft((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(d) ? prev.weekdays.filter((x) => x !== d) : [...prev.weekdays, d],
    }));
  };

  const saveTpl = async () => {
    if (!tplDraft.name.trim() || tplDraft.weekdays.length === 0 || !tplDraft.time) {
      alert(t({ zh: "请填写名称、至少选一个星期几、时间", en: "Please fill in a name, at least one weekday, and a time", fr: "Veuillez remplir le nom, au moins un jour et l'heure" }));
      return;
    }
    setSavingTpl(true);
    const data = {
      name: tplDraft.name.trim(),
      category: tplDraft.category,
      weekdays: tplDraft.weekdays,
      time: tplDraft.time,
      active: tplDraft.active ? "是" : "否",
    };
    const { error } = editingTplId
      ? await updateRecord(editingTplId, data)
      : await addRecord(slug, "food-safety-templates", data);
    setSavingTpl(false);
    if (error) {
      alert(t({ zh: "保存失败，请重试：", en: "Save failed, please retry: ", fr: "Échec de l'enregistrement, veuillez réessayer : " }) + error);
      return;
    }
    setAddingTpl(false);
    setEditingTplId(null);
    await load();
  };

  const toggleActive = async (tpl: RecordRow) => {
    const { error } = await updateRecord(tpl.id, { ...toData(tpl), active: tpl.active === "否" ? "是" : "否" });
    if (error) {
      alert(t({ zh: "保存失败，请重试：", en: "Save failed, please retry: ", fr: "Échec de l'enregistrement, veuillez réessayer : " }) + error);
      return;
    }
    await load();
  };

  const removeTpl = async (id: string) => {
    if (!confirm(t({ zh: "删除这个检查项？历史记录会保留。", en: "Delete this check item? History is kept.", fr: "Supprimer cet élément ? L'historique est conservé." }))) return;
    await deleteRecord(id);
    await load();
  };

  // ── history (compliance log) ──────────────────────────────────────────
  const [histFrom, setHistFrom] = useState("");
  const [histTo, setHistTo] = useState("");
  const histRows = useMemo(
    () =>
      [...completions]
        .filter((r) => (!histFrom || (r.date || "") >= histFrom) && (!histTo || (r.date || "") <= histTo))
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "")),
    [completions, histFrom, histTo],
  );

  const exportCsv = () => {
    const keys = ["date", "category", "item", "ok", "value", "by", "note"];
    const labels = keys.map((k) => mod.fields.find((f) => f.key === k)?.label.zh ?? k);
    const csv = [
      "﻿" + labels.map(escapeCsv).join(","),
      ...histRows.map((r) => keys.map((k) => escapeCsv(String(r[k] ?? ""))).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mod.label.zh}_${shopToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="px-5 py-6 lg:px-7 text-sm text-ink-faint">{t({ zh: "加载中…", en: "Loading…", fr: "Chargement…" })}</main>;
  }

  return (
    <main className="px-5 py-6 lg:px-7">
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">
        ← {t({ zh: "总览", en: "Overview", fr: "Aperçu" })}
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
          {bi(mod.label)}
        </h1>
        <p className="mt-0.5 text-sm text-ink-soft">{bi(mod.pain)}</p>
      </header>

      {/* KPI strip */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t({ zh: "本周应检", en: "Due this week", fr: "À faire cette sem." })} value={dueItems.length} />
        <Kpi label={t({ zh: "已完成", en: "Completed", fr: "Complétés" })} value={doneCount} tone="brand" />
        <Kpi label={t({ zh: "漏检", en: "Overdue", fr: "En retard" })} value={overdueCount} tone={overdueCount > 0 ? "danger" : undefined} />
        <Kpi label={t({ zh: "不合格", en: "Failed", fr: "Non conforme" })} value={failCount} tone={failCount > 0 ? "danger" : undefined} />
      </section>

      {/* overdue reminder banner */}
      {overdueCount > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {t({ zh: `${overdueCount} 项检查已到期未做：`, en: `${overdueCount} check(s) overdue: `, fr: `${overdueCount} vérification(s) en retard : ` })}
          {dueItems
            .filter((i) => i.status === "overdue")
            .map((i) => `${i.name}(${fmtMonthDay(i.date)} ${i.time})`)
            .join(lang === "zh" ? "、" : ", ")}
        </div>
      )}

      {/* weekly checklist */}
      <section className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            {t({ zh: "本周清单", en: "This week's checklist", fr: "Liste de cette semaine" })}
          </h2>
          <span className="text-xs text-ink-faint">
            {fmtMonthDay(weekDates[0])} – {fmtMonthDay(weekDates[6])}
          </span>
        </div>

        {dueItems.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mt-2 text-sm font-semibold text-ink">
              {t({ zh: "还没有检查项", en: "No check items yet", fr: "Aucun élément de vérification" })}
            </div>
            <p className="mx-auto mt-1 max-w-xs text-xs text-ink-soft">
              {t({
                zh: "在下面「检查项设置」里添加，比如冷藏温度、关店清洁——设定好每周哪几天、几点检查，本周该做的会自动列在这里。",
                en: "Add one below in “Check item settings” — e.g. fridge temp, closing clean-up. Pick which weekdays and time, and it shows up here automatically.",
                fr: "Ajoutez-en un ci-dessous dans « Paramètres des vérifications » — les éléments dus s'afficheront ici automatiquement.",
              })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {weekDates.filter((d) => (byDay.get(d)?.length ?? 0) > 0).map((date) => (
              <div key={date} className="px-4 py-3">
                <div className="mb-2 text-xs font-semibold text-ink-faint">
                  {t({ zh: "周", en: "", fr: "" })}{wdLabel(weekdayOf(date))} · {fmtMonthDay(date)}
                  {date === shopToday() && <span className="ml-1.5 rounded-full bg-brand-wash px-1.5 py-0.5 text-brand-ink">{t({ zh: "今天", en: "Today", fr: "Aujourd'hui" })}</span>}
                </div>
                <div className="space-y-1.5">
                  {byDay.get(date)!.map((item) => (
                    <div key={item.key} className="rounded-lg border border-slate-100">
                      <button
                        onClick={() => openCheck(item)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                      >
                        <span className="w-12 shrink-0 text-xs font-medium tabular-nums text-ink-soft">{item.time}</span>
                        <span className="flex-1 text-sm font-medium text-ink">{item.name}</span>
                        {item.category && (
                          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-faint sm:inline">
                            {label(item.category)}
                          </span>
                        )}
                        <StatusBadge status={item.status} t={t} failed={item.record?.ok === "否"} />
                      </button>
                      {openKey === item.key && (
                        <div className="border-t border-slate-100 bg-slate-50/60 p-3">
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            <div>
                              <label className="label">{t({ zh: "结果", en: "Result", fr: "Résultat" })}</label>
                              <div className="flex gap-1.5">
                                {PASS_OPTIONS.map((o) => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setCheckForm((f) => ({ ...f, ok: o.value }))}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                      checkForm.ok === o.value
                                        ? o.value === "是"
                                          ? "border-brand bg-brand-wash text-brand-ink"
                                          : "border-red-300 bg-red-50 text-red-700"
                                        : "border-slate-200 text-ink-soft hover:bg-white"
                                    }`}
                                  >
                                    {t(o)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="label">{t({ zh: "读数/结果说明", en: "Reading / notes", fr: "Lecture / notes" })}</label>
                              <input className="input" value={checkForm.value} onChange={(e) => setCheckForm((f) => ({ ...f, value: e.target.value }))} />
                            </div>
                            <div>
                              <label className="label">{t({ zh: "记录人", en: "Checked by", fr: "Vérifié par" })}</label>
                              <SuggestInput
                                value={checkForm.by}
                                onChange={(v) => setCheckForm((f) => ({ ...f, by: v }))}
                                suggestions={bySuggestions}
                                onRemoveSuggestion={removeBySuggestion}
                                placeholder={t({ zh: "例：张经理", en: "e.g. Manager Zhang", fr: "ex. Gérant Zhang" })}
                                t={t}
                              />
                            </div>
                            <div>
                              <label className="label">{t({ zh: "备注", en: "Note", fr: "Remarque" })}</label>
                              <input className="input" value={checkForm.note} onChange={(e) => setCheckForm((f) => ({ ...f, note: e.target.value }))} />
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button className="btn-primary" disabled={saving} onClick={() => saveCheck(item)}>
                              {saving ? "…" : t({ zh: "保存", en: "Save", fr: "Enregistrer" })}
                            </button>
                            <button className="btn-ghost" onClick={() => setOpenKey(null)}>
                              {t({ zh: "取消", en: "Cancel", fr: "Annuler" })}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* check item settings */}
      <section className="card mb-6 overflow-hidden">
        <button
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <span className="text-sm font-semibold text-ink">{t({ zh: "检查项设置", en: "Check item settings", fr: "Paramètres des vérifications" })}</span>
          <span className={`text-lg leading-none text-ink-faint transition-transform ${settingsOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {settingsOpen && (
          <div className="border-t border-slate-100 p-4">
            {templates.length === 0 && !addingTpl && (
              <p className="mb-3 text-xs text-ink-soft">
                {t({ zh: "从空白开始，按需添加检查项——每个检查项设定名称、类别、每周哪几天、几点检查。", en: "Starts empty — add check items as you need them: a name, category, which weekdays, and a time.", fr: "Commence vide — ajoutez des éléments au besoin : nom, catégorie, jours et heure." })}
              </p>
            )}
            <div className="space-y-2">
              {templates.map((tpl) =>
                editingTplId === tpl.id ? (
                  <TplForm
                    key={tpl.id}
                    draft={tplDraft}
                    setDraft={setTplDraft}
                    toggleWeekday={toggleDraftWeekday}
                    onSave={saveTpl}
                    onCancel={cancelTplEdit}
                    saving={savingTpl}
                    t={t}
                    wdLabel={wdLabel}
                    categorySuggestions={categorySuggestions}
                    onRemoveCategorySuggestion={removeCategorySuggestion}
                  />
                ) : (
                  <div key={tpl.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5">
                    <span className="font-medium text-ink">{tpl.name}</span>
                    {tpl.category && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-faint">{label(tpl.category)}</span>
                    )}
                    <span className="text-xs text-ink-faint">
                      {WEEKDAYS.filter((w) => (tpl.weekdays || []).includes(w.d)).map((w) => wdLabel(w.d)).join(" ")}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-ink-soft">{tpl.time}</span>
                    {tpl.active === "否" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-ink-faint">
                        {t({ zh: "已暂停", en: "Paused", fr: "En pause" })}
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <button onClick={() => toggleActive(tpl)} className="text-ink-faint hover:text-ink">
                        {tpl.active === "否" ? t({ zh: "启用", en: "Enable", fr: "Activer" }) : t({ zh: "暂停", en: "Pause", fr: "Pause" })}
                      </button>
                      <button onClick={() => startEditTpl(tpl)} className="text-brand hover:text-brand-soft">
                        {t({ zh: "编辑", en: "Edit", fr: "Modifier" })}
                      </button>
                      <button onClick={() => removeTpl(tpl.id)} className="text-ink-faint hover:text-red-600">
                        {t({ zh: "删除", en: "Delete", fr: "Supprimer" })}
                      </button>
                    </div>
                  </div>
                ),
              )}
              {addingTpl && (
                <TplForm
                  draft={tplDraft}
                  setDraft={setTplDraft}
                  toggleWeekday={toggleDraftWeekday}
                  onSave={saveTpl}
                  onCancel={cancelTplEdit}
                  saving={savingTpl}
                  t={t}
                  wdLabel={wdLabel}
                  categorySuggestions={categorySuggestions}
                  onRemoveCategorySuggestion={removeCategorySuggestion}
                />
              )}
            </div>
            {!addingTpl && (
              <button className="btn-ghost mt-3 border border-slate-300" onClick={startAddTpl}>
                + {t({ zh: "新增检查项", en: "Add check item", fr: "Ajouter un élément" })}
              </button>
            )}
          </div>
        )}
      </section>

      {/* history / compliance log */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{t({ zh: "历史记录", en: "History", fr: "Historique" })}</h2>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <input type="date" className="rounded border border-slate-200 px-2 py-1 outline-none focus:border-brand" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
            <span className="text-ink-faint">—</span>
            <input type="date" className="rounded border border-slate-200 px-2 py-1 outline-none focus:border-brand" value={histTo} onChange={(e) => setHistTo(e.target.value)} />
            <button className="btn-ghost border border-slate-300 !py-1 !text-xs" onClick={exportCsv} disabled={histRows.length === 0}>
              {t({ zh: "导出 CSV", en: "Export CSV", fr: "Exporter CSV" })}
            </button>
          </div>
        </div>
        {histRows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-ink-faint">
            {t({ zh: "还没有历史记录", en: "No history yet", fr: "Aucun historique" })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "日期", en: "Date", fr: "Date" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "类别", en: "Category", fr: "Catégorie" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "检查项", en: "Item", fr: "Élément" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "结果", en: "Result", fr: "Résultat" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "读数", en: "Reading", fr: "Lecture" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "记录人", en: "By", fr: "Par" })}</th>
                  <th className="px-4 py-2.5 font-medium">{t({ zh: "备注", en: "Note", fr: "Remarque" })}</th>
                </tr>
              </thead>
              <tbody>
                {histRows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-ink-soft">{r.date}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.category ? label(r.category) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-ink">{r.item}</td>
                    <td className="px-4 py-2.5">
                      <span className={r.ok === "否" ? "font-medium text-red-600" : "text-ink-soft"}>
                        {r.ok === "否" ? t({ zh: "不合格", en: "Fail", fr: "Non conforme" }) : t({ zh: "合格", en: "Pass", fr: "Conforme" })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.value || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.by || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{r.note || <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "brand" | "danger" }) {
  const cls = tone === "danger" ? "text-red-600" : tone === "brand" ? "text-brand-ink" : "text-ink";
  return (
    <div className="card p-4">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, failed, t }: { status: Status; failed?: boolean; t: (d: Dict) => string }) {
  if (status === "done") {
    return (
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${failed ? "bg-red-50 text-red-700" : "bg-brand-wash text-brand-ink"}`}>
        {failed ? `✕ ${t({ zh: "不合格", en: "Fail", fr: "Non conforme" })}` : `✓ ${t({ zh: "已完成", en: "Done", fr: "Fait" })}`}
      </span>
    );
  }
  if (status === "overdue") {
    return <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t({ zh: "漏检", en: "Overdue", fr: "En retard" })}</span>;
  }
  return <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-faint">{t({ zh: "待检", en: "Pending", fr: "À faire" })}</span>;
}

function TplForm({
  draft,
  setDraft,
  toggleWeekday,
  onSave,
  onCancel,
  saving,
  t,
  wdLabel,
  categorySuggestions,
  onRemoveCategorySuggestion,
}: {
  draft: TemplateDraft;
  setDraft: React.Dispatch<React.SetStateAction<TemplateDraft>>;
  toggleWeekday: (d: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  t: (d: Dict) => string;
  wdLabel: (d: number) => string;
  categorySuggestions: string[];
  onRemoveCategorySuggestion: (cat: string) => void;
}) {
  return (
    <div className="rounded-lg border border-brand/30 bg-brand-wash/30 p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <label className="label">{t({ zh: "名称", en: "Name", fr: "Nom" })}</label>
          <input
            className="input"
            placeholder={t({ zh: "例：冷藏温度", en: "e.g. Fridge temp", fr: "ex. Température frigo" })}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">{t({ zh: "类别（可选，输入后自动记住）", en: "Category (optional, remembers what you type)", fr: "Catégorie (facultatif, mémorisée)" })}</label>
          <SuggestInput
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            suggestions={categorySuggestions}
            labelFor={(v) => catLabel(v, t)}
            onRemoveSuggestion={onRemoveCategorySuggestion}
            placeholder={t({ zh: "例：温度", en: "e.g. Temp", fr: "ex. Température" })}
            t={t}
          />
        </div>
        <div>
          <label className="label">{t({ zh: "每周哪几天", en: "Which weekdays", fr: "Quels jours" })}</label>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => (
              <button
                key={w.d}
                type="button"
                onClick={() => toggleWeekday(w.d)}
                className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${
                  draft.weekdays.includes(w.d) ? "border-brand bg-brand-wash text-brand-ink" : "border-slate-200 text-ink-soft hover:bg-white"
                }`}
              >
                {wdLabel(w.d)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">{t({ zh: "时间", en: "Time", fr: "Heure" })}</label>
          <input type="time" className="input" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))} />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
        {t({ zh: "启用", en: "Active", fr: "Actif" })}
      </label>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={saving} onClick={onSave}>
          {saving ? "…" : t({ zh: "保存", en: "Save", fr: "Enregistrer" })}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          {t({ zh: "取消", en: "Cancel", fr: "Annuler" })}
        </button>
      </div>
    </div>
  );
}
