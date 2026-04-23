# Cloudflare Workers + R2 レシピ

## インストール

```bash
pnpm add @notion-headless-cms/adapter-cloudflare
pnpm add -D @notion-headless-cms/cli
```

`adapter-cloudflare` は `core` / `source-notion` / `renderer` / `cache-r2` を推移依存として含む。

## スキーマの生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc-schema.ts` を Workers から読み込む。

## wrangler.toml の設定

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "nhc-example-cache"
```

## シークレットの設定

```bash
wrangler secret put NOTION_TOKEN
```

> 各ソースの `dataSourceId` は `nhcSchema` から自動取得されるため、`NOTION_DATA_SOURCE_ID` の設定は不要。

## Workers のコード

```ts
import {
  createCloudflareCMS,
  type CloudflareCMSEnv,
} from "@notion-headless-cms/adapter-cloudflare";
import { nhcSchema } from "./generated/nhc-schema";

export default {
  async fetch(request: Request, env: CloudflareCMSEnv, _ctx: ExecutionContext) {
    const client = createCloudflareCMS({
      schema: nhcSchema,
      env,
      sources: {
        posts: { published: ["公開"] },
      },
      ttlMs: 5 * 60_000, // 5分 TTL
    });

    const url = new URL(request.url);

    // 画像配信
    if (url.pathname.startsWith("/api/images/")) {
      const hash = url.pathname.split("/").pop()!;
      const response = await client.posts.createCachedImageResponse(hash);
      return response ?? new Response("Not Found", { status: 404 });
    }

    // 一覧（SWR）
    if (url.pathname === "/posts") {
      const { items } = await client.posts.cache.getList();
      return Response.json(items);
    }

    // 単一アイテム（SWR）
    const slug = url.pathname.replace("/posts/", "");
    const cached = await client.posts.cache.get(slug);
    if (!cached) return new Response("Not Found", { status: 404 });

    return new Response(cached.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

## キャッシュなしで動かす（ローカル開発）

`CACHE_BUCKET` を設定しないと、自動的にキャッシュなし（noop）で動作する。
`wrangler dev` での開発時に便利。

## SWR 裏更新の非同期化（waitUntil）

`adapter-cloudflare` の `createCloudflareCMS` は `waitUntil` オプションを直接受け取らない（シグネチャを単純化するため）。SWR キャッシュのバックグラウンド書き戻しを `ctx.waitUntil` に委ねたい場合は、`core` の `createCMS` を直接組み立てる。

```ts
import { createCMS } from "@notion-headless-cms/core";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { nhcSchema } from "./generated/nhc-schema";

const { posts } = nhcSchema;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cache = r2Cache({ bucket: env.CACHE_BUCKET });
    const cms = createCMS({
      source: notionAdapter({
        token: env.NOTION_TOKEN,
        dataSourceId: posts.id,
        schema: posts.schema,
      }),
      renderer: renderMarkdown,
      cache: cache
        ? { document: cache, image: cache, ttlMs: 5 * 60_000 }
        : "disabled",
      waitUntil: ctx.waitUntil.bind(ctx),
    });
    // ...
  },
};
```

## 画像配信ルート

Notion 画像 URL は期限付きのため、`core` 側で SHA256 ハッシュキーに変換して R2 に永続保存する。レンダリング後の HTML 内の `<img>` は `/api/images/<hash>` に書き換わるので、同じハッシュを提供するルートを用意する。

```ts
if (url.pathname.startsWith("/api/images/")) {
  const hash = url.pathname.split("/").pop()!;
  const response = await client.posts.createCachedImageResponse(hash);
  return response ?? new Response("Not Found", { status: 404 });
}
```

`createCachedImageResponse` は `cache-control: public, max-age=31536000, immutable` ヘッダを自動付与する。

## R2BucketLike と型依存

`createCloudflareCMS` の `env.CACHE_BUCKET` は構造型 `R2BucketLike` を受け取るため、`@cloudflare/workers-types` への実依存はない。テストではモックに差し替え可能。

```ts
import type { R2BucketLike } from "@notion-headless-cms/cache-r2";

const mockBucket: R2BucketLike = {
  async get() { return null; },
  async put() { return undefined; },
};
```
