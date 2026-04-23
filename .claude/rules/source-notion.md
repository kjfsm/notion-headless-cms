---
description: source-notion パッケージの Notion API 慣行
paths:
  - "packages/source-notion/**"
---

# source-notion パッケージ

## 基本

- `DataSourceAdapter`（core 定義）を実装する Notion 向けアダプタ
- 公開 API は `notionAdapter({ token, dataSourceId, schema?, mapItem?, properties?, blocks? })`
- Zod による型安全マッピング: `defineSchema(zodSchema, mapping)` / `defineMapping<T>(mapping)`

## 依存

- `@notionhq/client` と `zod` は **`peerDependencies`**。利用側でのインストールが必要
- `notion-to-md` は `dependencies`（Notion blocks → Markdown 変換）
- core には `dependencies: { "@notion-headless-cms/core": "workspace:*" }` で依存

## internal/ の非公開

- `packages/source-notion/src/internal/fetcher/` — Notion API クライアント実装
- `packages/source-notion/src/internal/transformer/` — blocks → Markdown 変換
- **他パッケージ・外部から `internal/*` を直接 import してはならない**
- 公開したい場合は `src/index.ts` 経由で re-export する

## Notion API 呼称

- 「データベース」は API 上の `data_sources`（v5 系の呼称）
- ページ単位は `NotionPage`（`@notionhq/client` のページオブジェクト）を型エイリアスとして再エクスポート
- rich_text は `NotionRichTextItem` として再エクスポート（`mapItem` で使う）

## マッピング

- `getPlainText(rich_text[])` で rich_text 配列を単純文字列化
- `mapItem` は `(page) => BaseContentItem & { ... }` を返す
- デフォルトマッパー (`mapper.ts`) は `Name` / `Slug` / `Status` / `Published` / `Updated` を読む

## エラー

- 取得失敗: `CMSError code: "source/fetch_items_failed"` / `"source/fetch_item_failed"`
- Markdown 読み込み失敗: `CMSError code: "source/load_markdown_failed"`
