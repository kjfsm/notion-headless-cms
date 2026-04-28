/**
 * Notion API が実際に返すデータと、ライブラリが使っている項目を比較するための探索スクリプト。
 * 実行: node scripts/inspect-api.mjs
 */
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN が未設定です");
  process.exit(1);
}

const DB_NAME = process.env.DB_NAME || "ブログ記事DB";
const client = new Client({ auth: token });

function keys(obj, prefix = "") {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj).map((k) => (prefix ? `${prefix}.${k}` : k));
}

function summarize(obj, depth = 0, maxDepth = 2) {
  if (depth > maxDepth || !obj || typeof obj !== "object") return typeof obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      result[k] =
        `Array(${v.length})` +
        (v[0] ? ` [${summarize(v[0], depth + 1, maxDepth)}]` : "");
    } else if (v && typeof v === "object") {
      result[k] = summarize(v, depth + 1, maxDepth);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── 1. search でデータソース検索 ──────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`1. client.search({ query: "${DB_NAME}", filter: data_source })`);
console.log("=".repeat(60));

const searchResp = await client.search({
  query: DB_NAME,
  filter: { property: "object", value: "data_source" },
});

console.log(`results.length: ${searchResp.results.length}`);
if (searchResp.results.length === 0) {
  console.error(
    "データソースが見つかりませんでした。DB_NAME 環境変数を確認してください。",
  );
  process.exit(1);
}

const ds = searchResp.results[0];
console.log("\n--- search result[0] のトップレベルキー ---");
console.log(keys(ds));

console.log("\n--- search result[0] の構造 (depth=2) ---");
console.log(JSON.stringify(summarize(ds), null, 2));

const dataSourceId = ds.id;
console.log(`\n解決された dataSourceId: ${dataSourceId}`);

// ── 2. dataSources.retrieve ───────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log("2. client.dataSources.retrieve()");
console.log("=".repeat(60));

const retrieved = await client.dataSources.retrieve({
  data_source_id: dataSourceId,
});
console.log("\n--- retrieve のトップレベルキー ---");
console.log(keys(retrieved));

// properties の型一覧
const propTypes = {};
for (const [name, prop] of Object.entries(retrieved.properties ?? {})) {
  propTypes[name] = prop.type;
}
console.log("\n--- properties (名前 → type) ---");
console.log(propTypes);

// NOTION_TYPE_MAP（codegen.ts が対応している型）との差分
const SUPPORTED_TYPES = new Set([
  "title",
  "rich_text",
  "select",
  "status",
  "multi_select",
  "date",
  "number",
  "checkbox",
  "url",
]);
const allTypes = new Set(Object.values(propTypes));
console.log("\n--- ライブラリ未対応の型（スキップ対象）---");
const unsupported = [...allTypes].filter((t) => !SUPPORTED_TYPES.has(t));
console.log(unsupported.length ? unsupported : "(すべて対応済み)");

console.log("\n--- retrieve 全体の構造 (properties 省略) ---");
const { properties: _p, ...rest } = retrieved;
console.log(JSON.stringify(summarize(rest, 0, 3), null, 2));

// ── 3. dataSources.query（1件） ────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log("3. client.dataSources.query() — 最初の1件");
console.log("=".repeat(60));

const queryResp = await client.dataSources.query({
  data_source_id: dataSourceId,
  page_size: 1,
});

console.log(
  `results.length: ${queryResp.results.length}  has_more: ${queryResp.has_more}`,
);

if (queryResp.results.length > 0) {
  const page = queryResp.results[0];
  console.log("\n--- page のトップレベルキー ---");
  console.log(keys(page));

  // ライブラリが使っているフィールド
  const USED_FIELDS = [
    "id",
    "last_edited_time",
    "created_time",
    "object",
    "properties",
  ];
  const ALL_FIELDS = keys(page);
  const UNUSED_FIELDS = ALL_FIELDS.filter((k) => !USED_FIELDS.includes(k));

  console.log("\n--- ライブラリが使っているフィールド ---");
  console.log(USED_FIELDS);
  console.log(
    "\n--- ライブラリが使っていないフィールド（取得されているが未使用）---",
  );
  console.log(UNUSED_FIELDS);

  console.log("\n--- page の構造 (properties 省略, depth=2) ---");
  const { properties: _pp, ...pageRest } = page;
  console.log(JSON.stringify(summarize(pageRest, 0, 3), null, 2));

  // properties の各プロパティの実際の値構造（最初のページ）
  console.log("\n--- page.properties の各値構造 ---");
  for (const [name, prop] of Object.entries(page.properties ?? {})) {
    console.log(
      `  ${name} (${prop.type}): ${JSON.stringify(summarize(prop, 0, 2))}`,
    );
  }
}
