// ─────────────────────────────────────────────────────────────────────────
//  Pinyin INITIALS for dish search (e.g. 菠萝咕噜肉 → "blglr"). This is the ONLY
//  module that pulls in pinyin-pro, and it must be imported ONLY by the admin
//  (Menu Settings, on save) and the backfill script — NEVER by the customer
//  menu. The diner menu matches a precomputed `search_initials` string stored on
//  the dish, so no pinyin dictionary is ever shipped to diners.
// ─────────────────────────────────────────────────────────────────────────
import { pinyin } from "pinyin-pro";

/** First pinyin letter of each Chinese character, non-Chinese passed through
 *  lowercased, stripped to [a-z0-9] — so "菠萝咕噜肉" → "blglr" and a mixed name
 *  like "XO酱皇" → "xojh" stay searchable. Recompute whenever the Chinese name
 *  changes and store the result on the dish. */
export function pinyinInitials(text: string | null | undefined): string {
  const s = (text ?? "").trim();
  if (!s) return "";
  try {
    const arr = pinyin(s, { pattern: "first", toneType: "none", type: "array", nonZh: "consecutive" });
    return arr.join("").toLowerCase().replace(/[^a-z0-9]/g, "");
  } catch {
    return "";
  }
}
