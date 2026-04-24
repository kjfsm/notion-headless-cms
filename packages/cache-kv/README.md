# @notion-headless-cms/cache-kv

Cloudflare KV をバックエンドとするドキュメントキャッシュアダプタ。`DocumentCacheAdapter` を実装し、テキスト（JSON）のコンテンツをキャッシュする。

## インストール

```bash
npm install @notion-headless-cms/cache-kv
```

Cloudflare Workers では `@notion-headless-cms/cache-r2` の `cloudflarePreset`
を使うと KV と R2 を自動注入できる。`cache-r2` が `cache-kv` を推移依存として
含むため、`cloudflarePreset` を使うなら個別インストール不要。

## 使い方

```typescript
import { createCMS } from "@notion-headless-cms/core";
import { kvCache } from "@notion-headless-cms/cache-kv";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import { renderMarkdown } from "@notion-headless-cms/renderer";

export default {
  async fetch(request: Request, env: {
    CACHE_KV: KVNamespace;
    CACHE_BUCKET: R2Bucket;
  }) {
    const cms = createCMS({
      dataSources: cmsDataSources,
      renderer: renderMarkdown,
      cache: {
        document: kvCache({ kv: env.CACHE_KV }),  // テキストは KV
        image: r2Cache({ bucket: env.CACHE_BUCKET }),  // 画像は R2
        ttlMs: 5 * 60 * 1000,
      },
    });

    const items = await cms.posts.getList();
    return Response.json(items);
  },
};
```

`kv` が `undefined` の場合、`kvCache` は `undefined` を返す（キャッシュなしフォールバック用）。

### プレフィックスの分離

同じ KV namespace を別プロジェクトと共有する場合は `prefix` を指定する。

```typescript
kvCache({ kv: env.CACHE_KV, prefix: "blog/" });
```

生成されるキー構造:

```
<prefix>content           # リストキャッシュ
<prefix>content:<slug>    # 個別アイテム
```

## API

### `kvCache(opts)`

| オプション | 型 | 説明 |
|---|---|---|
| `kv` | `KVNamespaceLike \| undefined` | KV namespace バインディング。`undefined` の場合は `kvCache` も `undefined` を返す |
| `prefix` | `string` | キャッシュキーのプレフィックス（デフォルト: `""`） |

戻り値は `DocumentCacheAdapter<T>` を満たすインスタンス。

### 型

- `KVNamespaceLike` — KV namespace の構造的インターフェース。Cloudflare Workers の `KVNamespace` とそのまま互換で、`@cloudflare/workers-types` に直接依存しない。

```ts
import type { KVNamespaceLike } from "@notion-headless-cms/cache-kv";

const mock: KVNamespaceLike = {
  async get() { return null; },
  async put() {},
};
```

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — `DocumentCacheAdapter` の型定義
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 画像キャッシュ
- [`@notion-headless-cms/cache-r2`](../cache-r2) — `cloudflarePreset` で KV + R2 を自動注入
