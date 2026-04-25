# @notion-headless-cms/cache-r2

Cloudflare R2 をバックエンドとするキャッシュアダプタ + Workers 向けプリセット。
1 つの `r2Cache` インスタンスで `DocumentCacheAdapter` と `ImageCacheAdapter`
の両方を実装する。`cloudflarePreset` は env binding を自動解決する便利ヘルパー。

## インストール

```bash
pnpm add @notion-headless-cms/cache-r2 @notion-headless-cms/core
```

## 使い方: `cloudflarePreset` (推奨)

```ts
import { createCMS } from "@notion-headless-cms/core";
import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
import { cmsDataSources } from "./generated/nhc-schema";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const cms = createCMS({
      ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }),
      dataSources: cmsDataSources,
      waitUntil: ctx.waitUntil.bind(ctx),
    });
    const posts = await cms.posts.getList();
    return Response.json(posts);
  },
};
```

### 既定の binding 名

- `DOC_CACHE` — KV namespace (ドキュメントキャッシュ)
- `IMG_BUCKET` — R2 バケット (画像キャッシュ)
- `NOTION_TOKEN` — Notion API トークン (`wrangler secret put NOTION_TOKEN`)

カスタマイズ:

```ts
cloudflarePreset({
  env,
  bindings: { docCache: "MY_KV", imgBucket: "MY_R2" },
});
```

binding が設定されていなければキャッシュなし (noop) にフォールバック。
`NOTION_TOKEN` が未設定の場合は `CMSError code: "core/config_invalid"` を throw。

## 使い方: `r2Cache` を直接

```ts
import { createCMS } from "@notion-headless-cms/core";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import { cmsDataSources } from "./generated/nhc-schema";

export default {
  async fetch(req: Request, env: { IMG_BUCKET: R2Bucket }) {
    const cache = r2Cache({ bucket: env.IMG_BUCKET });
    const cms = createCMS({
      cache: { document: cache, image: cache, ttlMs: 5 * 60_000 },
      dataSources: cmsDataSources,
    });
    // ...
  },
};
```

### プレフィックスの分離

同じバケットを別プロジェクトと共有する場合は `prefix` を指定:

```ts
r2Cache({ bucket: env.IMG_BUCKET, prefix: "blog/" });
```

生成されるキー構造:

```
<prefix>content.json           # リストキャッシュ
<prefix>content/<slug>.json    # 個別アイテム
<prefix>images/<hash>          # 画像バイナリ
```

## API

### `cloudflarePreset(opts)`

| オプション | 型 | 説明 |
|---|---|---|
| `env` | `CloudflarePresetEnv` | Workers の env |
| `ttlMs` | `number` (任意) | SWR の TTL (ミリ秒) |
| `bindings` | `{ docCache?, imgBucket? }` (任意) | binding 名をカスタム |

戻り値: `Pick<CreateCMSOptions, "cache">` (createCMS にスプレッドで渡す)

### `r2Cache(opts)`

| オプション | 型 | 説明 |
|---|---|---|
| `bucket` | `R2BucketLike` | R2 バケットバインディング |
| `prefix` | `string` (任意) | キャッシュキーのプレフィックス |

戻り値: `DocumentCacheAdapter<T>` & `ImageCacheAdapter` を同時に満たすインスタンス。

## 型

- `R2BucketLike` — R2 バケットの構造的インターフェース。`@cloudflare/workers-types` に直接依存しない
- `R2ObjectLike` — R2 オブジェクトの構造的インターフェース
- `CloudflarePresetEnv` — cloudflarePreset が読む env の最小構成

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — `DocumentCacheAdapter` / `ImageCacheAdapter` の型定義
- [`@notion-headless-cms/cache-kv`](../cache-kv) — KV 単独のドキュメントキャッシュ
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR 向けキャッシュ
