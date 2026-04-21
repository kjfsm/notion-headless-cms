# @notion-headless-cms/cache-r2

Cloudflare R2 をバックエンドとするキャッシュアダプタ。
1 つのインスタンスで `DocumentCacheAdapter` と `ImageCacheAdapter` の両方を実装する。

## インストール

```bash
npm install @notion-headless-cms/cache-r2
```

Cloudflare Workers 環境では [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) が推移依存として含むため、直接インストールする必要はない。

## 使い方

```typescript
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";

export default {
  async fetch(request: Request, env: { CACHE_BUCKET: R2Bucket }) {
    const cache = r2Cache({ bucket: env.CACHE_BUCKET });

    const cms = createCMS({
      source: notionAdapter({
        token: env.NOTION_TOKEN,
        dataSourceId: env.NOTION_DATA_SOURCE_ID,
      }),
      renderer: renderMarkdown,
      cache: {
        document: cache,
        image: cache, // 同じインスタンスで両対応
        ttlMs: 5 * 60 * 1000,
      },
    });

    const { items } = await cms.cached.list();
    return Response.json(items);
  },
};
```

`bucket` が `undefined` の場合（例: `wrangler.toml` で R2 バインディングを設定していない）、`r2Cache` は `undefined` を返す。`createCMS` の `cache.document` / `cache.image` は undefined 許容のため、そのまま渡せばキャッシュなし動作にフォールバックする。

```typescript
const cache = r2Cache({ bucket: env.CACHE_BUCKET }); // 未バインド時は undefined

createCMS({
  source,
  renderer: renderMarkdown,
  cache: {
    document: cache,
    image: cache ?? memoryImageCache(),
  },
});
```

### プレフィックスの分離

同じバケットを別プロジェクトと共有する場合は `prefix` を指定する。

```typescript
r2Cache({ bucket: env.CACHE_BUCKET, prefix: "blog/" });
```

生成されるキー構造:

```
<prefix>content.json           # リストキャッシュ
<prefix>content/<slug>.json    # 個別アイテム
<prefix>images/<hash>          # 画像バイナリ
```

## API

### `r2Cache(opts)`

| オプション | 型 | 説明 |
|---|---|---|
| `bucket` | `R2BucketLike \| undefined` | R2 バケットバインディング。`undefined` の場合は `r2Cache` も `undefined` を返す |
| `prefix` | `string` | キャッシュキーのプレフィックス（デフォルト: `""`） |

戻り値は `DocumentCacheAdapter<T>` かつ `ImageCacheAdapter` を同時に満たすインスタンス。

### 型

- `R2BucketLike` — R2 バケットの構造的インターフェース。Cloudflare Workers の `R2Bucket` とそのまま互換で、`@cloudflare/workers-types` に直接依存しない。
- `R2ObjectLike` — R2 オブジェクトの構造的インターフェース（`json<T>()` / `arrayBuffer()` / `httpMetadata`）。

`R2BucketLike` を実装すれば Node.js のテストやモックでもそのまま使える。

```ts
import type { R2BucketLike } from "@notion-headless-cms/cache-r2";

const mock: R2BucketLike = {
  async get() { return null; },
  async put() { return undefined; },
};
```

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — `DocumentCacheAdapter` / `ImageCacheAdapter` の型定義
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Workers 向けファクトリ
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR 向けキャッシュ
