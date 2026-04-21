# @notion-headless-cms/cache-next

Next.js App Router 向けの `DocumentCacheAdapter`。`revalidateTag` を使ったタグベースのキャッシュ無効化をサポートする。実データのストレージは Next.js 内部のキャッシュ層（`fetch` の次世代キャッシュ / `unstable_cache` 等）が担う。

## インストール

```bash
npm install @notion-headless-cms/cache-next @notion-headless-cms/core
```

## 使い方

```ts
// lib/cms.ts
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache-next";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";

export const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  renderer: renderMarkdown,
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: nextCache({ revalidate: 300, tags: ["posts"] }),
    image: memoryImageCache(),
  },
});
```

`cms.cache.read.list()` / `cms.cache.read.get(slug)` は Next.js の fetch キャッシュ層と協調して再生成される。`nextCache` の `getItem` / `getList` は常に `null` を返す設計のため、実際の保存層は Next.js の `fetch` キャッシュ / `unstable_cache` が担うことに留意。

### キャッシュ無効化（Revalidate Webhook）

Notion 側の変更通知を受けて `cms.cache.manage.sync(payload)` を呼ぶと、`nextCache` の `invalidate` が走り `revalidateTag` が実行される。

- `"all"`: `tags` で指定した全タグに対して `revalidateTag` を呼ぶ
- `{ tag }`: 指定タグのみ再検証
- `{ slug }`: `slug:<slug>` タグを再検証

```ts
// app/api/revalidate/route.ts
import { cms } from "@/lib/cms";
import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET!,
});
```

スラッグ単位で無効化したい場合、個別ページの取得を `slug:<slug>` タグ付きで fetch しておく。

## API

### `nextCache(opts?)`

| オプション | 型 | 説明 |
|---|---|---|
| `revalidate` | `number` | ISR の再生成間隔（秒）。デフォルト: `300` |
| `tags` | `string[]` | `invalidate("all")` 時に `revalidateTag` を呼ぶタグ |

戻り値は `DocumentCacheAdapter<T>`。`getItem` / `getList` は常に `null` を返し、`setItem` / `setList` は no-op（実キャッシュは Next.js が管理）。

## 注意

`nextCache` は Next.js 13.4+ の App Router ランタイムで動作する。Pages Router や Edge Runtime の一部機能とは互換性がない場合がある。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/adapter-next`](../adapter-next) — 画像プロキシ・Webhook ルートハンドラ
- [`@notion-headless-cms/cache-r2`](../cache-r2) — Cloudflare R2 向けキャッシュ
