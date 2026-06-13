---
title: CMS メソッド一覧
description: createClient で得られる cms API のリファレンス
category: APIリファレンス
order: 1
---

# CMS API リファレンス

`@notion-headless-cms/core` の `createClient()` が返す `CMSClient<C>` が公開する API の一覧。

## 全体像

```ts
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

const cms = createClient({
  sources: {
    notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }),
  },
  cache?: CacheAdapter[],
  swr?: { ttlMs?: number },
  renderer?: RendererFn,
});

// コレクション別
cms.posts.find(slug, opts?)
cms.posts.list(opts?)
cms.posts.params()
cms.posts.check(slug, currentVersion)
cms.posts.cache.adjacent(slug, opts?)
cms.posts.cache.invalidate(slug?)
cms.posts.cache.warm(opts?)

// グローバル
cms.collections
cms.invalidate(scope?)
cms.getCachedImage(hash)
cms.handler(opts?)
cms.cacheImage         // (url) => Promise<string> | undefined
cms.imageProxyBase     // string（createCMS では "/api/cms/images" に固定）
```

## `BaseContentItem` — 自動フィールド

`notionSource(schema)` 経由で返されるすべてのアイテムには、スキーマで定義したプロパティに加えて以下の自動フィールドが含まれます:

- `id: string` — Notion ページ ID
- `slug: string` — スキーマの `slug` フィールドから抽出
- `title?: string | null` — Notion `title` 型プロパティ（自動検出）
- `updatedAt: string` — Notion ページの最終編集時刻（ISO-8601、キャッシュ更新判定に使用）
- `lastEditedTime?: string` — Notion の `page.last_edited_time` と同値。常にセットされるシステムフィールド（`updatedAt` と同じ値）
- `status?: string | null` — スキーマの `status` フィールド
- `publishedAt?: string | null` — スキーマの `publishedAt` フィールド

## コレクション別メソッド (`CollectionClient<T>`)

### SWR (Stale-While-Revalidate) のキャッシュ挙動

`find()` / `list()` は SWR キャッシュ経由で動作する。挙動は以下のとおり:

| キャッシュ状態 | 挙動 |
|---|---|
| キャッシュなし | source から取得・キャッシュ書き込み・呼び出し側に返却（ブロッキング） |
| キャッシュあり / TTL 内 | キャッシュをそのまま返す（fetch なし） |
| キャッシュあり / **TTL 切れ** | **ブロッキングで source から再取得**しキャッシュを更新してから返す |

> 注: 一般的な SWR ライブラリは TTL 切れでも一旦 stale を返してバックグラウンド更新するが、本ライブラリは **TTL 切れは必ずブロッキングで再取得する**。これは「TTL を過ぎたデータは古いとみなして返さない」というユーザー要件に従う設計上の選択。古いデータを許容したい場合は `swr.ttlMs` を長めに設定する。

バックグラウンドの更新検知 (Webhook 受信時や `check()` 呼び出し時) は別経路で、こちらは fail-soft（バックグラウンドのエラーは `onError` フック / logger に記録されるが、リクエスト本体は失敗しない）。

`find(slug, { fresh: true })` を指定すると、キャッシュの有無 / TTL を問わずブロッキングで再取得し、本文キャッシュも破棄する。

### `find(slug, opts?)`

スラッグで単件取得。SWR キャッシュ経由で動作し、本文は `render()` メソッドで遅延取得する。

```ts
const post = await cms.posts.find("hello-world");
if (post) {
  console.log(post.slug, post.status);              // item のプロパティ
  console.log(await post.html());                   // HTML（遅延）
  console.log(await post.markdown());               // Markdown（遅延）
  console.log(await post.blocks());                 // ContentBlock[]（遅延）
  console.log(await post.notionBlocks());           // Notion API ブロックツリー（遅延、DataSource が対応している場合のみ）
}
```

返り値: `Promise<ItemWithContent<T> | null>`

`notionBlocks()` は `DataSource.loadNotionBlocks` を実装している場合のみ非 `undefined` を返す（`@notion-headless-cms/notion-orm` は対応済み）。`@notion-headless-cms/react-renderer` の `<NotionRenderer blocks={...} />` に渡すブロックツリーをキャッシュ経由で取得するために使う。core はゼロ依存のため型は `unknown[] | undefined` であり、低レベル `createClient` 経由で使う場合のみ利用側で `NotionBlock[]` へキャストする。`@notion-headless-cms/client` の `createCMS({ render: { content: "react" } })` 経由なら `NotionBlock[]` に型付け済みでキャスト不要。

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
  const html = await result.item.html();
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
const html = await result.item.html();
return Response.json({ stale: true, html, version: result.item.updatedAt });

// クライアント: マウント時に1回だけ更新チェック
useEffect(() => {
  fetch(`/api/posts/${slug}/check?v=${encodeURIComponent(version)}`)
    .then((res) => res.ok ? res.json() : null)
    .then((data) => { if (data?.stale) setHtml(data.html); })
    .catch((err) => console.warn("更新チェック失敗:", err));
}, []);
```

### `peekVersion(slug)`

KV **のみ**を読んで `{ notionUpdatedAt, cachedAt }` を返す。Notion API を叩かないため安価。
クライアント側ポーリングで「SWR バックグラウンド更新が完了したか」を確認するためのもの。

```ts
const version = await cms.posts.peekVersion("hello-world");
// => { notionUpdatedAt: "2024-01-01T00:00:00.000Z", cachedAt: 1704067200000 }
// => null (キャッシュ未作成の場合)
```

- キャッシュが存在しない場合は `null` を返す
- Notion API 呼び出しなし（KV 1 読み取りのみ）
- `NotionRevalidator` の `poll` オプションと組み合わせて使う

**Cloudflare Workers + React Router での使用例:**

```ts
// サーバー: /api/posts/:slug/check
export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const version = await cms.posts.peekVersion(params.slug ?? "");
  return Response.json(version);
}
```

```tsx
// クライアント: バックグラウンド更新完了後に自動再描画。
// collection と item を渡せば poll URL(/api/cms/versions/...) と version は自動導出される。
<NotionRevalidator poll={{ collection: "posts", item }} />
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
| `cms.collections` | 登録されたコレクション名の配列 |
| `cms.invalidate(scope?)` | 全体・コレクション単位・slug 単位のキャッシュ無効化 |
| `cms.getCachedImage(hash)` | 画像キャッシュから `{ data, contentType }` を取得 |
| `cms.handler(opts?)` | Web Standard な `(req: Request) => Promise<Response>` を返す |
| `cms.cacheImage` | `(url: string) => Promise<string>` または `undefined`。Notion 画像 URL を `{imageProxyBase}/{sha256}` 形式へ変換しキャッシュへ書き込む。画像キャッシュ未設定 (noop) の場合は `undefined` |
| `cms.imageProxyBase` | 画像プロキシのベース URL。**createCMS では `/api/cms/images` に固定**（`cms.handler()` の既定 `{basePath}/images` と一致し、`api.cms.$.ts` 1 枚で配信される）。低レベルに変えたい場合のみ `createClient({ imageProxyBase })`（既定 `/api/images`）を使う |

### `cms.cacheImage` の利用例

`@notion-headless-cms/react-renderer` で Notion 画像をプロキシ URL 経由で配信する場合、サーバー側で URL を事前に書き換える:

```ts
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";

const post = await cms.posts.find(slug);
const notionBlocks = await post.notionBlocks();
const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);
// <NotionRenderer blocks={blocks} /> へ渡す
```

### `handler` のルート

`basePath` (デフォルト `/api/cms`) 以下に以下のルートをマウント:

- `GET {basePath}/images/:hash` — 画像プロキシ
- `GET {basePath}/versions/:collection/:slug` — `peekVersion()`（更新検知ポーリング用、KV メタのみ）。未登録は `200` + `null`、未知コレクションは `404`
- `GET|POST {basePath}/check/:collection/:slug?v={version}` — `check()`（Notion を実照会し差分があればキャッシュ更新）。`{ stale }` を返す。未存在は `404`、未知コレクションは `404`
- `POST {basePath}/revalidate` — Webhook 受信 → `invalidate(scope)`

`NotionRevalidator` の `poll` は `collection` と `item`（または `slug`）を渡すだけでよい。URL は
versions ルートの規約 `${basePath}/versions/${collection}/${slug}`（basePath 既定 `/api/cms`）から、
`version` は `item.lastEditedTime` から自動導出される（専用ルートの自前実装も URL 文字列の手書きも不要）:

```tsx
// item から slug と version を、collection から URL を導出
<NotionRevalidator poll={{ collection: "posts", item }} />

// 個別指定や別マウント先（basePath）も可能
<NotionRevalidator poll={{ collection: "posts", slug, version, basePath: "/api/notion" }} />
// url を直接渡す従来形も引き続き有効
<NotionRevalidator poll={{ url: `/api/cms/versions/posts/${slug}`, version }} />
```

```ts
// Hono
const handler = cms.handler({ basePath: "/api/cms", webhookSecret: env.SECRET });
app.all("/api/cms/*", (c) => handler(c.req.raw));

// Next.js App Router の場合は adapter-next の createNextHandler を使う
import { createNextHandler } from "@notion-headless-cms/client/next";
export const { GET, POST } = createNextHandler(cms, { webhookSecret: process.env.SECRET });
```

### `InvalidateScope`

```ts
type InvalidateScope =
  | "all"
  | { collection: string; kind?: "all" | "meta" | "content" }
  | { collection: string; slug: string; kind?: "all" | "meta" | "content" };
```

## `createClient()` オプション

```ts
import { createClient } from "@notion-headless-cms/core";

const cms = createClient({
  // sources（推奨）— アダプターパッケージ経由で型安全に追加
  sources?: {
    notion?: CMSAdapter,       // @notion-headless-cms/notion-source の notionSource()
    // 他のソースは module augmentation で追加される
  },
  // collections（低レベル）— DataSource<T> 実装を直接渡す
  collections?: {
    posts: {
      source: myDataSource,    // DataSource<T> の実装
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["公開済み"],
    },
  },
  cache?: CacheAdapter[],
  swr?: { ttlMs?: number },
  content?: ContentConfig,     // imageProxyBase, remarkPlugins, rehypePlugins
  renderer?: RendererFn,       // 未指定時は @notion-headless-cms/renderer を動的 import
  hooks?: CMSHooks,
  logger?: Logger,
  rateLimiter?: RateLimiterConfig,
  waitUntil?: (p: Promise<unknown>) => void,
});
```

`sources` と `collections` を両方指定した場合は `sources` が優先される（`sources` の `collections` がマージされ、トップレベルの `collections` は無視される）。

### `CMSAdapter` / `CMSSources` — 拡張ポイント

`@notion-headless-cms/core` は空の `CMSSources` インターフェースを公開し、各アダプターパッケージが宣言マージで `sources.<key>` を追加する。

```ts
// アダプター側
import type { CMSAdapter } from "@notion-headless-cms/core";

declare module "@notion-headless-cms/core" {
  interface CMSSources {
    contentful?: CMSAdapter;
  }
}

export function contentfulSource(opts: { ... }): CMSAdapter {
  return { collections: { ... } };
}
```

利用側は `import { contentfulSource } from "..."` するだけで `sources.contentful` キーが補完候補に現れる。

### `RateLimiterConfig`

| プロパティ | 型 | デフォルト |
|---|---|---|
| `maxConcurrent` | `number` | `3` |
| `retryOn` | `number[]` | `[429, 502, 503]` |
| `maxRetries` | `number` | `4` |
| `baseDelayMs` | `number` | `1000` |

## ライフサイクルフック

`createClient({ hooks })` で注入する。

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
import { isCMSErrorInNamespace, matchCMSError } from "@notion-headless-cms/core";
// または
import { isCMSError, isCMSErrorInNamespace, matchCMSError } from "@notion-headless-cms/core/errors";

// パターン 1: matchCMSError でエルゴノミックに処理
try {
  await cms.posts.find(slug);
} catch (err) {
  matchCMSError(err, {
    "source/fetch_item_failed": (e) => console.error("Notion 取得失敗:", e.message),
    "cache/io_failed": (e) => console.error("キャッシュ失敗:", e.message),
    _: (e) => { throw e; }, // その他は再 throw
  });
}

// パターン 2: インスタンスメソッドで判定
try {
  await cms.posts.find(slug);
} catch (err) {
  if (err instanceof CMSError) {
    if (err.inNamespace("source/")) {
      // Notion 取得系エラー
    } else if (err.is("cache/io_failed")) {
      // キャッシュ I/O エラー
    }
  }
}

// パターン 3: 従来の関数形式（後方互換）
try {
  await cms.posts.find(slug);
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
| `source/fetch_item_failed` | `find()` の Notion 取得失敗 |
| `source/load_markdown_failed` | ブロック → Markdown 変換失敗 |
| `cache/io_failed` | キャッシュ R/W 失敗 |
| `cache/image_fetch_failed` | 画像 fetch の HTTP エラー |
| `renderer/failed` | Markdown → HTML レンダリング失敗 |

## サブパスエクスポート

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core` | 全エクスポート |
| `@notion-headless-cms/core/errors` | `CMSError` / `isCMSError` / `isCMSErrorInNamespace` / `matchCMSError` |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryCache` |
| `@notion-headless-cms/core/cache/noop` | `noopDocOps` / `noopImgOps` |
