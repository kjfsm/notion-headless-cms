# @notion-headless-cms/cache

`@notion-headless-cms/core` 向けのキャッシュアダプタ集。
メモリ・Cloudflare KV/R2・Next.js ISR に対応する。

## インストール

```bash
pnpm add @notion-headless-cms/cache @notion-headless-cms/core
```

### Cloudflare Workers で使う場合

```bash
pnpm add @notion-headless-cms/cache @notion-headless-cms/core
```

`kvCache` / `r2Cache` は Cloudflare Workers ランタイムで動作する。
バインディングを `wrangler.toml` に設定し、`env` 経由で渡す。

### Next.js で使う場合

`nextCache` は `next/cache` に依存するため、Next.js プロジェクトに追加する。

```bash
pnpm add @notion-headless-cms/cache @notion-headless-cms/core next
```

## サブパスエクスポート

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/cache` | `memoryCache` |
| `@notion-headless-cms/cache/cloudflare` | `kvCache`, `r2Cache`, `cloudflareCache` |
| `@notion-headless-cms/cache/next` | `nextCache` |

## 使い方

### メモリキャッシュ（Node.js など）

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { memoryCache } from "@notion-headless-cms/cache";
import { cmsDataSources } from "./generated/nhc-schema";

export const cms = createCMS({
  ...nodePreset(),
  dataSources: cmsDataSources,
});
```

`nodePreset()` はデフォルトで `memoryCache` を使用するため、明示的な指定は不要。
カスタム設定が必要な場合のみ `memoryCache({ maxSize: 200 })` を渡す。

### Cloudflare Workers（KV + R2）

```ts
// src/index.ts
import { createCMS } from "@notion-headless-cms/core";
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { cmsDataSources } from "./generated/nhc-schema";

export default {
  async fetch(request: Request, env: Env) {
    const cms = createCMS({
      cache: cloudflareCache({
        docCache: env.DOC_CACHE,   // KV namespace
        imgBucket: env.IMG_BUCKET, // R2 bucket
      }),
      dataSources: cmsDataSources,
    });
    // ...
  },
};
```

KV と R2 を個別に設定する場合:

```ts
import { kvCache, r2Cache } from "@notion-headless-cms/cache/cloudflare";

createCMS({
  cache: [
    kvCache({ namespace: env.DOC_CACHE }),
    r2Cache({ bucket: env.IMG_BUCKET }),
  ],
  // ...
});
```

### Next.js App Router

```ts
// app/lib/cms.ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache/next";
import { cmsDataSources } from "../generated/nhc-schema";

export const cms = createCMS({
  ...nodePreset({
    cache: {
      document: nextCache({ tags: ["posts"] }),
    },
  }),
  dataSources: cmsDataSources,
});
```

## API

### `memoryCache(opts?)`

LRU メモリキャッシュ。`handles: ["document", "image"]`。

| オプション | 型 | デフォルト | 説明 |
|---|---|---|---|
| `maxSize` | `number` | `100` | LRU の最大エントリ数 |

### `kvCache(opts)` — `./cloudflare`

Cloudflare KV を document キャッシュとして使うアダプタ。`handles: ["document"]`。

| オプション | 型 | 説明 |
|---|---|---|
| `namespace` | `KVNamespaceLike` | KV namespace バインディング |
| `prefix?` | `string` | キャッシュキーのプレフィックス（デフォルト: `''`） |

### `r2Cache(opts)` — `./cloudflare`

Cloudflare R2 を画像キャッシュとして使うアダプタ。既定では `handles: ["image"]`。

| オプション | 型 | 説明 |
|---|---|---|
| `bucket` | `R2BucketLike` | R2 バケットバインディング |
| `prefix?` | `string` | キャッシュキーのプレフィックス（デフォルト: `''`） |
| `doc?` | `boolean` | `true` にすると document も同じバケットに保存する |

### `cloudflareCache(bindings, opts?)` — `./cloudflare`

`kvCache` + `r2Cache` を組み合わせるショートカット。未設定の binding は省略される。

```ts
cloudflareCache({ docCache: env.DOC_CACHE, imgBucket: env.IMG_BUCKET })
// → [kvCache({ namespace: env.DOC_CACHE }), r2Cache({ bucket: env.IMG_BUCKET })]
```

### `nextCache(opts?)` — `./next`

Next.js `revalidateTag` を利用する document キャッシュアダプタ。`handles: ["document"]`。

| オプション | 型 | 説明 |
|---|---|---|
| `tags?` | `string[]` | `invalidate("all")` 時に `revalidateTag` される追加タグ |

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体・キャッシュインターフェース定義
- [`@notion-headless-cms/adapter-next`](../adapter-next) — Next.js App Router ルートハンドラ
