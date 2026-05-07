# @notion-headless-cms/core

CMS エンジン本体。`createClient` を提供し、SWR / 更新検知 / フック / リトライ / Web Standard Route Handler を内蔵する。**外部ランタイム依存ゼロ**。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-source \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

`core` 自体は依存ゼロ。実際に Notion を叩くには `@notion-headless-cms/notion-source`（内部で `notion-orm` / `renderer` を持つ）を追加する。CLI 生成物 (`nhc.schema.ts`) は型のみを参照する。

## 基本形

```ts
import { createClient, memoryCache } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: { publishedStatuses: ["公開済み"] },
      },
    }),
  },
  cache: [memoryCache()],
});

const posts = await cms.posts.list();
const post = await cms.posts.find("my-post");
if (post) console.log(await post.render());
```

## 公開 API

### `createClient(opts)`

| オプション | 説明 |
|---|---|
| `sources` | データソースアダプターのマップ（`{ notion: notionSource(...) }` 等）。複数ソースの `collections` は自動マージされる |
| `collections` | 直接 `CollectionDef` を渡す低レベル API（通常は `sources` を使う） |
| `cache` | `readonly CacheAdapter[]` — `memoryCache()` / `cloudflareCache(env)` 等を配列で指定 |
| `swr` | `{ ttlMs?: number }` — SWR の TTL。未指定だとキャッシュは期限なしで永続し、Notion の `lastEditedTime` 差分があれば bg で差し替え。指定するとブロッキング再取得が走る |
| `renderer` | `RendererFn` — 未指定なら `@notion-headless-cms/renderer` を動的ロード |
| `imageProxyBase` | 画像プロキシのベース URL（デフォルト `/api/images`） |
| `waitUntil` | Cloudflare Workers の `ctx.waitUntil` 相当 |
| `hooks` / `plugins` / `logger` / `logLevel` / `rateLimiter` / `content` | 高度な設定 |

### 拡張可能な `sources`

`@notion-headless-cms/core` は空の `CMSSources` インターフェースを公開し、各アダプターパッケージが宣言マージ（module augmentation）でキーを追加する仕組みになっている。Fastify プラグイン型拡張と同じパターン。

```ts
// アダプターパッケージ側
import type { CMSAdapter } from "@notion-headless-cms/core";

declare module "@notion-headless-cms/core" {
  interface CMSSources {
    contentful?: CMSAdapter;
  }
}
```

利用側は `import { contentfulSource } from "..."` するだけで `sources.contentful` キーが補完候補として現れる。

### `cms.<collection>` の主なメソッド

- `find(slug)` — 本文込みで単件取得（SWR）
- `list(opts?)` — 公開済み一覧（本文なし）
- `params()` — SSG 用 slug 一覧
- `cache.adjacent(slug, opts?)` — 前後記事ナビゲーション
- `cache.warm(opts?)` / `cache.invalidate(scope?)` / `cache.checkItem(...)` — キャッシュ管理

### グローバル操作

- `cms.collections` — 登録コレクション名一覧
- `cms.invalidate(scope?)` — `"all" | { collection } | { collection, slug }`
- `cms.handler(opts?)` — Web Standard `(req) => Response`（画像プロキシ + webhook）
- `cms.getCachedImage(hash)` — 画像キャッシュ直アクセス
- `cms.cacheImage(url)` — Notion 画像 URL を `{imageProxyBase}/{sha256}` 形式に変換し、永続キャッシュへ書き込む（画像キャッシュ未設定なら `undefined`）
- `cms.imageProxyBase` — 画像プロキシのベース URL

### `BaseContentItem`

CLI 生成物の各アイテム型は `BaseContentItem` を拡張する:

- `id: string` — Notion ページ ID
- `slug: string` — `slugField` で指定したプロパティから抽出
- `title?: string | null`
- `lastEditedTime: string` — Notion ページの最終編集時刻（変更検知に使用）
- `status?: string | null` — `statusField` で指定したプロパティ
- `publishedAt?: string` — 公開日時
- `coverImageUrl?: string | null` / `iconEmoji?: string | null` — Notion ページのカバー / アイコン

### キャッシュアダプタ

- `memoryCache({ maxItems? })` — インプロセス LRU
- `noopDocOps` / `noopImgOps` — キャッシュ無効化用
- 別パッケージ: `@notion-headless-cms/cache/cloudflare` の `cloudflarePreset({ env, ctx })` / `cloudflareCache(...)` / `r2Cache()` / `kvCache()`、`@notion-headless-cms/cache/next` の `nextCache()`

### エラー

- `CMSError` / `isCMSError` / `isCMSErrorInNamespace(err, "core/")` / `matchCMSError`
- 名前空間: `core/*` / `source/*` / `cache/*` / `renderer/*` / `cli/*`

## サブパスエクスポート

```ts
import { CMSError } from "@notion-headless-cms/core/errors";
import { memoryCache } from "@notion-headless-cms/core/cache/memory";
```

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core` | 全エクスポート |
| `@notion-headless-cms/core/errors` | `CMSError` / `isCMSError` / `isCMSErrorInNamespace` / `matchCMSError` |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryCache` |
| `@notion-headless-cms/core/cache/noop` | `noopDocOps` / `noopImgOps` |
| `@notion-headless-cms/core/html` | `notionRevalidatorScript` (Astro / Hono / Express など素 HTML 向け) |

## ランタイム別レシピ

- [Node.js スクリプト](../../docs/recipes/nodejs-script.md)
- [Cloudflare Workers + R2 + KV](../../docs/recipes/cloudflare-workers.md)
- [Next.js App Router](../../docs/recipes/nextjs-app-router.md)
- [カスタムデータソース](../../docs/recipes/custom-source.md)

## 詳細ドキュメント

- [クイックスタート](../../docs/quickstart.md)
- [CMS メソッド一覧](../../docs/api/cms-methods.md)
- [v2.0 移行ガイド](../../docs/migration/v2.0.md)
