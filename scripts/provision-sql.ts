// ─────────────────────────────────────────────────────────────────────────
//  模版 → 可审查 SQL（懂终端的开店路径）
//
//  用法:
//    npx vite-node scripts/provision-sql.ts -- \
//      --template templates/chinese-restaurant.json \
//      --slug golden-wok --name 老王面馆 --name-en "Golden Wok" \
//      --owner <supabase-auth-user-uuid> [--address "..."] [--out provision.sql]
//
//  输出的 SQL 就是 dry-run 预览（头部写明将创建什么）：先通读，
//  再贴进 Supabase → SQL Editor 执行。可重复执行（幂等 upsert）。
//  店主 uuid 在 Supabase → Authentication → Users 页复制。
// ─────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from "node:fs";
import { buildProvisionSql, validateTemplate, type TenantTemplate } from "../lib/tenantTemplate";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const templatePath = arg("template");
const slug = arg("slug");
const name = arg("name");
const owner = arg("owner");
if (!templatePath || !slug || !name || !owner) {
  console.error("缺参数。用法：--template <json> --slug <slug> --name <中文店名> --owner <uuid> [--name-en ...] [--address ...] [--out ...]");
  process.exit(1);
}

const template = JSON.parse(readFileSync(templatePath, "utf8")) as TenantTemplate;
const v = validateTemplate(template);
if (!v.ok) {
  console.error(`模版 ${templatePath} 不合法：\n- ${v.errors.join("\n- ")}`);
  process.exit(1);
}

const sql = buildProvisionSql(template, {
  slug,
  name_zh: name,
  name_en: arg("name-en"),
  owner_id: owner,
  address: arg("address"),
});

const out = arg("out");
if (out) {
  writeFileSync(out, sql);
  console.error(`✓ 已写入 ${out} —— 通读一遍（这就是预览），再贴进 Supabase SQL Editor 执行。`);
} else {
  console.log(sql);
}
