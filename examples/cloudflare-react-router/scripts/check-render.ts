/**
 * Notion API からテストページの markdown を取得し、
 * fetch-markdown レンダラーで HTML に変換して問題がないか確認するスクリプト。
 *
 * 使い方:
 *   pnpm tsx scripts/check-render.ts [page-id]
 */

import { writeFileSync } from "node:fs";
import { createNotionMarkdownRenderer } from "@notion-headless-cms/fetch-markdown";
import { notionKatex } from "@notion-headless-cms/notion-katex";
import { notionShiki } from "@notion-headless-cms/notion-shiki";
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN が未設定です");
  process.exit(1);
}

const DB_ID = "34a21462-5ae9-80a7-a17b-000b93010c9f";
const client = new Client({ auth: token });

// -------------------------------------------------------------------
// 1. ページ ID を解決する
// -------------------------------------------------------------------
let pageId: string | undefined = process.argv[2];

if (!pageId) {
  console.log(`DB (${DB_ID}) からページを検索中...`);
  // v5.x API: databases.query → dataSources.query
  const res = await (
    client as unknown as {
      dataSources: {
        query: (opts: {
          data_source_id: string;
          page_size: number;
        }) => Promise<{ results: unknown[] }>;
      };
    }
  ).dataSources.query({ data_source_id: DB_ID, page_size: 10 });

  if (res.results.length === 0) {
    console.error("DB にページが見つかりません");
    process.exit(1);
  }

  // テストページを優先、なければ最初のページ
  const test = res.results.find((p) => {
    const page = p as {
      object?: string;
      properties?: Record<string, { title?: { plain_text: string }[] }>;
    };
    if (page.object !== "page") return false;
    const props = page.properties ?? {};
    const title =
      props.名前?.title?.[0]?.plain_text ??
      props.title?.title?.[0]?.plain_text ??
      "";
    return title.includes("テスト");
  });
  const page = (test ?? res.results[0]) as {
    id: string;
    properties: Record<string, { title?: { plain_text: string }[] }>;
  };
  pageId = page.id;

  const props = page.properties;
  const title =
    props.名前?.title?.[0]?.plain_text ??
    props.title?.title?.[0]?.plain_text ??
    "(タイトル不明)";
  console.log(`使用ページ: "${title}" (${pageId})`);
}

// -------------------------------------------------------------------
// 2. Notion markdown 取得
// -------------------------------------------------------------------
console.log("\nmarkdown 取得中...");
// @notionhq/client の公開型に retrieveMarkdown は未定義のため型アサーション
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdRes = await (client.pages as any).retrieveMarkdown({ page_id: pageId });
const markdown: string =
  typeof mdRes === "string" ? mdRes : (mdRes?.markdown ?? String(mdRes));

console.log(`markdown サイズ: ${markdown.length} 文字`);
console.log("\n--- markdown (先頭 600 文字) ---");
console.log(markdown.slice(0, 600));
console.log("...\n");

// -------------------------------------------------------------------
// 3. レンダラーで HTML に変換
// -------------------------------------------------------------------
console.log("HTML に変換中...");
const renderer = createNotionMarkdownRenderer([notionKatex(), notionShiki()]);

let html: string;
try {
  html = await renderer(markdown);
  console.log(`HTML サイズ: ${html.length} 文字`);
} catch (err) {
  console.error("変換エラー:", err);
  process.exit(1);
}

// -------------------------------------------------------------------
// 4. 問題のある要素を検出してレポート
// -------------------------------------------------------------------
const issues: string[] = [];

// 未処理の nhc タグが残っていないか
const rawTags =
  html.match(
    /<(callout|columns|column|mention-page|mention-date|table_of_contents)[^>]*>/gi,
  ) ?? [];
if (rawTags.length > 0) {
  issues.push(`未変換の Notion タグ: ${[...new Set(rawTags)].join(", ")}`);
}

// ## が HTML 内に残っているか（見出しが変換されていない兆候）
if (/^##\s/m.test(html)) {
  issues.push(
    "HTML 内に ## で始まる行がある（見出しが変換されていない可能性）",
  );
}

// KaTeX 数式が変換されているか
const hasMath = /\$[^$]/.test(markdown);
const hasKatex = html.includes('class="katex"');
if (hasMath && !hasKatex) {
  issues.push("数式($...$)はあるが KaTeX HTML が見つからない");
}

// shiki のコードハイライトが変換されているか
const hasCode = markdown.includes("```");
const hasShiki = html.includes("shiki") || html.includes('class="language-');
if (hasCode && !hasShiki) {
  issues.push(
    "コードブロックはあるが shiki ハイライトが見つからない（未ハイライト）",
  );
}

if (issues.length === 0) {
  console.log("\n✅ 問題なし: すべての要素が正常に変換されました");
} else {
  console.log("\n⚠️  検出した問題:");
  for (const issue of issues) {
    console.log(`  - ${issue}`);
  }
}

// -------------------------------------------------------------------
// 5. HTML をファイルに出力（ブラウザで直接確認できる）
// -------------------------------------------------------------------
const outPath = "/tmp/notion-render-check.html";
const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>レンダリング確認</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <style>
    body { font-family: sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; }
    .nhc-callout { display:flex; gap:.75rem; padding:1rem; margin-block:.75rem; border-radius:.375rem; background:#f9fafb; border:1px solid #e5e7eb; }
    .nhc-callout-icon { flex-shrink:0; font-size:1.25rem; }
    .nhc-callout-body { flex:1; min-width:0; }
    .nhc-columns { display:flex; gap:1.5rem; margin-block:.75rem; }
    .nhc-column  { flex:1; min-width:0; }
    .nhc-color-gray    { color:#6b7280; }
    .nhc-color-red     { color:#dc2626; }
    .nhc-color-blue    { color:#1d4ed8; }
    .nhc-color-green   { color:#15803d; }
    .nhc-color-purple  { color:#7c3aed; }
    .nhc-color-yellow  { color:#ca8a04; }
    .nhc-color-orange  { color:#ea580c; }
    .nhc-color-pink    { color:#db2777; }
    .nhc-color-brown   { color:#92400e; }
    .nhc-color-gray_background   { background:#f3f4f6; }
    .nhc-color-yellow_background { background:#fef9c3; }
    .nhc-color-blue_background   { background:#dbeafe; }
    .nhc-color-green_background  { background:#dcfce7; }
    .nhc-color-red_background    { background:#fee2e2; }
    .nhc-color-purple_background { background:#ede9fe; }
    .nhc-color-pink_background   { background:#fce7f3; }
    .nhc-color-orange_background { background:#ffedd5; }
    .nhc-color-brown_background  { background:#fef3c7; }
    .nhc-mention { display:inline; background:#e0e7ff; color:#3730a3; border-radius:.25rem; padding:.1rem .35rem; font-size:.875em; font-weight:500; }
    .nhc-link, .nhc-file { color:#1d4ed8; text-decoration:underline; }
    .nhc-underline { text-decoration:underline; }
    .nhc-toc[data-placeholder] { display:none; }
    pre, code { background:#1e1e1e; color:#d4d4d4; border-radius:.375rem; }
    pre { padding:1rem; overflow-x:auto; }
    code:not(pre code) { padding:.1rem .3rem; font-size:.875em; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

writeFileSync(outPath, fullHtml, "utf8");
console.log(`\nHTML を ${outPath} に出力しました（ブラウザで確認可能）`);
