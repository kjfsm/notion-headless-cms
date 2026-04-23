# CMS API リファレンス

`@notion-headless-cms/core` の `createCMS()` が返す `CMSClient<D>` が公開する API の一覧。

## 全体像

```ts
const cms = createCMS({
  dataSources: { posts, authors, ... },
  cache?, content?, hooks?, plugins?, logger?, rateLimiter?, waitUntil?,
});

// コレクション別
cms.posts.getItem(slug)
cms.posts.getList(opts?)
cms.posts.getStaticParams()
cms.posts.getStaticPaths()
cms.posts.adjacent(slug, opts?)
cms.posts.revalidate(scope?)
cms.posts.prefetch(opts?)

// グローバル ($ プレフィックス)
cms.$collections
cms.$revalidate(scope?)
cms.$getCachedImage(hash)
cms.$handler(opts?)
```

## コレクション別メソッド (`CollectionClient<T>`)

### `getItem(slug)`

スラッグで単件取得。SWR キャッシュ経由で動作し、本文は `content` プロパティに同梱される。

```ts
const post = await cms.posts.getItem("hello-world");
if (post) {
  console.log(post.slug, post.status);            // item のプロパティ
  console.log(post.content.blocks);               // ContentBlock[] (常に同梱)
  console.log(await post.content.html());         // HTML (遅延)
  console.log(await post.content.markdown());     // Markdown (遅延)
}
```

返り値: `Promise<(T & { content: ContentResult }) | null>`

### `getList(opts?)`

公開済みアイテムの一覧を取得（本文なし、SWR キャッシュ経由）。

```ts
interface GetListOptions<T> {
  statuses?: string[];   // ステータス絞り込み
  where?: Partial<T>;    // プロパティ一致フィルタ
  tag?: string;          // タグ絞り込み (schema に tags フィールドがある場合)
  sort?: { by: keyof T & string; direction?: "asc" | "desc" };
  limit?: number;
  skip?: number;
}

const posts = await cms.posts.getList({ limit: 10 });
const featured = await cms.posts.getList({ tag: "featured" });
```

### `getStaticParams()` / `getStaticPaths()`

SSG のパス列挙用。

```ts
// Next.js App Router
export async function generateStaticParams() {
  return await cms.posts.getStaticParams();   // [{ slug: "a" }, { slug: "b" }]
}

// React Router / SvelteKit
const paths = await cms.posts.getStaticPaths();   // ["a", "b"]
```

### `adjacent(slug, opts?)`

前後記事を返す。

```ts
const { prev, next } = await cms.posts.adjacent("current-slug");
```

### `revalidate(scope?)` / `prefetch(opts?)`

キャッシュ無効化とプリフェッチ。

```ts
await cms.posts.revalidate();             // コレクション全体
await cms.posts.revalidate({ slug });     // 特定 slug のみ
await cms.posts.prefetch({ concurrency: 5, onProgress: (done, total) => {} });
```

## グローバル操作

| メソッド | 説明 |
|---|---|
| `cms.$collections` | 登録されたコレクション名の配列 |
| `cms.$revalidate(scope?)` | 全体・コレクション単位・slug 単位のキャッシュ無効化 |
| `cms.$getCachedImage(hash)` | 画像キャッシュから `{ data, contentType }` を取得 |
| `cms.$handler(opts?)` | Web Standard な `(req: Request) => Promise<Response>` を返す |

### `$handler` のルート

`basePath` (デフォルト `/api/cms`) 以下に以下のルートをマウント:

- `GET {basePath}/images/:hash` — 画像プロキシ
- `POST {basePath}/revalidate` — Webhook 受信 → `$revalidate(scope)`

```ts
// Next.js App Router
// app/api/cms/[[...slug]]/route.ts
const handler = cms.$handler({
  basePath: "/api/cms",
  webhookSecret: process.env.REVALIDATE_SECRET,
});
export const GET = handler;
export const POST = handler;

// Hono
app.all("/api/cms/*", (c) => cms.$handler({ basePath: "/api/cms" })(c.req.raw));
```

### `InvalidateScope`

```ts
type InvalidateScope =
  | "all"
  | { collection: string }
  | { collection: string; slug: string };
```

## `createCMS()` オプション

```ts
interface CreateCMSOptions<D> {
  dataSources: D;                                        // 必須
  cache?: CacheConfig;                                   // "disabled" | { document?, image?, ttlMs? }
  content?: ContentConfig;                               // imageProxyBase, remarkPlugins, rehypePlugins
  renderer?: RendererFn;                                 // 未指定時は @notion-headless-cms/renderer を動的 import
  hooks?: CMSHooks;
  plugins?: CMSPlugin[];
  logger?: Logger;
  rateLimiter?: RateLimiterConfig;
  waitUntil?: (p: Promise<unknown>) => void;
}
```

### `CacheConfig`

```ts
type CacheConfig =
  | "disabled"
  | {
      document?: DocumentCacheAdapter;
      image?: ImageCacheAdapter;
      ttlMs?: number; // 未指定時は TTL なし（常にフレッシュと判定）
    };
```

### `RateLimiterConfig`

| プロパティ | 型 | デフォルト |
|---|---|---|
| `maxConcurrent` | `number` | `3` |
| `retryOn` | `number[]` | `[429, 502, 503]` |
| `maxRetries` | `number` | `4` |
| `baseDelayMs` | `number` | `1000` |

## `ContentBlock` AST

```ts
type ContentBlock =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: "image"; src: string; alt?: string; cachedHash?: string }
  | { type: "code"; lang?: string; value: string }
  | { type: "list"; ordered: boolean; items: ContentBlock[][] }
  | { type: "quote"; children: ContentBlock[] }
  | { type: "divider" }
  | { type: "raw"; html: string };   // 対応不可なブロックのフォールバック

type InlineNode =
  | { type: "text"; value: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { type: "link"; url: string; children: InlineNode[] }
  | { type: "break" };
```

## ライフサイクルフック

`createCMS({ hooks })` または `plugins` 経由で注入する。

| フック | シグネチャ | 呼び出しタイミング |
|---|---|---|
| `beforeCache` | `(item: CachedItem<T>) => MaybePromise<CachedItem<T>>` | キャッシュに書き込む前（結果を差し替え可能） |
| `afterRender` | `(html: string, item: T) => MaybePromise<string>` | HTML 生成直後（文字列を差し替え可能） |
| `onCacheHit` | `(slug: string, item: CachedItem<T>) => void` | アイテムキャッシュヒット時 |
| `onCacheMiss` | `(slug: string) => void` | アイテムキャッシュミス時 |
| `onListCacheHit` | `(items: T[], cachedAt: number) => void` | 一覧キャッシュヒット時 |
| `onListCacheMiss` | `() => void` | 一覧キャッシュミス時 |
| `onRenderStart` | `(slug: string) => void` | レンダリング開始時 |
| `onRenderEnd` | `(slug: string, durationMs: number) => void` | レンダリング完了時（所要時間付き） |
| `onError` | `(error: Error) => void` | 内部エラー通知 |

## エラーハンドリング

すべての内部エラーは `CMSError` に統一される:

```ts
import { CMSError, isCMSError, isCMSErrorInNamespace } from "@notion-headless-cms/core";

try {
  await cms.posts.getItem(slug);
} catch (err) {
  if (isCMSErrorInNamespace(err, "source/")) {
    // Notion 取得系エラー
  } else if (isCMSErrorInNamespace(err, "cache/")) {
    // キャッシュ I/O 系エラー
  }
}
```

組み込みエラーコード:

| コード | 発生箇所 |
|---|---|
| `core/config_invalid` | 必須設定の欠落 |
| `core/schema_invalid` | Zod / スキーマ検証失敗 |
| `source/fetch_items_failed` | `list()` の Notion 取得失敗 |
| `source/fetch_item_failed` | `findBySlug()` の Notion 取得失敗 |
| `source/load_markdown_failed` | ブロック → Markdown 変換失敗 |
| `cache/io_failed` | キャッシュ R/W 失敗 |
| `cache/image_fetch_failed` | 画像 fetch の HTTP エラー |
| `renderer/failed` | Markdown → HTML レンダリング失敗 |

## サブパスエクスポート

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core` | 全エクスポート |
| `@notion-headless-cms/core/errors` | `CMSError` / `isCMSError` / `isCMSErrorInNamespace` |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryDocumentCache` / `memoryImageCache` |
| `@notion-headless-cms/core/cache/noop` | `noopDocumentCache` / `noopImageCache` |
