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
| `@notion-headless-cms/cache/cloudflare` | `kvCache`, `r2Cache`, `cloudflareCache`, `cloudflarePreset` |
| `@notion-headless-cms/cache/next` | `nextCache` |

## 使い方

### メモリキャッシュ（Node.js など）

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

export const cms = createClient({
  sources: {
    notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }),
  },
  cache: [memoryCache()],
});
```

カスタム設定が必要な場合は `memoryCache({ maxSize: 200 })` を渡す。

### Cloudflare Workers（KV + R2）

`cloudflarePreset({ env, ctx })` を `createClient` に展開すると、KV + R2 のキャッシュアダプタと `waitUntil`（SWR バックグラウンド更新を Workers のレスポンス送信後も完走させるための関数）が一括で配線される。

```ts
// src/index.ts
import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cms = createClient({
      sources: {
        notion: notionSource({ schema, token: env.NOTION_TOKEN }),
      },
      ...cloudflarePreset({ env, ctx }),
    });
    // ...
  },
};
```

`ctx.waitUntil` が未配線だと、SWR の差分検知がレスポンス送信後に Workers ランタイムにより打ち切られ、KV キャッシュが古いまま残るため、**`ctx` を渡すこと**が重要。

個別に設定したい場合は低レベル API を使う:

```ts
import {
  cloudflareCache,
  kvCache,
  r2Cache,
} from "@notion-headless-cms/cache/cloudflare";

createClient({
  sources: { notion: notionSource({ schema, token: env.NOTION_TOKEN }) },
  // KV + R2 のショートカット
  cache: cloudflareCache({
    docCache: env.DOC_CACHE,
    imgBucket: env.IMG_BUCKET,
  }),
  // または個別:
  // cache: [
  //   kvCache({ namespace: env.DOC_CACHE }),
  //   r2Cache({ bucket: env.IMG_BUCKET }),
  // ],
  waitUntil: (p) => ctx.waitUntil(p),
});
```

### Next.js App Router

```ts
// app/lib/cms.ts
import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "@/app/generated/nhc.schema";

export const cms = createClient({
  sources: {
    notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }),
  },
  cache: [nextCache({ tags: ["posts"] }), memoryCache()],
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

| オプション | 型 | 説明 |
|---|---|---|
| `prefix?` | `string` | キャッシュキーのプレフィックス |

### `cloudflarePreset(opts)` — `./cloudflare`

`createClient` に展開する Cloudflare Workers 向けのショートカット。`cache`（`cloudflareCache` 相当）と `waitUntil`（`ctx.waitUntil` を bind したもの）を返す。

```ts
createClient({
  sources: { notion: notionSource({ schema, token: env.NOTION_TOKEN }) },
  ...cloudflarePreset({ env, ctx }),
});
```

| オプション | 型 | 説明 |
|---|---|---|
| `env` | `{ DOC_CACHE?, IMG_BUCKET? }` | Workers env binding |
| `ctx?` | `{ waitUntil(p): void }` | Workers ExecutionContext。SWR bg を完走させるために渡す |
| `prefix?` | `string` | キャッシュキーのプレフィックス |

### `nextCache(opts?)` — `./next`

Next.js `revalidateTag` を利用する document キャッシュアダプタ。`handles: ["document"]`。

| オプション | 型 | 説明 |
|---|---|---|
| `tags?` | `string[]` | `invalidate("all")` 時に `revalidateTag` される追加タグ |

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体・キャッシュインターフェース定義
- [`@notion-headless-cms/adapter-next`](../adapter-next) — Next.js App Router ルートハンドラ
