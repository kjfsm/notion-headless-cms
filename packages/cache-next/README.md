# @notion-headless-cms/cache-next

Next.js App Router 向けの `DocumentCacheAdapter`。`revalidateTag` を
使った規約タグベースのキャッシュ無効化をサポートする。実データの
ストレージは Next.js 内部のキャッシュ層 (`fetch` の次世代キャッシュ /
`unstable_cache` 等) が担う。

## インストール

```bash
pnpm add @notion-headless-cms/cache-next @notion-headless-cms/core
```

## 使い方

```ts
// app/lib/cms.ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache-next";
import { cmsDataSources } from "../generated/nhc-schema";

export const cms = createCMS({
  ...nodePreset({
    cache: {
      document: nextCache({ revalidate: 300, tags: ["posts"] }),
    },
    ttlMs: 5 * 60_000,
  }),
  dataSources: cmsDataSources,
});
```

## `invalidate` の規約タグ

v0.3 から cache-next は以下の規約タグで `revalidateTag` を呼ぶ:

- `cms.$revalidate({ collection: "posts" })` → `nhc:col:posts`
- `cms.$revalidate({ collection: "posts", slug: "abc" })` → `nhc:col:posts` と `nhc:col:posts:slug:abc`
- `cms.$revalidate("all")` → `nextCache({ tags })` で指定したユーザー定義タグ全て

Next.js 側で `fetch` / `unstable_cache` に同じ規約タグを付与すると、
該当コレクション / slug だけを再生成できる。

### Revalidate Webhook

```ts
// app/api/revalidate/route.ts
import { cms } from "@/lib/cms";
import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET!,
});
```

`cms.$handler()` 経由でも同じ。

## API

### `nextCache(opts?)`

| オプション | 型 | 説明 |
|---|---|---|
| `revalidate` | `number` | ISR の再生成間隔（秒）。デフォルト: 300 |
| `tags` | `string[]` | `invalidate("all")` 時に revalidateTag するユーザー定義タグ |

戻り値は `DocumentCacheAdapter<T>`。`getItem` / `getList` は常に `null` を返し、`setItem` / `setList` は no-op（実キャッシュは Next.js が管理）。

## 注意

`nextCache` は Next.js 13.4+ の App Router ランタイムで動作する。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core)
- [`@notion-headless-cms/adapter-next`](../adapter-next) — 画像プロキシ・Webhook ルートハンドラ
- [`@notion-headless-cms/cache-r2`](../cache-r2) — Cloudflare R2 + `cloudflarePreset`
