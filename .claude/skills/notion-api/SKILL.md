---
name: notion-api
description: Notion API (@notionhq/client v5+) の使い方。data_sources 呼称、rich_text の扱い、ブロック取得の注意点、rate limit 対応。source-notion を触る時に自動で呼ばれる
---

# notion-api — Notion API 実装ガイド

## 依存

- `@notionhq/client` は `source-notion` の **peerDependency**
- 現行系は v5+（`data_sources` 概念が導入済み）
- 型定義は `@notionhq/client/build/src/api-endpoints` から import 可能

## データソース（旧: データベース）

- v5 以降、Notion API は「データベース」を `data_sources` として扱う
- `dataSourceId` は `data_source.id`（UUID）
- `nhc` CLI は `dbName` でも受け付け、内部で name → id を解決する

## 典型的な呼び出し

### 一覧取得（ページネーション）

```ts
const response = await client.dataSources.query({
	data_source_id: dataSourceId,
	filter,
	sorts,
	page_size: 100,
	start_cursor,
});
```

- `response.has_more` / `response.next_cursor` でページング
- `page_size` は最大 100

### ブロック取得

```ts
const response = await client.blocks.children.list({
	block_id: pageId,
	page_size: 100,
	start_cursor,
});
```

- ブロックはネスト可能。子ブロックは再帰的に取得
- `has_children: true` のブロックに対して再帰呼び出し

## rich_text の扱い

```ts
const plain = item.rich_text.map((t) => t.plain_text).join("");
```

- 単純な文字列化は `getPlainText(rich_text)` ヘルパー（`source-notion/src/mapper.ts`）を使う
- フォーマット（bold/italic/link）は annotations を見る
- `notion-to-md` が Markdown への変換を担当

## rate limit 対応

- Notion API は 3 req/sec（公式）
- `withRetry()`（`@notion-headless-cms/core`）で指数バックオフ
- 429 レスポンスは `Retry-After` ヘッダを尊重

## エラーハンドリング

- `CMSError` に変換する（生の `APIError` を throw しない）
- 一覧失敗: `source/fetch_items_failed`
- 単一取得失敗: `source/fetch_item_failed`
- Markdown 読み込み失敗: `source/load_markdown_failed`

## 内部実装

- `packages/source-notion/src/internal/fetcher/` — Notion API クライアントラッパー
- `packages/source-notion/src/internal/transformer/` — blocks → Markdown 変換
- **これらは他パッケージから直接 import 禁止**（`rules/source-notion.md`）

## テスト

- Notion API は `vi.mock("@notionhq/client")` でモック
- 返り値の構造は `NotionPage` 型に従う
- `__tests__/notion-adapter.test.ts` を参考

## 最新情報

API 仕様は変わる可能性があるため、不明点は Notion MCP（推奨登録）もしくは公式ドキュメントを参照:

- https://developers.notion.com/reference
