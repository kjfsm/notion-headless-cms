# Cloudflare Workers + R2 レシピ

## インストール

```bash
pnpm add @notion-headless-cms/adapter-cloudflare
```

`adapter-cloudflare` は `core` / `source-notion` / `renderer` / `cache-r2` を推移依存として含む。

## wrangler.toml の設定

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "nhc-example-cache"
```

## シークレットの設定

```bash
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DATA_SOURCE_ID
```

## Workers のコード

```ts
import {
  createCloudflareCMS,
  type CloudflareCMSEnv,
} from "@notion-headless-cms/adapter-cloudflare";

export default {
  async fetch(request: Request, env: CloudflareCMSEnv, ctx: ExecutionContext) {
    const cms = createCloudflareCMS({
      env,
      schema: { publishedStatuses: ["公開"] },
      ttlMs: 5 * 60_000, // 5分 TTL
      waitUntil: ctx.waitUntil.bind(ctx), // SWR の裏更新を非同期化
    });

    const url = new URL(request.url);

    // 画像配信
    if (url.pathname.startsWith("/api/images/")) {
      const hash = url.pathname.split("/").pop()!;
      const response = await cms.createCachedImageResponse(hash);
      return response ?? new Response("Not Found", { status: 404 });
    }

    // 一覧（SWR）
    if (url.pathname === "/posts") {
      const { items } = await cms.cache.read.list();
      return Response.json(items);
    }

    // 単一アイテム（SWR）
    const slug = url.pathname.replace("/posts/", "");
    const cached = await cms.cache.read.get(slug);
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

## R2BucketLike と型依存

`createCloudflareCMS` の `env.CACHE_BUCKET` は構造型 `R2BucketLike` を受け取るため、`@cloudflare/workers-types` は `peerDependencies` として扱われる。テストではモックに差し替え可能。

```ts
import type { R2BucketLike } from "@notion-headless-cms/cache-r2";

const mockBucket: R2BucketLike = {
  async get() { return null; },
  async put() { return null; },
};
```
