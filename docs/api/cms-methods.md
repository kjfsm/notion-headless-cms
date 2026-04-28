# CMS API リファレンス

`@notion-headless-cms/core` の `createCMS()` が返す `CMSClient<C>` が公開する API の一覧。

## 全体像

```ts
// nhc generate が生成した createCMS ラッパーを使う
import { createCMS } from "./generated/nhc";

const cms = createCMS({
  notionToken: "...",
  cache?: CacheAdapter | CacheAdapter[],
  ttlMs?: number,
  renderer?: RendererFn,
});

// コレクション別
cms.posts.get(slug, opts?)
cms.posts.list(opts?)
cms.posts.params()
cms.posts.check(slug, currentVersion)
cms.posts.cache.adjacent(slug, opts?)
cms.posts.cache.invalidate(slug?)
cms.posts.cache.warm(opts?)

// グローバル ($ プレフィックス)
cms.$collections
cms.$invalidate(scope?)
cms.$getCachedImage(hash)
cms.$handler(opts?)
```

## `BaseContentItem` — 自動フィールド

CLI 生成の `createCMS` ラッパーで返されるすべてのアイテムには、スキーマで定義したプロパティに加えて以下の自動フィールドが含まれます:

- `id: string` — Notion ページ ID
- `slug: string` — スキーマの `slug` フィールドから抽出
- `title?: string | null` — Notion `title` 型プロパティ（自動検出）
- `updatedAt: string` — Notion ページの最終編集時刻（ISO-8601、キャッシュ更新判定に使用）
- `lastEditedTime?: string` — Notion の `page.last_edited_time` と同値。常にセットされるシステムフィールド（`updatedAt` と同じ値）
- `status?: string | null` — スキーマの `status` フィールド
- `publishedAt?: string | null` — スキーマの `publishedAt` フィールド

## コレクション別メソッド (`CollectionClient<T>`)

### `get(slug, opts?)`

スラッグで単件取得。SWR キャッシュ経由で動作し、本文は `render()` メソッドで遅延取得する。

```ts
const post = await cms.posts.get("hello-world");
if (post) {
  console.log(post.slug, post.status);              // item のプロパティ
  console.log(await post.render());                 // HTML（遅延）
  console.log(await post.render({ format: "markdown" })); // Markdown（遅延）
}
```

返り値: `Promise<(T & { render(opts?) => Promise<string> }) | null>`

`opts.fresh === true` を渡すと TTL に関わらずブロッキングで再取得し、本文キャッシュも破棄する。

### `list(opts?)`

公開済みアイテムの一覧を取得（本文なし、SWR キャッシュ経由）。

```ts
interface ListOptions<T> {
  status?: string | readonly string[];  // ステータス絞り込み
  where?: Partial<Record<keyof T, unknown>>;  // プロパティ一致フィルタ
  tag?: string;   // タグ絞り込み (schema に tags フィールドがある場合)
  sort?: { by: keyof T & string; dir?: "asc" | "desc" };
  limit?: number;
  skip?: number;
}

const posts = await cms.posts.list({ limit: 10 });
const featured = await cms.posts.list({ tag: "featured" });
```

### `params()`

SSG のパス列挙用。Next.js App Router の `generateStaticParams` に渡せる形式で返す。

```ts
// Next.js App Router
export async function generateStaticParams() {
  return await cms.posts.params();   // [{ slug: "a" }, { slug: "b" }]
}
```

### `check(slug, currentVersion)`

Notion から最新版を取得し、`currentVersion`（`item.updatedAt`）と比較する。
差分があればキャッシュを更新してアイテムを返す。**ページ表示後の1回限りのクライアント再検証**に使う。

```ts
type CheckResult<T> =
  | { stale: false }
  | { stale: true; item: T & { render(): Promise<string> } };

const result = await cms.posts.check(slug, currentVersion);

if (result === null) {
  // アイテムが存在しない
} else if (!result.stale) {
  // 変更なし
} else {
  // 更新あり: result.item で新しいアイテムにアクセスできる
  const html = await result.item.render();
}
```

- `currentVersion` は `post.updatedAt` を渡す
- 差分なし(`stale: false`)のときはキャッシュに触れないため副作用がない
- 差分あり(`stale: true`)のときはメタを更新しコンテンツキャッシュを無効化する
- アイテムが存在しない場合は `null` を返す

**Cloudflare Workers + React Router での使用例:**

```ts
// サーバー: /api/posts/:slug/check?v={version}
const result = await cms.posts.check(slug, clientVersion);
if (result === null) return new Response("Not Found", { status: 404 });
if (!result.stale) return Response.json({ stale: false });
const html = await result.item.render();
return Response.json({ stale: true, html, version: result.item.updatedAt });

// クライアント: マウント時に1回だけ更新チェック
useEffect(() => {
  fetch(`/api/posts/${slug}/check?v=${encodeURIComponent(version)}`)
    .then((res) => res.ok ? res.json() : null)
    .then((data) => { if (data?.stale) setHtml(data.html); })
    .catch((err) => console.warn("更新チェック失敗:", err));
}, []);
```

## コレクション別キャッシュ操作 (`CollectionCacheOps<T>`)

`cms.posts.cache` で取得できるキャッシュ操作 namespace。

### `cache.adjacent(slug, opts?)`

前後記事を返す（リスト順序ベース）。

```ts
const { prev, next } = await cms.posts.cache.adjacent("current-slug");
```

### `cache.invalidate(slug?)`

キャッシュを無効化する。次回 `get` / `list` で source から再取得される。

```ts
await cms.posts.cache.invalidate();        // コレクション全体
await cms.posts.cache.invalidate("slug");  // 特定 slug のみ
```

### `cache.warm(opts?)`

全アイテムを並列に事前取得・レンダリングしてキャッシュに格納する。SSG ビルド前のウォームアップに使う。

```ts
const { ok, failed } = await cms.posts.cache.warm({
  concurrency: 5,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
```

## グローバル操作

| メソッド | 説明 |
|---|---|
| `cms.$collections` | 登録されたコレクション名の配列 |
| `cms.$invalidate(scope?)` | 全体・コレクション単位・slug 単位のキャッシュ無効化 |
| `cms.$getCachedImage(hash)` | 画像キャッシュから `{ data, contentType }` を取得 |
| `cms.$handler(opts?)` | Web Standard な `(req: Request) => Promise<Response>` を返す |

### `$handler` のルート

`basePath` (デフォルト `/api/cms`) 以下に以下のルートをマウント:

- `GET {basePath}/images/:hash` — 画像プロキシ
- `POST {basePath}/revalidate` — Webhook 受信 → `$invalidate(scope)`

```ts
// Hono
const handler = cms.$handler({ basePath: "/api/cms", webhookSecret: env.SECRET });
app.all("/api/cms/*", (c) => handler(c.req.raw));

// Next.js App Router の場合は adapter-next が簡便なラッパーを提供
// → createImageRouteHandler / createRevalidateRouteHandler を参照
```

### `InvalidateScope`

```ts
type InvalidateScope =
  | "all"
  | { collection: string; kind?: "all" | "meta" | "content" }
  | { collection: string; slug: string; kind?: "all" | "meta" | "content" };
```

## `createCMS()` オプション（低レベル）

CLI 生成の `createCMS` ラッパーを使わず、直接 core の `createCMS` を呼ぶ場合のオプション。

```ts
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  collections: {
    posts: {
      source: myDataSource,    // DataSource<T> の実装
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["公開済み"],
    },
  },
  cache?: CacheAdapter | CacheAdapter[],
  content?: ContentConfig,     // imageProxyBase, remarkPlugins, rehypePlugins
  renderer?: RendererFn,       // 未指定時は @notion-headless-cms/renderer を動的 import
  hooks?: CMSHooks,
  logger?: Logger,
  rateLimiter?: RateLimiterConfig,
  waitUntil?: (p: Promise<unknown>) => void,
});
```

### `RateLimiterConfig`

| プロパティ | 型 | デフォルト |
|---|---|---|
| `maxConcurrent` | `number` | `3` |
| `retryOn` | `number[]` | `[429, 502, 503]` |
| `maxRetries` | `number` | `4` |
| `baseDelayMs` | `number` | `1000` |

## ライフサイクルフック

`createCMS({ hooks })` で注入する。

| フック | シグネチャ | 呼び出しタイミング |
|---|---|---|
| `beforeCache` | `(item: CachedItemMeta<T>) => MaybePromise<CachedItemMeta<T>>` | キャッシュに書き込む前 |
| `afterRender` | `(html: string, item: T) => MaybePromise<string>` | HTML 生成直後（文字列を差し替え可能） |
| `onCacheHit` | `(slug: string, item: CachedItemMeta<T>) => void` | アイテムキャッシュヒット時 |
| `onCacheMiss` | `(slug: string) => void` | アイテムキャッシュミス時 |
| `onRenderStart` | `(slug: string) => void` | レンダリング開始時 |
| `onRenderEnd` | `(slug: string, durationMs: number) => void` | レンダリング完了時 |
| `onError` | `(error: Error) => void` | 内部エラー通知 |

## エラーハンドリング

すべての内部エラーは `CMSError` に統一される:

```ts
import { isCMSErrorInNamespace } from "@notion-headless-cms/core";
// または
import { isCMSError, isCMSErrorInNamespace } from "@notion-headless-cms/core/errors";

try {
  await cms.posts.get(slug);
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
| `source/fetch_items_failed` | `list()` の Notion 取得失敗 |
| `source/fetch_item_failed` | `get()` の Notion 取得失敗 |
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
| `@notion-headless-cms/core/cache/memory` | `memoryCache` |
| `@notion-headless-cms/core/cache/noop` | `noopDocOps` / `noopImgOps` |
