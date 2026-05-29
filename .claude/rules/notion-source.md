---
description: notion-source / notion-orm パッケージの Notion API 慣行
paths:
  - "packages/notion-source/**"
  - "packages/notion-orm/**"
---

# notion-source パッケージ

## 基本

- `CMSAdapter`（core 定義）を構築する Notion 向けアダプタ
- 公開 API は `notionSource({ schema, token, fetch?, publishOptions? })`
- 実際の Notion API 呼び出し・Markdown 変換・ブロック取得は `@notion-headless-cms/notion-orm`
  （`createNotionCollection`）が担い、`notion-source` はスキーマからコレクションを束ねる薄い層
- 本文取得戦略は `fetch`（`blocksFetcher()` / `markdownFetcher()`）で注入。未指定時は
  notion-orm 内の blocks 戦略にフォールバック（`notionBlocks()` がそのまま使える）

## 依存

- `@notionhq/client` と `zod` は **`peerDependencies`**。利用側でのインストールが必要
- core には `dependencies: { "@notion-headless-cms/core": "workspace:*" }` で依存
- Markdown 変換 (`notion-to-md` 等) は notion-orm 側の依存

## internal/ の非公開

- `packages/notion-orm/src/internal/fetcher/` — Notion API クライアント実装
- `packages/notion-orm/src/internal/transformer/` — blocks → Markdown 変換
- **他パッケージ・外部から `internal/*` を直接 import してはならない**
- 公開したい場合は `src/index.ts` 経由で re-export する

## Notion API 呼称

- 「データベース」は API 上の `data_sources`（v5 系の呼称）
- ページ単位は `NotionPage`（`@notionhq/client` のページオブジェクト）を型エイリアスとして再エクスポート

## Webhook

- `DataSource.parseWebhook(req, { secret })` を `NotionCollection` が実装（既定実装）
- collection 名は core ハンドラが URL (`POST {basePath}/revalidate/:collection`) から渡す。
  `notionSource()` が各コレクションに `collectionName` を渡して `InvalidateScope.collection` に使う
- シークレットは `?secret=` クエリ / `X-Webhook-Secret` ヘッダ / `Authorization: Bearer` のいずれか
- body に `{ "slug": "..." }` があればそのスラッグのみ、無ければコレクション全体を無効化
- Notion の HMAC 署名検証など独自方式が必要なら `parseWebhook` を自前実装で差し替える

## Notion API 呼び出し

現行 `@notionhq/client` は v5+（`data_sources` 概念が導入済み）。

### 一覧取得（ページネーション）

```ts
const response = await client.dataSources.query({
	data_source_id: dataSourceId,
	filter,
	sorts,
	page_size: 100,  // 最大 100
	start_cursor,
});
// response.has_more / response.next_cursor でページング
```

### ブロック取得

```ts
const response = await client.blocks.children.list({
	block_id: pageId,
	page_size: 100,
	start_cursor,
});
```

- ブロックはネスト可能。`has_children: true` のブロックは再帰的に取得する（`fetchBlockTree`）

## rate limit 対応

- Notion API は 3 req/sec（公式）
- `withRetry()`（`@notion-headless-cms/core`）で指数バックオフ
- 429 レスポンスは `Retry-After` ヘッダを尊重

## エラー

- 取得失敗: `CMSError code: "source/fetch_items_failed"` / `"source/fetch_item_failed"`
- Markdown 読み込み失敗: `CMSError code: "source/load_markdown_failed"`
- ブロック取得失敗: `CMSError code: "source/load_blocks_failed"` / 未対応戦略は `"source/blocks_unsupported"`
- 生の `APIError` は throw しない。必ず `CMSError` に変換

## テスト

- Notion API は `vi.mock("@notionhq/client")` または internal fetcher のモックで差し替え
- `packages/notion-orm/src/__tests__/notion-adapter.test.ts` を参考

## 最新情報

API 仕様は変わる可能性があるため、不明点は Notion MCP もしくは公式ドキュメントを参照:
https://developers.notion.com/reference
