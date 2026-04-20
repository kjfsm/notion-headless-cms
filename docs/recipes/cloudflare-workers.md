# Cloudflare Workers + R2 レシピ

## インストール

```bash
pnpm add @notion-headless-cms/adapter-cloudflare
```

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
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";

export interface Env {
  NOTION_TOKEN: string;
  NOTION_DATA_SOURCE_ID: string;
  CACHE_BUCKET?: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cms = createCloudflareCMS({
      env,
      schema: { publishedStatuses: ["公開"] },
      cache: { ttlMs: 5 * 60_000 }, // 5分TTL
    });

    const url = new URL(request.url);

    // 画像配信
    if (url.pathname.startsWith("/api/images/")) {
      const hash = url.pathname.split("/").pop()!;
      const response = await cms.createCachedImageResponse(hash);
      return response ?? new Response("Not Found", { status: 404 });
    }

    // SWR でコンテンツ一覧
    const { items } = await cms.getList();
    return Response.json(items);
  },
};
```

## キャッシュなしで動かす（ローカル開発）

`CACHE_BUCKET` を設定しないと、キャッシュなしで動作します。
`wrangler dev` での開発時に便利です。
