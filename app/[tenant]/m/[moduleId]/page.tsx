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
import { rankDishes, topRevenue } from "@/lib/dishSales";
import { useLang, type Dict } from "@/app/i18n";
import MenuGeneratorPortal from "@/components/MenuGeneratorPortal";
import QrMenuPortal from "@/components/QrMenuPortal";
import OrdersPortal from "@/components/OrdersPortal";
import SalesPortal from "@/components/SalesPortal";
import SalesStatsPortal from "@/components/SalesStatsPortal";
import FoodSafetyPortal from "@/components/FoodSafetyPortal";
import SuggestInput from "@/components/SuggestInput";

/** Trilingual UI chrome (EN default, + 中 / FR). Data (dish/staff/supplier names,
 *  merchant-entered content) is never translated — only labels, buttons, headings,
 *  hints, dialogs and fixed table chrome. */
const T: Record<string, Dict> = {
  // generic actions
  save: { en: "Save", zh: "保存", fr: "Enregistrer" },
  cancel: { en: "Cancel", zh: "取消", fr: "Annuler" },
  edit: { en: "Edit", zh: "修改", fr: "Modifier" },
  del: { en: "Delete", zh: "删除", fr: "Supprimer" },
  confirmDelete: { en: "Delete this record?", zh: "删除这条记录？", fr: "Supprimer cet enregistrement ?" },
  // not-found / access
  unknownModule: { en: "Unknown module.", zh: "未知模块。", fr: "Module inconnu." },
  backOverview: { en: "← Back to overview", zh: "← 返回总览", fr: "← Retour à l'aperçu" },
  overview: { en: "← Overview", zh: "← 总览", fr: "← Aperçu" },
  noAccess: { en: "You don't have access to this module. Please contact the owner.", zh: "你没有这个模块的访问权限，请联系店主。", fr: "Vous n'avez pas accès à ce module. Veuillez contacter le propriétaire." },
  // header / toolbar
  collapse: { en: "Collapse", zh: "收起", fr: "Réduire" },
  addRecord: { en: "+ Add record", zh: "+ 新增记录", fr: "+ Ajouter" },
  exportCsv: { en: "Export CSV", zh: "导出 CSV", fr: "Exporter CSV" },
  importing: { en: "Importing…", zh: "导入中…", fr: "Importation…" },
  importCsv: { en: "Import CSV", zh: "导入 CSV", fr: "Importer CSV" },
  importFailed: { en: "Import failed: ", zh: "导入失败：", fr: "Échec de l'importation : " },
  importOk: { en: "Imported {n} records", zh: "成功导入 {n} 条记录", fr: "{n} enregistrements importés" },
  // enable notice
  notEnabledPre: { en: "This module is not enabled. Open ", zh: "该模块未启用。到 ", fr: "Ce module n'est pas activé. Allez dans " },
  settings: { en: "Settings", zh: "设置", fr: "Paramètres" },
  notEnabledPost: { en: " to turn it on before entering data.", zh: " 中开启后即可录入。", fr: " pour l'activer avant de saisir des données." },
  // stats
  statsLabel: { en: "Statistics", zh: "数据统计", fr: "Statistiques" },
  all: { en: "All", zh: "全部", fr: "Tout" },
  lastNDays: { en: "Last {n} days", zh: "近{n}天", fr: "{n} derniers jours" },
  custom: { en: "Custom", zh: "自定义", fr: "Personnalisé" },
  recordCount: { en: "Records", zh: "记录数", fr: "Enregistrements" },
  thisPeriod: { en: "This period", zh: "该时段", fr: "Cette période" },
  cumulative: { en: "Total", zh: "累计", fr: "Total" },
  lastNDaysShort: { en: "Last {n} days", zh: "近{n}天", fr: "{n} derniers jours" },
  totalLabel: { en: "Total", zh: "合计", fr: "Total" },
  cumulativeScrapValue: { en: "Cumulative scrap value", zh: "累计报废价值", fr: "Valeur de rebut cumulée" },
  avgSuffix: { en: "{label} (avg)", zh: "{label}（均值）", fr: "{label} (moy.)" },
  sumAvgSuffix: { en: "{label} (total / avg)", zh: "{label}（合计 / 均值）", fr: "{label} (total / moy.)" },
  avgPrefix: { en: "Avg: ", zh: "均值: ", fr: "Moy. : " },
  // trend
  value: { en: "Value", zh: "数值", fr: "Valeur" },
  trendTitle: { en: "{label} trend (last 14 days)", zh: "{label} 趋势（近14天）", fr: "Tendance {label} (14 derniers jours)" },
  // entry form
  newRecord: { en: "New record", zh: "新增记录", fr: "Nouvel enregistrement" },
  computing: { en: "Computing…", zh: "汇算中…", fr: "Calcul…" },
  shift: { en: "Shift", zh: "班次", fr: "Quart" },
  done: { en: "Done", zh: "完成", fr: "Terminé" },
  editDefaultShifts: { en: "Edit default shifts", zh: "修改默认班次", fr: "Modifier les quarts par défaut" },
  saveDefaultShifts: { en: "Save default shifts", zh: "保存默认班次", fr: "Enregistrer les quarts par défaut" },
  autoComputed: { en: " (auto-computed)", zh: " (自动计算)", fr: " (calcul auto)" },
  fillRequired: { en: "Please fill in: ", zh: "请填写：", fr: "Veuillez remplir : " },
  // date range / filter bar
  prevWeek: { en: "‹ Prev week", zh: "‹ 上一周", fr: "‹ Sem. préc." },
  nextWeek: { en: "Next week ›", zh: "下一周 ›", fr: "Sem. suiv. ›" },
  thisWeek: { en: "This week", zh: "本周", fr: "Cette semaine" },
  selectedCount: { en: "{a} / {b} selected", zh: "已选 {a} / {b} 条", fr: "{a} / {b} sélectionnés" },
  copying: { en: "Copying…", zh: "复制中…", fr: "Copie…" },
  copyNToNextWeek: { en: "Copy {n} to next week →", zh: "复制 {n} 条到下一周 →", fr: "Copier {n} vers la semaine suivante →" },
  copyToNextWeek: { en: "Copy to next week →", zh: "复制到下一周 →", fr: "Copier vers la semaine suivante →" },
  date: { en: "Date", zh: "日期", fr: "Date" },
  filteredCount: { en: "Filtered: {a} / {b}", zh: "筛选中：{a} / {b} 条", fr: "Filtré : {a} / {b}" },
  clearFilter: { en: "Clear filter", zh: "清除筛选", fr: "Effacer le filtre" },
  clearAllFilters: { en: "Clear all filters", zh: "清除全部筛选", fr: "Tout effacer" },
  // table
  swipeHint: { en: "← Swipe to see more columns →", zh: "← 左右滑动查看更多列 →", fr: "← Glissez pour voir plus de colonnes →" },
  selectAll: { en: "Select all", zh: "全选", fr: "Tout sélectionner" },
  searchPlaceholder: { en: "Search...", zh: "搜索...", fr: "Rechercher..." },
  confirm: { en: "OK", zh: "确定", fr: "OK" },
  emptyEnabled: { en: "No records yet. Click \"+ Add record\" to start.", zh: "还没有记录，点「+ 新增记录」开始录入。", fr: "Aucun enregistrement. Cliquez sur « + Ajouter » pour commencer." },
  emptyDisabled: { en: "No records yet.", zh: "还没有记录。", fr: "Aucun enregistrement." },
  emptyFiltered: { en: "No matching records. Try adjusting the filters.", zh: "没有匹配的记录，试试调整筛选条件。", fr: "Aucun enregistrement correspondant. Ajustez les filtres." },
  expand: { en: "Expand", zh: "展开", fr: "Développer" },
  collapseRow: { en: "Collapse", zh: "收起", fr: "Réduire" },
  // pagination
  pageRange: { en: "{from}–{to} of {total}", zh: "第 {from}–{to} 条，共 {total} 条", fr: "{from}–{to} sur {total}" },
  prevPage: { en: "‹ Prev", zh: "‹ 上一页", fr: "‹ Préc." },
  nextPage: { en: "Next ›", zh: "下一页 ›", fr: "Suiv. ›" },
  // attendance anomalies
  anomalyTitle: { en: "Attendance exceptions this week", zh: "本周异常出勤", fr: "Exceptions de présence cette semaine" },
  timesSuffix: { en: "{k} {v} times", zh: "{k} {v} 次", fr: "{k} {v} fois" },
  anomalyEmpty: { en: "Attendance is normal this week, no exceptions.", zh: "本周出勤正常，暂无异常记录。", fr: "Présence normale cette semaine, aucune exception." },
  // equipment monthly checklist
  monthlyChecklist: { en: "Monthly maintenance checklist", zh: "本月保养清单", fr: "Liste d'entretien du mois" },
  itemsPending: { en: "{n} pending", zh: "{n} 项待处理", fr: "{n} en attente" },
  checklistHint: { en: "Equipment whose next service date falls this month (including overdue), regardless of pass/complete status", zh: "下次保养日期落在本月（含已逾期）的设备，与「是否合格/已完成」无关", fr: "Équipement dont la prochaine date d'entretien tombe ce mois-ci (y compris en retard), indépendamment du statut" },
  equipmentFallback: { en: "Equipment", zh: "设备", fr: "Équipement" },
  overduePrefix: { en: "Overdue · {d}", zh: "已逾期 · {d}", fr: "En retard · {d}" },
  markServiced: { en: "Serviced this cycle", zh: "本次已保养", fr: "Entretenu ce cycle" },
  operationFailed: { en: "Operation failed, please retry: ", zh: "操作失败，请重试：", fr: "Échec de l'opération, réessayez : " },
  // tier settings
  tierRules: { en: "Member tier rules", zh: "会员等级规则", fr: "Règles de niveaux de membre" },
  tierHint: { en: "Set the cumulative spend that auto-upgrades a member; takes effect immediately on save", zh: "设定累计消费满多少自动升级，保存后立即生效", fr: "Définissez la dépense cumulée qui met à niveau automatiquement un membre ; effet immédiat à l'enregistrement" },
  tierNamePlaceholder: { en: "Tier name", zh: "等级名称", fr: "Nom du niveau" },
  tierAtLeast: { en: "at", zh: "满", fr: "à partir de" },
  tierUnit: { en: "", zh: "元", fr: "$" },
  addTier: { en: "+ Add tier", zh: "+ 新增等级", fr: "+ Ajouter un niveau" },
  saving: { en: "Saving…", zh: "保存中…", fr: "Enregistrement…" },
  saveAndApply: { en: "Save & apply", zh: "保存并应用", fr: "Enregistrer et appliquer" },
  savedTiersUpdated: { en: "Saved, {n} members' tiers updated", zh: "已保存，{n} 位会员等级已更新", fr: "Enregistré, niveaux de {n} membres mis à jour" },
  saved: { en: "Saved", zh: "已保存", fr: "Enregistré" },
  // dish sales ranking (design review 2026-07-20 — variant C: ranked table, no
  // emoji, no colour-wash boxes, zero-sellers visible rather than filtered out).
  // Column headers come from the module's own field labels, not from here, so
  // there is one source of truth for 菜名/售价/月销量/销售额.
  salesRanking: { en: "Sales ranking", zh: "销量排行", fr: "Classement des ventes" },
  rank: { en: "Rank", zh: "排名", fr: "Rang" },
  notSold: { en: "Not sold", zh: "未售出", fr: "Non vendu" },
  emptyRankTitle: { en: "No sales data yet", zh: "还没有销量数据", fr: "Aucune donnée de vente" },
  emptyRankHint: {
    en: "Dishes sync here from your menu. Enter a monthly quantity and the ranking appears.",
    zh: "菜单里的菜品会自动同步到这里，录入月销量后就能看到排行。",
    fr: "Les plats se synchronisent depuis votre menu. Saisissez une quantité mensuelle pour voir le classement.",
  },
  // supplier compare
  supplierCompare: { en: "Supplier price comparison", zh: "供应商比价", fr: "Comparaison des fournisseurs" },
  supplierCompareHint: { en: "Average unit price per supplier for the same item; green is the lowest", zh: "同一品项各供应商的平均单价，绿色为最低价", fr: "Prix unitaire moyen par fournisseur pour le même article ; le vert est le plus bas" },
  savesPerUnit: { en: "Lowest saves {amt}/unit vs highest", zh: "最低比最高省 {amt}/单位", fr: "Le plus bas économise {amt}/unité vs le plus élevé" },
  // review topics
  topicStats: { en: "Issue category breakdown", zh: "问题类别统计", fr: "Répartition par catégorie" },
  countSuffix: { en: "{n}", zh: "{n} 条", fr: "{n}" },
  // alerts (dashboard banners)
  alertZeroStock: { en: "⚠️ Out of stock: {items}", zh: "⚠️ 零库存：{items}", fr: "⚠️ Rupture de stock : {items}" },
  alertLowStock: { en: "📉 Low stock (≤5): {items}", zh: "📉 低库存（≤5）：{items}", fr: "📉 Stock faible (≤5) : {items}" },
  alertHighScrap: { en: "🗑️ High scrap rate (≥10%): {items}", zh: "🗑️ 报废率偏高（≥10%）：{items}", fr: "🗑️ Taux de rebut élevé (≥10 %) : {items}" },
  alertUpcomingBookings: { en: "📅 {n} bookings in the next 3 days: {list}", zh: "📅 近3天有 {n} 个预订：{list}", fr: "📅 {n} réservations dans les 3 prochains jours : {list}" },
  alertGuestsSuffix: { en: "{name}({n} guests)", zh: "{name}({n}人)", fr: "{name}({n} pers.)" },
  alertOpenIssues: { en: "🔧 {n} equipment issues pending: {list}", zh: "🔧 {n} 个设备问题待处理：{list}", fr: "🔧 {n} problèmes d'équipement en attente : {list}" },
  alertServiceDue: { en: "🛠️ {n} equipment due for service{overdue}: {list}", zh: "🛠️ {n} 台设备保养到期{overdue}：{list}", fr: "🛠️ {n} équipements à entretenir{overdue} : {list}" },
  alertServiceOverdue: { en: " ({n} overdue)", zh: "（{n} 台已过期）", fr: " ({n} en retard)" },
  alertUnrepliedReviews: { en: "💬 {n} low-rating reviews unanswered", zh: "💬 {n} 条低分评价未回复", fr: "💬 {n} avis à faible note sans réponse" },
  alertPendingPosts: { en: "📣 {n} posts pending publication", zh: "📣 {n} 条内容待发布", fr: "📣 {n} publications en attente" },
  alertBirthdays: { en: "🎂 {n} member birthdays in the next 7 days: {list}", zh: "🎂 近7天 {n} 位会员生日：{list}", fr: "🎂 {n} anniversaires de membres dans les 7 prochains jours : {list}" },
  alertSoldOut: { en: "🔥 Sold out {n} times: {items} (possibly under-prepped)", zh: "🔥 卖断 {n} 次：{items}（可能少备了）", fr: "🔥 Rupture {n} fois : {items} (peut-être pas assez préparé)" },
  alertWaste: { en: "♻️ {n} leftover/scrapped in total", zh: "♻️ 累计剩余/报废 {n} 份", fr: "♻️ {n} restes/rebuts au total" },
  alertPrepSuggest: { en: "📋 Tomorrow's prep suggestion (last 7d avg ×1.1): {list}", zh: "📋 明日备货建议（近7天均销×1.1）：{list}", fr: "📋 Suggestion de préparation pour demain (moy. 7j ×1,1) : {list}" },
  alertPrepPortions: { en: "{dish} {n}", zh: "{dish} {n}份", fr: "{dish} {n}" },
  // equipment suggest-input placeholders
  phEquipment: { en: "e.g. Fridge", zh: "例：冰箱", fr: "ex : Réfrigérateur" },
  phVendor: { en: "e.g. XX Repair Co.", zh: "例：XX 维修公司", fr: "ex : Société de réparation XX" },
  phIssue: { en: "e.g. Compressor noise", zh: "例：压缩机异响", fr: "ex : Bruit du compresseur" },
};

/** Custom portals keyed by module id (modules with `portal: true`). */
const PORTALS: Record<string, (p: { slug: string; mod: ModuleDef }) => ReactElement> = {
  "menu-generator": MenuGeneratorPortal,
  "qr-menu": QrMenuPortal,
  "online-orders": OrdersPortal,
  "sales": SalesPortal,
  "sales-stats": SalesStatsPortal,
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week containing dateStr. */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Short "month day" from a YYYY-MM-DD string, localized: zh 5月26日 · en May 26 · fr 26 mai. */
function fmtMonthDay(dateStr: string, lang: "zh" | "en" | "fr" = "en"): string {
  const d = new Date(dateStr + "T00:00:00");
  if (lang === "zh") return `${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
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
  lang: "zh" | "en" | "fr" = "en",
): Promise<{ count: number; error?: string }> {
  const text = await file.text();
  const clean = text.replace(/^﻿/, "");
  const parsed = parseCsv(clean);
  if (parsed.length < 2) return { count: 0, error: lang === "zh" ? "CSV 文件为空或只有表头" : lang === "fr" ? "Le fichier CSV est vide ou ne contient qu'un en-tête" : "The CSV file is empty or has only a header row" };

  const headerRow = parsed[0].map((h) => h.trim());
  const fieldMap: (Field | null)[] = headerRow.map((h) => {
    return mod.fields.find((f) => f.label.zh === h || f.label.en === h || f.key === h) ?? null;
  });

  if (fieldMap.every((f) => f === null)) {
    return { count: 0, error: lang === "zh" ? "表头无法匹配任何字段，请确认 CSV 列名与模块字段一致" : lang === "fr" ? "Aucune colonne ne correspond à un champ — vérifiez que les noms de colonnes correspondent aux champs du module" : "No column headers matched any field — check that the CSV column names match the module fields" };
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

/** The YYYY-MM-DD a record belongs to: its `date` field, else when it was created.
 *  (Never `time` — that's HH:MM and breaks date comparisons, e.g. phone orders.) */
function rowDate(r: RecordRow): string {
  return r.date || (r.createdAt ? String(r.createdAt).slice(0, 10) : "");
}

/** Local (device/shop TZ) YYYY-MM-DD. Avoids the UTC off-by-one that
 *  toISOString() causes in negative-offset zones like Toronto near midnight. */
function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function filterByDateRange(rows: RecordRow[], days: number): RecordRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localYmd(cutoff);
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
  const { lang } = useLang();
  if (field.type === "select") {
    return (
      <select className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.options?.map((o) => <option key={o.zh} value={o.zh}>{biLabel(o, lang)}</option>)}
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
  const { t, lang } = useLang();
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
    if (compactDates && f.type === "date" && value) return fmtMonthDay(String(value), lang);
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
              <button onClick={saveEdit} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.save)}</button>
              <button onClick={cancelEdit} className="text-xs text-ink-faint hover:text-ink">{t(T.cancel)}</button>
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
              <button onClick={() => startEdit(r)} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.edit)}</button>
              <button
                onClick={async () => { if (confirm(t(T.confirmDelete))) await doDelete(r.id); }}
                className="text-xs text-ink-faint hover:text-red-600"
              >
                {t(T.del)}
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

// Catalog labels are {zh,en} (no fr) — resolve by lang, falling back to en so
// the UI never shows Chinese in EN/FR mode. Stored option VALUES stay in zh.
function biLabel(d: { zh: string; en: string; fr?: string }, lang: string): string {
  return (d as Record<string, string>)[lang] ?? d.en;
}

export default function ModulePage() {
  const { t, lang } = useLang();
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
  const [autoFilling, setAutoFilling] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [colFilters, setColFilters] = useState<Record<string, Set<string>>>({});
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [weekAnchor, setWeekAnchor] = useState(() => new Date().toISOString().slice(0, 10));
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
    if (presetConfigId) {
      await updateRecord(presetConfigId, presetForm);
    } else {
      await addRecord(slug, "scheduling_presets", presetForm);
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
    try {
      await Promise.all(
        toCopy.map((r) => {
          const data: Record<string, string> = {};
          for (const f of mod.fields) {
            data[f.key] = r[f.key] != null ? String(r[f.key]) : "";
          }
          if (data.date) data.date = addDays(data.date, 7);
          return addRecord(slug, "scheduling", data);
        }),
      );
    } finally {
      setCopyingWeek(false);
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
    if (equipmentOptionConfig?.id) {
      await updateRecord(equipmentOptionConfig.id, { hidden: next });
    } else {
      await addRecord(slug, "equipment-options-config", { hidden: next });
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
    if (vendorConfig?.id) {
      await updateRecord(vendorConfig.id, { hidden: next });
    } else {
      await addRecord(slug, "equipment-vendor-config", { hidden: next });
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
    if (issueConfig?.id) {
      await updateRecord(issueConfig.id, { hidden: next });
    } else {
      await addRecord(slug, "equipment-issue-config", { hidden: next });
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
      const r2 = (n: number) => Math.round(n * 100) / 100;
      // group rows by item
      const byItem: Record<string, RecordRow[]> = {};
      for (const r of rawRows) {
        const item = r.item || "";
        if (item) (byItem[item] ??= []).push(r);
      }
      // FIFO value per row + onHand per item
      const valueMap = new Map<string, { scrapValue: number; lossValue: number }>();
      const itemOnHand: Record<string, number> = {};
      for (const [item, itemRows] of Object.entries(byItem)) {
        const sorted = [...itemRows].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        // build batch queue from "in" rows
        const batches: { qty: number; cost: number }[] = [];
        for (const r of sorted) {
          const inQty = parseFloat(r.inQty) || 0;
          if (inQty > 0) batches.push({ qty: inQty, cost: parseFloat(r.unitCost) || 0 });
        }
        // deduct scrap+loss in date order, assign FIFO cost per row
        let bi = 0;
        for (const r of sorted) {
          const scrap = parseFloat(r.scrapQty) || 0;
          const loss = parseFloat(r.lossQty) || 0;
          let scrapVal = 0;
          let lossVal = 0;
          let toDeduct = scrap;
          while (toDeduct > 0 && bi < batches.length) {
            const take = Math.min(toDeduct, batches[bi].qty);
            scrapVal += take * batches[bi].cost;
            batches[bi].qty -= take;
            toDeduct -= take;
            if (batches[bi].qty <= 0) bi++;
          }
          toDeduct = loss;
          while (toDeduct > 0 && bi < batches.length) {
            const take = Math.min(toDeduct, batches[bi].qty);
            lossVal += take * batches[bi].cost;
            batches[bi].qty -= take;
            toDeduct -= take;
            if (batches[bi].qty <= 0) bi++;
          }
          valueMap.set(r.id, { scrapValue: r2(scrapVal), lossValue: r2(lossVal) });
        }
        const remainQty = batches.slice(bi).reduce((s, b) => s + b.qty, 0);
        itemOnHand[item] = r2(remainQty);
      }
      return rawRows.map((r) => {
        const v = valueMap.get(r.id) ?? { scrapValue: 0, lossValue: 0 };
        const onHand = itemOnHand[r.item || ""] ?? 0;
        return {
          ...r,
          scrapValue: String(v.scrapValue),
          lossValue: String(v.lossValue),
          onHand: String(onHand),
        };
      });
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
  // 菜品销量 renders ONE table: the ranked one in ModuleInsights, which carries
  // the same edit/delete actions the generic table would. Showing both listed
  // every dish twice — ranked, then again unranked — with nothing saying why
  // (design review 2026-07-20 D4).
  const rankedTableReplacesGeneric = moduleId === "dish-margin";
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
          <button onClick={saveEdit} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.save)}</button>
          <button onClick={cancelEdit} className="text-xs text-ink-faint hover:text-ink">{t(T.cancel)}</button>
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
          <button onClick={() => startEdit(r)} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.edit)}</button>
          <button
            onClick={async () => {
              if (confirm(t(T.confirmDelete))) {
                await deleteRecord(r.id);
                setTick((tk) => tk + 1);
              }
            }}
            className="text-xs text-ink-faint hover:text-red-600"
          >
            {t(T.del)}
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
      if (zero.length) list.push({ type: "warn", text: t(T.alertZeroStock).replace("{items}", zero.map(([k]) => k).join("、")) });
      if (low.length) list.push({ type: "warn", text: t(T.alertLowStock).replace("{items}", low.map(([k, v]) => `${k}(${v})`).join("、")) });
      const highScrap = Object.entries(flow)
        .filter(([, f]) => f.in > 0 && f.scrap / f.in >= 0.1)
        .map(([k, f]) => `${k}(${Math.round((f.scrap / f.in) * 100)}%)`);
      if (highScrap.length) list.push({ type: "warn", text: t(T.alertHighScrap).replace("{items}", highScrap.join("、")) });
    }
    if (moduleId === "group-booking") {
      const today = localYmd(new Date());
      const upcoming = rows.filter((r) => r.date && r.date >= today && r.date <= addDays(today, 3));
      if (upcoming.length) list.push({ type: "info", text: t(T.alertUpcomingBookings).replace("{n}", String(upcoming.length)).replace("{list}", upcoming.map((r) => `${r.date} ` + t(T.alertGuestsSuffix).replace("{name}", r.customer || "").replace("{n}", String(r.guests || "?"))).join("、")) });
    }
    if (moduleId === "equipment") {
      const open = rows.filter((r) => r.status === "待处理" || r.status === "处理中");
      if (open.length) list.push({ type: "warn", text: t(T.alertOpenIssues).replace("{n}", String(open.length)).replace("{list}", open.map((r) => `${r.equipment || ""}${r.issue ? "-" + r.issue : ""}`).join("、")) });
      // 保养到期提醒：下次保养日期已过期或在近7天内
      const today = localYmd(new Date());
      const soon = addDays(today, 7);
      const due = rows.filter((r) => r.nextService && r.nextService <= soon);
      if (due.length) {
        const overdue = due.filter((r) => r.nextService < today);
        list.push({
          type: "warn",
          text: t(T.alertServiceDue)
            .replace("{n}", String(due.length))
            .replace("{overdue}", overdue.length ? t(T.alertServiceOverdue).replace("{n}", String(overdue.length)) : "")
            .replace("{list}", due.map((r) => `${r.equipment || t(T.equipmentFallback)}(${r.nextService})`).join("、")),
        });
      }
    }
    if (moduleId === "reviews") {
      const unreplied = rows.filter((r) => r.replied !== "是" && parseFloat(r.rating) <= 3);
      if (unreplied.length) list.push({ type: "warn", text: t(T.alertUnrepliedReviews).replace("{n}", String(unreplied.length)) });
    }
    if (moduleId === "social") {
      const drafts = rows.filter((r) => r.status === "草稿" || r.status === "待发");
      if (drafts.length) list.push({ type: "info", text: t(T.alertPendingPosts).replace("{n}", String(drafts.length)) });
    }
    if (moduleId === "members") {
      // 近7天（含今天）生日的会员，按 月-日 比对（忽略年份）
      const upcoming = new Set<string>();
      const base = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        upcoming.add(`${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
      const bday = rows.filter((r) => r.birthday && upcoming.has(String(r.birthday).slice(5)));
      if (bday.length) {
        list.push({
          type: "info",
          text: t(T.alertBirthdays).replace("{n}", String(bday.length)).replace("{list}", bday.map((r) => `${r.name || r.phone || "?"}(${String(r.birthday).slice(5)})`).join("、")),
        });
      }
    }
    if (moduleId === "prep-signature") {
      // 卖断提醒：实际售出 ≥ 备货份数（且有备货）
      const soldOut = rows.filter((r) => (parseFloat(r.prepped) || 0) > 0 && (parseFloat(r.sold) || 0) >= (parseFloat(r.prepped) || 0));
      if (soldOut.length) {
        list.push({
          type: "warn",
          text: t(T.alertSoldOut).replace("{n}", String(soldOut.length)).replace("{items}", Array.from(new Set(soldOut.map((r) => r.dish).filter(Boolean))).join("、")),
        });
      }
      // 浪费提醒：剩余/报废合计
      const waste = rows.reduce((a, r) => a + (parseFloat(r.leftover) || 0), 0);
      if (waste > 0) list.push({ type: "info", text: t(T.alertWaste).replace("{n}", String(Math.round(waste))) });

      // 明日备货建议 = round(近7天该菜日均售出 × 1.1)，多备10%防卖断
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffStr = localYmd(cutoff);
      const byDish: Record<string, { sold: number; days: Set<string> }> = {};
      for (const r of rows) {
        if (!r.dish || !r.date || r.date < cutoffStr) continue;
        const g = (byDish[r.dish] ??= { sold: 0, days: new Set() });
        g.sold += parseFloat(r.sold) || 0;
        g.days.add(r.date);
      }
      const suggest = Object.entries(byDish)
        .filter(([, g]) => g.days.size > 0)
        .map(([dish, g]) => t(T.alertPrepPortions).replace("{dish}", dish).replace("{n}", String(Math.round((g.sold / g.days.size) * 1.1))));
      if (suggest.length) list.push({ type: "info", text: t(T.alertPrepSuggest).replace("{list}", suggest.join("、")) });
    }
    return list;
  }, [rows, moduleId, t]);

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
          equipment: { suggestions: equipmentSuggestions, remove: removeEquipmentSuggestion, placeholder: t(T.phEquipment) },
          vendor: { suggestions: vendorSuggestions, remove: removeVendorSuggestion, placeholder: t(T.phVendor) },
          issue: { suggestions: issueSuggestions, remove: removeIssueSuggestion, placeholder: t(T.phIssue) },
        }
      : {};

  useEffect(() => {
    if (!open || moduleId !== "daily-close") return;
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const date = form.date || localDate;
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
        const next = { ...prev, [key]: value };
        return applyComputed(next, mod?.computed);
      });
    },
    [mod]
  );

  if (!mod) {
    return (
      <main className="px-6 py-8">
        <p className="text-ink-soft">{t(T.unknownModule)}</p>
        <Link href={`/${slug}`} className="text-brand">{t(T.backOverview)}</Link>
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
          <p className="mt-2 text-sm text-ink-soft">{t(T.noAccess)}</p>
          <Link href={`/${slug}`} className="btn-primary mt-4 inline-block">{t(T.backOverview)}</Link>
        </div>
      </main>
    );
  }

  if (mod.portal && PORTALS[moduleId]) {
    const Portal = PORTALS[moduleId];
    return <Portal slug={slug} mod={mod} />;
  }

  const enabled = tenant.enabled.includes(moduleId);

  const submit = async () => {
    const missing = mod.fields.filter((f) => f.required && !form[f.key]?.trim());
    if (missing.length) {
      alert(t(T.fillRequired) + missing.map((f) => biLabel(f.label, lang)).join(lang === "zh" ? "、" : ", "));
      return;
    }
    await addRecord(slug, moduleId, form);
    if (moduleId === "purchasing") {
      await syncPurchasingToStock(slug);
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
    await updateRecord(editingId, applyComputed(editForm, mod?.computed));
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
      <Link href={`/${slug}`} className="text-sm text-ink-faint hover:text-ink">{t(T.overview)}</Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {mod.icon} {biLabel(mod.label, lang)}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">{biLabel(mod.pain, lang)}</p>
        </div>
        {enabled && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => setOpen((o) => !o)}>
              {open ? t(T.collapse) : t(T.addRecord)}
            </button>
            <button
              className="btn-ghost border border-slate-300"
              onClick={() => exportCsv(mod, rows)}
              disabled={rows.length === 0}
            >
              {t(T.exportCsv)}
            </button>
            <label className={`btn-ghost border border-slate-300 cursor-pointer ${importing ? "opacity-50" : ""}`}>
              {importing ? t(T.importing) : t(T.importCsv)}
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
                  const { count, error } = await importCsv(file, mod, slug, moduleId, lang);
                  setImporting(false);
                  if (fileRef.current) fileRef.current.value = "";
                  if (error) {
                    alert(t(T.importFailed) + error);
                  } else {
                    alert(t(T.importOk).replace("{n}", String(count)));
                    setTick((tk) => tk + 1);
                  }
                }}
              />
            </label>
          </div>
        )}
      </header>

      {!enabled && (
        <div className="card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {t(T.notEnabledPre)}<Link href={`/${slug}/settings`} className="underline">{t(T.settings)}</Link>{t(T.notEnabledPost)}
        </div>
      )}

      {/* ── Stats section ── */}
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{t(T.statsLabel)}</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
            {([0, 7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setStatsRange(d)}
                className={`rounded-md px-2.5 py-1 ${statsRange === d ? "bg-white font-medium shadow-sm text-ink" : "text-ink-faint"}`}
              >
                {d === 0 ? t(T.all) : t(T.lastNDays).replace("{n}", String(d))}
              </button>
            ))}
            <button
              onClick={() => setStatsRange("custom")}
              className={`rounded-md px-2.5 py-1 ${statsRange === "custom" ? "bg-white font-medium shadow-sm text-ink" : "text-ink-faint"}`}
            >
              {t(T.custom)}
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
            <div className="text-xs text-ink-faint">{t(T.recordCount)}</div>
            <div className="mt-1 text-xl font-bold text-ink">{statsRows.length}</div>
          </div>
          {/* KPI total */}
          {mod.amountKey && (
            <div className="card p-4">
              <div className="text-xs text-ink-faint">
                {statsRange === "custom" ? t(T.thisPeriod) : statsRange === 0 ? t(T.cumulative) : t(T.lastNDaysShort).replace("{n}", String(statsRange))}
                {mod.amountLabel?.zh ?? t(T.totalLabel)}
              </div>
              <div className="mt-1 text-xl font-bold text-ink">
                {mod.amountKind === "money" ? money(sum(statsRows, mod.amountKey)) : num(sum(statsRows, mod.amountKey))}
              </div>
            </div>
          )}
          {moduleId === "stock-loss" && (
            <div className="card p-4">
              <div className="text-xs text-ink-faint">{t(T.cumulativeScrapValue)}</div>
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
                    <div className="text-xs text-ink-faint">{t(T.avgSuffix).replace("{label}", biLabel(f.label, lang))}</div>
                    <div className="mt-1 text-xl font-bold text-ink">{fmt(avg(statsRows, f.key))}</div>
                  </div>
                );
              }
              return (
                <div key={f.key} className="card p-4">
                  <div className="text-xs text-ink-faint">{t(T.sumAvgSuffix).replace("{label}", biLabel(f.label, lang))}</div>
                  <div className="mt-1 text-xl font-bold text-ink">{fmt(sum(statsRows, f.key))}</div>
                  <div className="text-xs text-ink-faint">{t(T.avgPrefix)}{fmt(avg(statsRows, f.key))}</div>
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
      <ModuleInsights
        moduleId={moduleId}
        rows={rows}
        slug={slug}
        refresh={() => setTick((t) => t + 1)}
        fields={displayFields}
        edit={{
          editingId,
          editForm,
          setEditForm,
          startEdit,
          saveEdit,
          cancelEdit,
          remove: async (id: string) => {
            await deleteRecord(id);
            setTick((tk) => tk + 1);
          },
        }}
        onAddRecord={() => setOpen(true)}
        enabled={enabled}
      />

      {/* trend chart */}
      {mod.amountKey && rows.length >= 2 && (
        <div className="mb-6">
          <TrendChart
            rows={rows}
            valueKey={mod.amountKey}
            label={mod.amountLabel?.zh ?? t(T.value)}
            isMoney={mod.amountKind === "money"}
          />
        </div>
      )}

      {/* entry form */}
      {open && enabled && (
        <section className="card mb-6 p-5">
          <div className="mb-3 text-sm font-semibold text-ink">{t(T.newRecord)}</div>
          {moduleId === "daily-close" && autoFilling && (
            <div className="mb-4 text-xs text-ink-faint">{t(T.computing)}</div>
          )}

          {moduleId === "scheduling" && (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">{t(T.shift)}</label>
                <button
                  type="button"
                  onClick={() => (editingPresets ? setEditingPresets(false) : openPresetEditor())}
                  className="text-xs font-medium text-brand hover:text-brand-soft"
                >
                  {editingPresets ? t(T.done) : t(T.editDefaultShifts)}
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
                    {t(T.saveDefaultShifts)}
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
                    {t(T.custom)}
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
                      {biLabel(f.label, lang)}
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
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={submit}>{t(T.save)}</button>
            <button className="btn-ghost" onClick={() => { setForm({}); setShiftPreset("custom"); setOpen(false); }}>{t(T.cancel)}</button>
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
              {t(T.prevWeek)}
            </button>
            <span className="min-w-[9.5rem] text-center font-medium text-ink">
              {fmtMonthDay(dateFrom, lang)} – {fmtMonthDay(dateTo, lang)}
            </span>
            <button
              className="rounded border border-slate-200 px-2 py-1 text-ink-soft hover:bg-slate-50"
              onClick={() => setWeekAnchor((d) => addDays(d, 7))}
            >
              {t(T.nextWeek)}
            </button>
            <button
              className="text-brand hover:text-brand-soft"
              onClick={() => setWeekAnchor(new Date().toISOString().slice(0, 10))}
            >
              {t(T.thisWeek)}
            </button>
            {copyMode ? (
              <>
                <span className="text-ink-faint">{t(T.selectedCount).replace("{a}", String(selectedForCopy.size)).replace("{b}", String(filteredRows.length))}</span>
                <button
                  disabled={selectedForCopy.size === 0 || copyingWeek}
                  onClick={confirmCopySelection}
                  className="rounded-full border border-brand bg-brand px-3 py-1 font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copyingWeek ? t(T.copying) : t(T.copyNToNextWeek).replace("{n}", String(selectedForCopy.size))}
                </button>
                <button onClick={cancelCopySelection} className="text-ink-faint hover:text-ink">
                  {t(T.cancel)}
                </button>
              </>
            ) : (
              <button
                disabled={filteredRows.length === 0}
                onClick={startCopySelection}
                className="rounded-full border border-brand px-3 py-1 font-semibold text-brand hover:bg-brand-wash disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t(T.copyToNextWeek)}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-ink-faint">
            <span>{t(T.date)}</span>
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
                <span className="text-ink-faint">{t(T.filteredCount).replace("{a}", String(filteredRows.length)).replace("{b}", String(rows.length))}</span>
                <button className="text-brand hover:text-brand-soft" onClick={() => { setColFilters({}); setPage(1); }}>
                  {t(T.clearFilter)}
                </button>
              </>
            )
          : hasAnyFilter && (
              <>
                <span className="text-ink-faint">{t(T.filteredCount).replace("{a}", String(filteredRows.length)).replace("{b}", String(rows.length))}</span>
                <button
                  className="text-brand hover:text-brand-soft"
                  onClick={() => { setColFilters({}); setDateFrom(""); setDateTo(""); setPage(1); }}
                >
                  {t(T.clearAllFilters)}
                </button>
              </>
            )}
      </div>

      {moduleId === "scheduling" && <AttendanceAnomalies rows={filteredRows} />}

      {/* records table — dense grid; scrolls within the card on mobile (contained,
          never breaks the page). Card-ify is a separate larger effort (T2).
          Suppressed for 菜品销量, whose ranked table above already lists every
          record with the same actions. */}
      {!rankedTableReplacesGeneric && (
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-ink-faint sm:hidden">{t(T.swipeHint)}</div>
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
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
                        aria-label={t(T.selectAll)}
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
                        {biLabel(f.label, lang)}
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
                                placeholder={t(T.searchPlaceholder)}
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
                              {t(T.selectAll)}
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
                              {t(T.confirm)}
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
                  deleteRecord={async (id) => { await deleteRecord(id); setTick((t) => t + 1); }}
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
                                  aria-label={isExpanded ? t(T.collapseRow) : t(T.expand)}
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
                      ? (enabled ? t(T.emptyEnabled) : t(T.emptyDisabled))
                      : t(T.emptyFiltered)}
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
              {t(T.pageRange)
                .replace("{from}", String((safePage - 1) * PAGE_SIZE + 1))
                .replace("{to}", String(Math.min(safePage * PAGE_SIZE, filteredRows.length)))
                .replace("{total}", String(filteredRows.length))}
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
                {t(T.prevPage)}
              </button>
              <span className="px-2 font-medium text-ink">{safePage} / {totalPages}</span>
              <button
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-30"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t(T.nextPage)}
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
      )}
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
  const { t, lang } = useLang();
  const listId = suggestions?.length ? `dl-${field.key}` : undefined;
  return (
    <div>
      <label className="label">
        {biLabel(field.label, lang)}
        {field.required && <span className="text-red-500"> *</span>}
        {field.suffix && <span className="text-ink-faint"> ({typeof field.suffix === "string" ? field.suffix : t(field.suffix)})</span>}
        {readOnly && <span className="text-brand">{t(T.autoComputed)}</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea className="input min-h-[72px]" value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
      ) : field.type === "select" ? (
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={readOnly}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.zh} value={o.zh}>{biLabel(o, lang)}</option>
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
  const { t } = useLang();
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
        <h2 className="text-sm font-semibold text-ink">{t(T.anomalyTitle)}</h2>
        {groups.length > 0 && (
          <span className="text-xs text-ink-faint">{Object.entries(totals).map(([k, v]) => t(T.timesSuffix).replace("{k}", k).replace("{v}", String(v))).join(" · ")}</span>
        )}
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-faint">{t(T.anomalyEmpty)}</p>
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

/** Inline edit/delete plumbing owned by ModulePage, handed to insight blocks
 *  that render their own table (菜品销量) instead of the generic one. */
export interface EditHandlers {
  editingId: string | null;
  editForm: Record<string, string>;
  setEditForm: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  startEdit: (r: RecordRow) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  remove: (id: string) => Promise<void>;
}

/** Per-module analytics blocks that the generic stats/alerts can't express. */
function ModuleInsights({
  moduleId, rows, slug, refresh, fields, edit, onAddRecord, enabled,
}: {
  moduleId: string;
  rows: RecordRow[];
  slug: string;
  refresh: () => void;
  fields: Field[];
  edit: EditHandlers;
  onAddRecord: () => void;
  enabled: boolean;
}) {
  if (moduleId === "dish-margin")
    return <DishSalesRanking rows={rows} fields={fields} edit={edit} onAddRecord={onAddRecord} enabled={enabled} />;
  if (moduleId === "purchasing") return <SupplierCompare rows={rows} />;
  if (moduleId === "reviews") return <ReviewTopics rows={rows} />;
  if (moduleId === "members") return <TierSettings slug={slug} />;
  if (moduleId === "equipment") return <EquipmentMonthlyChecklist rows={rows} slug={slug} refresh={refresh} />;
  return null;
}

/** 本月到期保养清单：把「下次保养日期」落在本月及之前（含逾期）的设备列出来，做成
 *  可勾选的清单。这里只看 nextService，不看 status —— status 记录的是"这条维修/问题
 *  是否处理好了"，跟"下次保养提醒是否还没到"是两码事：同一台设备可以问题已解决
 *  （status=已完成）但下次保养日期仍落在本月，这时候仍然要出现在清单里。 */
function EquipmentMonthlyChecklist({ rows, slug, refresh }: { rows: RecordRow[]; slug: string; refresh: () => void }) {
  const { t } = useLang();
  const [savingId, setSavingId] = useState<string | null>(null);

  const due = useMemo(() => {
    // Local Y-M-D throughout — .toISOString() converts to UTC first, which can
    // shift the calendar day (e.g. evenings in UTC-negative zones roll over to
    // "tomorrow" in UTC), silently dropping items near the month boundary.
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    const todayStr = ymd(now);
    const monthEnd = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return rows
      // servicedThrough records which nextService value was already acknowledged —
      // once it matches the current nextService, this cycle's reminder is done.
      // (We never touch nextService itself, so the date stays visible in the
      // history table instead of getting wiped out.)
      .filter((r) => r.nextService && r.nextService <= monthEnd && r.servicedThrough !== r.nextService)
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
      alert(t(T.operationFailed) + error);
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
      await addRecord(slug, "equipment", {
        equipment: r.equipment || "",
        date: newNextService,
        issue: r.issue || "",
        vendor: r.vendor || "",
        cost: "",
        status: "待处理",
        nextService: newNextService,
        intervalDays: r.intervalDays,
      });
    }
    setSavingId(null);
    refresh();
  };

  return (
    <section className="card mb-6 p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-ink">{t(T.monthlyChecklist)}</div>
        <span className="text-xs text-ink-faint">{t(T.itemsPending).replace("{n}", String(due.length))}</span>
      </div>
      <p className="mb-3 text-xs text-ink-faint">{t(T.checklistHint)}</p>
      <div className="space-y-1.5">
        {due.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5 text-sm">
            <span className="font-medium text-ink">{r.equipment || t(T.equipmentFallback)}</span>
            {r.issue && <span className="text-ink-soft">{r.issue}</span>}
            <span className={`ml-auto text-xs font-medium tabular-nums ${r.overdue ? "text-red-600" : "text-ink-faint"}`}>
              {r.overdue ? t(T.overduePrefix).replace("{d}", String(r.nextService)) : r.nextService}
            </span>
            <button
              className="btn-primary !py-1 !text-xs"
              disabled={savingId === r.id}
              onClick={() => markServiced(r)}
            >
              {savingId === r.id ? "…" : t(T.markServiced)}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TierSettings({ slug }: { slug: string }) {
  const { t } = useLang();
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
    const valid = tiers.filter((tier) => tier.name.trim());
    if (!valid.length) return;
    setSaving(true);
    setMsg("");
    await saveTierRules(slug, valid);
    const updated = await reapplyTiers(slug);
    setTiers(valid.sort((a, b) => a.minSpend - b.minSpend));
    setMsg(updated > 0 ? t(T.savedTiersUpdated).replace("{n}", String(updated)) : t(T.saved));
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <section className="card mb-6 p-5">
      <button
        className="flex w-full items-center justify-between text-sm font-semibold text-ink"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>{t(T.tierRules)}</span>
        <span className={`text-xl leading-none transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>
      {expanded && (
        <>
          <p className="mt-3 mb-3 text-xs text-ink-faint">{t(T.tierHint)}</p>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                  placeholder={t(T.tierNamePlaceholder)}
                  value={tier.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                />
                <span className="text-xs text-ink-faint">{t(T.tierAtLeast)}</span>
                <input
                  className="w-24 rounded border border-slate-200 px-2 py-1.5 text-sm text-right outline-none focus:border-brand"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={tier.minSpend || ""}
                  onChange={(e) => update(i, "minSpend", e.target.value)}
                />
                <span className="text-xs text-ink-faint">{t(T.tierUnit)}</span>
                {tiers.length > 1 && (
                  <button className="text-xs text-red-400 hover:text-red-600" onClick={() => remove(i)}>{t(T.del)}</button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-ghost border border-slate-300 text-xs" onClick={add}>{t(T.addTier)}</button>
            <button className="btn-primary text-xs" onClick={save} disabled={saving}>
              {saving ? t(T.saving) : t(T.saveAndApply)}
            </button>
            {msg && <span className="text-xs text-emerald-600">{msg}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/** 菜品销量 — the ONE table this module renders (the generic records table is
 *  suppressed for dish-margin; see rankedTableReplacesGeneric).
 *
 *  Design review 2026-07-20, approved variant C:
 *   · Ranked leaderboard. The numbers are the visual interest — no colour-wash
 *     summary boxes, no emoji, no per-row accent bar.
 *   · Dishes that sold ZERO are ranked LAST, not filtered out. The module's own
 *     stated pain is 「不知道哪些菜卖得好、哪些卖不动」; the old `.filter(sold > 0)`
 *     removed exactly the dishes the owner wants to find.
 *   · Emerald marks ONE thing — the top revenue figure. An accent on every row
 *     marks nothing.
 *   · Body ≥14px with tabular-nums so money columns line up and don't jitter.
 *
 *      rank  dish            price     sold      revenue
 *      ────  ─────────────  ───────  ───────  ──────────
 *       1    红烧蟹肉翅       $48.00     1,286   $61,728.00  ← emerald (top)
 *       2    白灼虾           $36.00     1,102   $39,672.00
 *       …
 *       9    避风塘炒蟹       $88.00         0        $0.00  ← muted + 未售出
 */
function DishSalesRanking({
  rows, fields, edit, onAddRecord, enabled,
}: {
  rows: RecordRow[];
  fields: Field[];
  edit: EditHandlers;
  onAddRecord: () => void;
  enabled: boolean;
}) {
  const { t, lang } = useLang();

  // Ordering rules live in lib/dishSales (pure, unit-tested) — the zero-seller
  // behaviour is the point of this panel and deserves a test, not a comment.
  const ranked = useMemo(() => rankDishes(rows), [rows]);
  const topRev = useMemo(() => topRevenue(ranked), [ranked]);

  // Empty is a feature (DESIGN-PLATFORM.md States). The old code returned null
  // here, so a new merchant saw blank space and couldn't tell broken from empty.
  if (ranked.length === 0) {
    return (
      <section className="card mb-6 p-8 text-center">
        <div className="text-sm font-semibold text-ink">{t(T.emptyRankTitle)}</div>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">{t(T.emptyRankHint)}</p>
        {enabled && (
          <button className="btn-primary mt-4" onClick={onAddRecord}>
            {t(T.addRecord)}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="card mb-6 overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-3 text-[13px] font-bold text-ink">
        {t(T.salesRanking)}
      </div>
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[560px] text-sm [font-variant-numeric:tabular-nums]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-ink-faint">
              <th className="w-14 px-4 py-2.5 font-medium">{t(T.rank)}</th>
              {fields.map((f) => (
                <th
                  key={f.key}
                  className={`px-4 py-2.5 font-medium ${f.type === "money" || f.type === "number" ? "text-right" : ""}`}
                >
                  {biLabel(f.label, lang)}
                </th>
              ))}
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {ranked.map((d, i) => {
              const r = d.row;
              const isEditing = edit.editingId === r.id;
              const unsold = d.sold <= 0;
              if (isEditing) {
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-1.5 text-ink-faint">{i + 1}</td>
                    {fields.map((f) => (
                      <td key={f.key} className="px-2 py-1.5">
                        <EditCellInput
                          field={f}
                          value={edit.editForm[f.key] ?? ""}
                          onChange={(v) => edit.setEditForm((prev) => ({ ...prev, [f.key]: v }))}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-1.5 text-right whitespace-nowrap">
                      <button onClick={edit.saveEdit} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.save)}</button>
                      <button onClick={edit.cancelEdit} className="text-xs text-ink-faint hover:text-ink">{t(T.cancel)}</button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className={`px-4 py-3 ${unsold ? "text-ink-faint" : "font-semibold text-ink"}`}>{i + 1}</td>
                  {fields.map((f) => {
                    const numeric = f.type === "money" || f.type === "number";
                    // The single highest revenue figure is the one emerald in
                    // this panel. Guard on > 0 so an all-zero month doesn't
                    // decorate a $0 row as if it were the winner.
                    const isTopRevenue = f.key === "revenue" && topRev > 0 && d.revenue === topRev;
                    return (
                      <td
                        key={f.key}
                        className={[
                          "px-4 py-3",
                          numeric ? "text-right" : "",
                          isTopRevenue ? "font-semibold text-brand" : unsold ? "text-ink-faint" : "text-ink-soft",
                        ].join(" ")}
                      >
                        {renderCell(f, r[f.key])}
                        {/* Text label, not colour alone — a11y + it names the
                            thing the owner is looking for. */}
                        {f.key === "soldMonth" && unsold && (
                          <span className="ml-2 text-xs text-ink-faint">{t(T.notSold)}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => edit.startEdit(r)} className="text-xs text-brand hover:text-brand-soft mr-2">{t(T.edit)}</button>
                    <button
                      onClick={async () => { if (confirm(t(T.confirmDelete))) await edit.remove(r.id); }}
                      className="text-xs text-ink-faint hover:text-red-600"
                    >
                      {t(T.del)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** 供应商比价：同一品项跨供应商的均价对比，标出最低价。 */
function SupplierCompare({ rows }: { rows: RecordRow[] }) {
  const { t } = useLang();
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
      <div className="mb-1 text-sm font-semibold text-ink">{t(T.supplierCompare)}</div>
      <div className="mb-3 text-xs text-ink-faint">{t(T.supplierCompareHint)}</div>
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
                  <span className="text-xs text-emerald-600">{t(T.savesPerUnit).replace("{amt}", money(save))}</span>
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
  const { t } = useLang();
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
      <div className="mb-3 text-sm font-semibold text-ink">{t(T.topicStats)}</div>
      <div className="space-y-2">
        {topics.map((topic) => (
          <div key={topic.topic} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-ink-soft">{topic.topic}</span>
            <div className="h-3 flex-1 rounded bg-slate-100">
              <div
                className={`h-3 rounded ${topic.topic === "好评" ? "bg-emerald-400" : "bg-brand/60"}`}
                style={{ width: `${(topic.n / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-medium text-ink">{t(T.countSuffix).replace("{n}", String(topic.n))}</span>
            <span className="w-14 shrink-0 text-right text-ink-faint">
              {topic.avg != null ? `${(Math.round(topic.avg * 10) / 10)}★` : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendChart({ rows, valueKey, label, isMoney }: { rows: RecordRow[]; valueKey: string; label: string; isMoney?: boolean }) {
  const { t } = useLang();
  const grouped = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      const d = r.date || r.createdAt?.slice(0, 10) || "";
      if (!d) continue;
      map[d] = (map[d] || 0) + (parseFloat(r[valueKey]) || 0);
    }
    // Last 14 CALENDAR days — not the last 14 dates that happen to carry data.
    // `.slice(-14)` did the latter, so a chart titled 近14天 silently stretched
    // back a month whenever business was quiet, dragging in old (and test) rows:
    // one seeded $11k day from June sat next to real July numbers and flattened
    // every real day into the baseline.
    // Days with no sales are filled with 0 rather than skipped, so the x-axis is
    // evenly spaced and a quiet day reads as quiet instead of vanishing.
    const key = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
    const today = new Date();
    const out: [string, number][] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = key(d);
      out.push([k, map[k] ?? 0]);
    }
    return out;
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
      <div className="text-xs font-semibold text-ink-faint mb-2">{t(T.trendTitle).replace("{label}", label)}</div>
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
