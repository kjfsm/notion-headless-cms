# @notion-headless-cms/core

CMS エンジン本体。`createCMS` を提供し、SWR / 更新検知 / フック /
リトライ / Web Standard Route Handler を内蔵する。**外部ランタイム依存ゼロ**。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

`core` 自体は依存ゼロだが、実際に Notion を叩くには `notion-orm`、
HTML 化には `renderer` が必要。CLI 生成物 (`nhc-schema.ts`) が
notion-orm を自動参照する。

## 基本形

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({ ttlMs: 5 * 60_000 }),
  dataSources: cmsDataSources,
});

const posts = await cms.posts.getList();
const post = await cms.posts.getItem("my-post");
if (post) console.log(await post.content.html());
```

## 公開 API

### `createCMS(opts)`
- `dataSources`: CLI が生成する `cmsDataSources` (必須)
- `cache?`: `CacheConfig | "disabled"`
- `renderer?`: `RendererFn` (未指定なら `@notion-headless-cms/renderer` を動的ロード)
- `content?`: `imageProxyBase` 等
- `waitUntil?`: Cloudflare Workers の `ctx.waitUntil`
- `hooks?` / `plugins?` / `logger?` / `rateLimiter?`

### `nodePreset(opts?)`
Node.js 向けプリセット。`{ cache: { document: memoryDocumentCache, image: memoryImageCache }, renderer }` を返す。
- `cache?`: `CacheConfig | "disabled"` — デフォルトは memory cache
- `ttlMs?`: SWR TTL (ミリ秒)
- `renderer?`: カスタム renderer

### `BaseContentItem` — 全コンテンツの基本型

CLI 生成の `createCMS` ラッパーで返される items は、スキーマで定義されたプロパティに加えて以下の自動フィールドを含む:

- `id: string` — Notion ページ ID
- `slug: string` — コレクション設定の `fields.slug` で指定したプロパティから抽出
- `title?: string | null` — Notion `title` 型プロパティ（自動検出）
- `updatedAt: string` — Notion ページの最終編集時刻（ISO-8601、キャッシュ更新判定に使用）
- `lastEditedTime?: string` — Notion の `page.last_edited_time` と同値。常にセットされるシステムフィールド（`updatedAt` と同じ値）
- `status?: string | null` — `fields.status` で指定したプロパティ
- `publishedAt?: string | null` — `fields.publishedAt` で指定したプロパティ

### `cms.<collection>` の主なメソッド
- `getItem(slug)` — 本文込みで単件取得 (SWR)。返り値は `T & { content: { blocks, html(), markdown() } }`
- `getList(opts?)` — 公開済み一覧 (本文なし)
- `getStaticParams()` / `getStaticPaths()` — SSG 用
- `adjacent(slug, opts?)` — 前後記事ナビゲーション
- `revalidate(scope?)` / `prefetch(opts?)` — コレクション別キャッシュ操作

### グローバル操作
- `cms.$collections` — コレクション名一覧
- `cms.$revalidate(scope?)` — `"all" | { collection } | { collection, slug }`
- `cms.$handler(opts?)` — Web Standard `(req) => Response` を返す (画像プロキシ + webhook)
- `cms.$getCachedImage(hash)` — 画像キャッシュ直アクセス
- `cms.cacheImage(url)` — Notion 画像 URL を `{imageProxyBase}/{sha256}` 形式に変換しキャッシュへ書き込む。画像キャッシュ未設定なら `undefined`。`@notion-headless-cms/react-renderer/server` の `resolveBlockImageUrls` などサーバー側で URL 書き換えに使う
- `cms.imageProxyBase` — 画像プロキシのベース URL (`createCMS({ imageProxyBase })`、デフォルト `/api/images`)

### cache アダプタ
- `memoryDocumentCache({ maxItems? })` — LRU 対応インメモリキャッシュ
- `memoryImageCache({ maxItems?, maxSizeBytes? })`
- `noopDocumentCache()` / `noopImageCache()`

### エラー
- `CMSError` / `isCMSError` / `isCMSErrorInNamespace(err, "core/")`
- 名前空間: `core/*` / `source/*` / `cache/*` / `renderer/*` / `cli/*`

## サブパスエクスポート

```ts
import { CMSError } from "@notion-headless-cms/core/errors";
import { memoryDocumentCache } from "@notion-headless-cms/core/cache/memory";
```

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core` | 全エクスポート |
| `@notion-headless-cms/core/errors` | `CMSError` / `isCMSError` / `isCMSErrorInNamespace` |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryDocumentCache` / `memoryImageCache` |
| `@notion-headless-cms/core/cache/noop` | `noopDocumentCache` / `noopImageCache` |

## ランタイム別レシピ

- [Node.js スクリプト](../../docs/recipes/nodejs-script.md)
- [Cloudflare Workers + R2 + KV](../../docs/recipes/cloudflare-workers.md) (`cloudflarePreset` は `cache-r2` パッケージ)
- [Next.js App Router](../../docs/recipes/nextjs-app-router.md)

## 詳細ドキュメント

- [クイックスタート](../../docs/quickstart.md)
- [CMS メソッド一覧](../../docs/api/cms-methods.md)
- [v0.2 → v0.3 移行ガイド](../../docs/migration/v0.3.md)
