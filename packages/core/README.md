# @notion-headless-cms/core

CMS エンジン本体。データソース・キャッシュ・レンダラーを統合し、Stale-While-Revalidate / 更新検知 / クエリビルダー / フック / リトライを提供する。**外部ランタイム依存ゼロ**。

## インストール

```bash
npm install @notion-headless-cms/core
```

Cloudflare Workers / Node.js / Next.js などで使う場合は、それぞれのアダプタを使うのが最短ルート:

- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare)
- [`@notion-headless-cms/adapter-node`](../adapter-node)
- [`@notion-headless-cms/adapter-next`](../adapter-next)

## 使い方（core を直接使う場合）

```typescript
import { createCMS, memoryDocumentCache, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  renderer: renderMarkdown,
  schema: {
    publishedStatuses: ["公開"],
    properties: { slug: "Slug" },
  },
  cache: {
    document: memoryDocumentCache(),
    image: memoryImageCache(),
    ttlMs: 5 * 60 * 1000,
  },
});

// ソース直接
const items = await cms.list();
const item = await cms.find("my-post");
const rendered = item ? await cms.render(item) : null;

// SWR
const { items: cachedItems } = await cms.cache.read.list();
const cached = await cms.cache.read.get("my-post");
console.log(cached?.html);
```

### カスタムコンテンツ型

`BaseContentItem` を拡張することで任意のプロパティを追加できる。

```typescript
import type { BaseContentItem } from "@notion-headless-cms/core";
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

interface MyPost extends BaseContentItem {
  title: string;
  category: string;
}

const cms = createCMS<MyPost>({
  source: notionAdapter<MyPost>({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
    mapItem: (page) => ({
      id: page.id,
      slug: /* ... */ "",
      updatedAt: page.last_edited_time,
      publishedAt: page.created_time,
      title: /* ... */ "",
      category: /* ... */ "",
    }),
  }),
});
```

> 型安全なマッピングは [`defineSchema`](../source-notion) を推奨。

## 主要 API

### `CMS<T>` / `createCMS<T>(options)`

| メソッド | 説明 |
|---|---|
| `list()` | ソースから一覧取得 |
| `find(slug)` | ソースから単一アイテム取得 |
| `render(item)` | Markdown → HTML にレンダリング |
| `isPublished(item)` | `publishedStatuses` 判定 |
| `cache.read.list()` | SWR で一覧取得 |
| `cache.read.get(slug)` | SWR で単一アイテム取得 |
| `cache.manage.prefetchAll(opts?)` | 全アイテムを事前レンダリング |
| `cache.manage.revalidate(scope?)` | キャッシュ無効化 |
| `cache.manage.sync(payload?)` | Webhook 由来のキャッシュ同期 |
| `cache.manage.checkList(version)` | 一覧差分検知 |
| `cache.manage.checkItem(slug, lastEdited)` | 個別差分検知 |
| `query()` | QueryBuilder を返す |
| `getStaticSlugs()` | 静的生成用スラッグ一覧 |
| `getCachedImage(hash)` | キャッシュ画像を取得 |
| `createCachedImageResponse(hash)` | キャッシュ画像の Response を生成 |

詳細は [CMS メソッド一覧](../../docs/api/cms-methods.md) を参照。

### ユーティリティ

| エクスポート | 説明 |
|---|---|
| `memoryDocumentCache<T>()` | インメモリ DocumentCacheAdapter |
| `memoryImageCache()` | インメモリ ImageCacheAdapter |
| `noopDocumentCache<T>()` / `noopImageCache()` | 何もしないアダプタ |
| `isStale(cachedAt, ttlMs)` | TTL 切れ判定 |
| `sha256Hex(data)` | SHA256 ハッシュ生成 |
| `CMSError` / `isCMSError` / `isCMSErrorInNamespace` | エラークラスと判定ヘルパー |
| `QueryBuilder` | クエリ組み立て（`cms.query()` が返す） |
| `withRetry` / `DEFAULT_RETRY_CONFIG` | リトライ付き実行 |
| `definePlugin` | プラグイン（hooks / logger）の型付き定義 |

## 主要な型

- `CreateCMSOptions<T>` — `createCMS()` の引数
- `BaseContentItem` — デフォルト・カスタム型の基底（`status` / `publishedAt` はオプション）
- `CachedItem<T>` / `CachedItemList<T>` — キャッシュ済みコンテンツ
- `DataSourceAdapter<T>` — データソース抽象
- `DocumentCacheAdapter<T>` / `ImageCacheAdapter` — キャッシュ抽象
- `RendererFn` / `RenderOptions` — レンダラー関数の型
- `CMSErrorCode` / `CMSErrorContext` — エラー型（名前空間付き）

## エラー体系

すべての内部エラーは `CMSError` に統一される。コードは `namespace/kind` 形式。

```ts
import { isCMSErrorInNamespace } from "@notion-headless-cms/core";

try {
  await cms.list();
} catch (err) {
  if (isCMSErrorInNamespace(err, "source/")) {
    // Notion 取得系エラー
  }
}
```

組み込みコード: `core/config_invalid` / `core/schema_invalid` / `source/fetch_items_failed` / `source/fetch_item_failed` / `source/load_markdown_failed` / `cache/io_failed` / `renderer/failed`

## 関連パッケージ

- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース
- [`@notion-headless-cms/renderer`](../renderer) — Markdown → HTML レンダラー
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 キャッシュ
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR キャッシュ
