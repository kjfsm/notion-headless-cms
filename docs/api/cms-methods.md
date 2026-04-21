# CMS API リファレンス

`@notion-headless-cms/core` の `createCMS()` / `CMS` クラスが公開する API の一覧。

## 目次

- [コンテンツ取得（ソース直接）](#コンテンツ取得ソース直接)
- [SWR 読み取り（`cms.cache.read`）](#swr-読み取りcmscacheread)
- [キャッシュ管理（`cms.cache.manage`）](#キャッシュ管理cmscachemanage)
- [クエリビルダー](#クエリビルダー)
- [画像配信](#画像配信)
- [`createCMS()` オプション](#createcms-オプション)
- [ライフサイクルフック](#ライフサイクルフック)
- [エラーハンドリング](#エラーハンドリング)
- [サブパスエクスポート](#サブパスエクスポート)

## コンテンツ取得（ソース直接）

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `list()` | `Promise<T[]>` | 公開済みコンテンツ一覧をソースから直接取得（`publishedStatuses` でフィルタ） |
| `find(slug)` | `Promise<T \| null>` | スラッグでコンテンツを取得（`accessibleStatuses` でフィルタ） |
| `render(item)` | `Promise<CachedItem<T>>` | アイテムを Markdown → HTML にレンダリング |
| `isPublished(item)` | `boolean` | `publishedStatuses` に含まれるかどうかを返す |

## SWR 読み取り（`cms.cache.read`）

Stale-While-Revalidate: キャッシュがあれば即返し、TTL 切れや未ヒットの場合はソースから取得して書き戻す。`createCMS({ waitUntil })` 指定時は書き戻しを非同期化する。

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `cache.read.list()` | `Promise<{ items: T[]; isStale: boolean; cachedAt: number }>` | キャッシュ優先で一覧を返す |
| `cache.read.get(slug)` | `Promise<CachedItem<T> \| null>` | キャッシュ優先で単一アイテムを返す |

`CachedItem<T>`:

```ts
interface CachedItem<T> {
  html: string;
  item: T;
  notionUpdatedAt: string;
  cachedAt: number;
}
```

## キャッシュ管理（`cms.cache.manage`）

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `cache.manage.prefetchAll({ concurrency?, onProgress? })` | `Promise<{ ok: number; failed: number }>` | 全コンテンツを事前レンダリングしてキャッシュに保存 |
| `cache.manage.revalidate(scope?)` | `Promise<void>` | 指定スコープ（`"all"` または `{ slug }`）のキャッシュを無効化 |
| `cache.manage.sync({ slug? })` | `Promise<{ updated: string[] }>` | Webhook ペイロードを元にキャッシュを同期。`slug` 省略時は全件 |
| `cache.manage.checkList(version)` | `Promise<{ changed: false } \| { changed: true; items: T[] }>` | 一覧の更新有無を返す |
| `cache.manage.checkItem(slug, lastEdited)` | `Promise<{ changed: false } \| { changed: true; html: string; item: T; notionUpdatedAt: string }>` | 単一アイテムの更新有無を返す |

> `prefetchAll` の `concurrency` はデフォルト `3`。Notion API のレート制限を踏まえて設定する。

## クエリビルダー

`cms.query()` で `QueryBuilder` を取得し、フィルタ・ソート・ページネーションを連鎖指定できる。

| メソッド | 説明 |
|---|---|
| `query().status(s \| [s])` | ステータスフィルタ（省略時は `publishedStatuses`） |
| `query().tag(t \| [t])` | `item.tags` に対するフィルタ |
| `query().where(predicate)` | 任意の述語でフィルタ |
| `query().sortBy(field, "asc" \| "desc")` | ソート指定 |
| `query().paginate({ page, perPage })` | ページネーション |
| `query().execute()` | `{ items, total, page, perPage, hasNext, hasPrev }` を返す |
| `query().executeOne()` | 最初の 1 件を返す |
| `query().adjacent(slug)` | 前後のコンテンツを返す（`{ prev, next }`） |

`DataSourceAdapter.query` を実装しているソースでは、`where()` 未使用時に限り Notion API へクエリを委譲する（push-down）。

## 画像配信

| メソッド | 戻り値 | 説明 |
|---|---|---|
| `getCachedImage(hash)` | `Promise<StorageBinary \| null>` | ハッシュキーで画像バイナリを取得 |
| `createCachedImageResponse(hash)` | `Promise<Response \| null>` | ハッシュキーで `Response` を生成。`cache-control: public, max-age=31536000, immutable` を付与 |
| `getStaticSlugs()` | `Promise<string[]>` | 静的生成用のスラッグ一覧 |

## `createCMS()` オプション

```ts
createCMS<T>({
  source,         // DataSourceAdapter<T> — 必須
  renderer?,      // RendererFn — 未指定時は @notion-headless-cms/renderer を動的 import
  cache?,         // CacheConfig<T>
  schema?,        // SchemaConfig<T> — publishedStatuses / accessibleStatuses など
  content?,       // ContentConfig — imageProxyBase / remarkPlugins / rehypePlugins / render
  waitUntil?,     // (p: Promise<unknown>) => void — Cloudflare Workers 用
  hooks?,         // CMSHooks<T>
  plugins?,       // CMSPlugin<T>[]
  logger?,        // Logger
  rateLimiter?,   // { maxConcurrent?, retryOn?, maxRetries?, baseDelayMs? }
});
```

### `CacheConfig<T>`

```ts
type CacheConfig<T> =
  | "disabled"
  | {
      document?: DocumentCacheAdapter<T>;
      image?: ImageCacheAdapter;
      ttlMs?: number; // 未指定時は TTL なし（常にフレッシュと判定）
    };
```

- `"disabled"` を渡すと `document` / `image` 双方が noop アダプタになる
- オブジェクト形式で `document` だけ指定することもできる（`image` は noop にフォールバック）

### `RateLimiterConfig`

| プロパティ | 型 | デフォルト |
|---|---|---|
| `maxConcurrent` | `number` | `3` |
| `retryOn` | `number[]` | `[429, 502, 503]` |
| `maxRetries` | `number` | `4` |
| `baseDelayMs` | `number` | `1000` |

## ライフサイクルフック

`createCMS({ hooks })` または `plugins` 経由で注入する。観測フック（`onCache*` / `onRender*`）は例外を投げても他のフックに波及しない（`logger.error` に流される）。

| フック | シグネチャ | 呼び出しタイミング |
|---|---|---|
| `beforeCache` | `(item: CachedItem<T>) => MaybePromise<CachedItem<T>>` | キャッシュに書き込む前（結果を差し替え可能） |
| `afterRender` | `(html: string, item: T) => MaybePromise<string>` | HTML 生成直後（文字列を差し替え可能） |
| `onCacheHit` | `(slug: string, item: CachedItem<T>) => void` | アイテムキャッシュヒット時 |
| `onCacheMiss` | `(slug: string) => void` | アイテムキャッシュミス時 |
| `onListCacheHit` | `(items: T[], cachedAt: number) => void` | 一覧キャッシュヒット時 |
| `onListCacheMiss` | `() => void` | 一覧キャッシュミス時 |
| `onRenderStart` | `(slug: string) => void` | `render` / `buildCachedItem` 開始時 |
| `onRenderEnd` | `(slug: string, durationMs: number) => void` | レンダリング完了時（所要時間付き） |
| `onError` | `(error: Error) => void` | 内部エラー通知 |

```ts
createCMS({
  source,
  hooks: {
    onRenderStart: (slug) => console.time(`render:${slug}`),
    onRenderEnd: (slug, ms) => console.log(`render:${slug} ${ms}ms`),
    onCacheHit: (slug) => metrics.increment("cache.hit", { slug }),
  },
});
```

## エラーハンドリング

すべての内部エラーは `CMSError` に統一される（`code` / `message` / `cause` / `context` を保持）。

```ts
import { CMSError, isCMSError, isCMSErrorInNamespace } from "@notion-headless-cms/core";

try {
  await cms.list();
} catch (err) {
  if (isCMSErrorInNamespace(err, "source/")) {
    // Notion 取得系エラー
    console.error(err.code, err.context);
  } else if (isCMSError(err)) {
    console.error(err.code, err.message);
  } else {
    throw err;
  }
}
```

組み込みエラーコード:

| コード | 発生箇所 |
|---|---|
| `core/config_invalid` | 必須設定の欠落（例: `NOTION_TOKEN` 未設定） |
| `core/schema_invalid` | Zod / スキーマ検証失敗 |
| `source/fetch_items_failed` | `list()` の Notion 取得失敗 |
| `source/fetch_item_failed` | `find()` の Notion 取得失敗 |
| `source/load_markdown_failed` | ブロック → Markdown 変換失敗 |
| `cache/io_failed` | キャッシュ R/W 失敗・画像 fetch 失敗 |
| `renderer/failed` | Markdown → HTML レンダリング失敗 |

サードパーティアダプタは任意の `namespace/kind` 文字列をコードに使える（`CMSErrorCode = BuiltInCMSErrorCode | (string & {})`）。

## サブパスエクスポート

`core` は以下のサブパスを公開しており、バレルを経由せず必要な型だけをインポートできる。ツリーシェイク・バンドルサイズ最適化に有用。

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core` | 全エクスポート（`createCMS` / `CMS` / フック関連など） |
| `@notion-headless-cms/core/errors` | `CMSError` / `isCMSError` / `isCMSErrorInNamespace` / `CMSErrorCode` |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryDocumentCache` / `memoryImageCache` / 各 `*Options` |

```ts
import { CMSError } from "@notion-headless-cms/core/errors";
import { memoryDocumentCache } from "@notion-headless-cms/core/cache/memory";
```
