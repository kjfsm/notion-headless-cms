# Cloudflare Workers + R2 + KV レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notion-headless-cms/cache \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

`@notion-headless-cms/cache` の `cloudflare` サブパスが KV / R2 アダプタを提供する。

## スキーマの生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc.ts` を Workers から読み込む。

## wrangler.toml の設定

推奨 binding 名は `DOC_CACHE` (KV) と `IMG_BUCKET` (R2)。

```toml
[[kv_namespaces]]
binding = "DOC_CACHE"
id = "xxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "nhc-images"
```

## シークレットの設定

```bash
wrangler secret put NOTION_TOKEN
```

## Workers のコード

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createCMS } from "./generated/nhc";

interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cms = createCMS({
      notionToken: env.NOTION_TOKEN,
      cache: cloudflareCache(env),
      ttlMs: 5 * 60_000,
    });

    const url = new URL(request.url);

    // 画像配信 (core の $handler でまとめてさばく)
    const handler = cms.$handler();
    if (url.pathname.startsWith("/api/images/")) {
      return handler(request);
    }

    // 一覧
    if (url.pathname === "/posts") {
      const posts = await cms.posts.list();
      return Response.json(posts);
    }

    // 単一アイテム
    const slug = url.pathname.replace("/posts/", "");
    const post = await cms.posts.get(slug);
    if (!post) return new Response("Not Found", { status: 404 });

    const html = await post.render();
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

## binding 名のカスタマイズ

既定は `DOC_CACHE` / `IMG_BUCKET`。別の名前を使う場合は `cloudflareCache` の第 2 引数で指定する:

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";

const cms = createCMS({
  notionToken: env.NOTION_TOKEN,
  cache: cloudflareCache(env, {
    bindings: { docCache: "MY_KV", imgBucket: "MY_R2" },
  }),
});
```

## キャッシュなしで動かす（ローカル開発）

binding を設定しないと `cloudflareCache` はアダプタなし（空配列）を返すので、自動的にキャッシュなしで動作する。
`wrangler dev` でローカル開発するときは `.dev.vars` に `NOTION_TOKEN` だけあれば動く。

```
# .dev.vars
NOTION_TOKEN=secret_xxx
```

## SWR 裏更新の非同期化 (waitUntil)

SWR キャッシュのバックグラウンド書き戻しを Workers のライフサイクルに
載せるには `ctx.waitUntil` を低レベル API に渡す。

```ts
import { createCMS } from "@notion-headless-cms/core";
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";

// 低レベル createCMS を使う場合
const cms = createCMS({
  collections: { /* ... */ },
  cache: cloudflareCache(env),
  ttlMs: 5 * 60_000,
  waitUntil: ctx.waitUntil.bind(ctx),
});
```

CLI 生成ラッパーの `createCMS` は `waitUntil` オプションをサポートしていないため、
Workers ライフサイクルに乗せる必要がある場合は core の `createCMS` を直接使う。

## Webhook によるキャッシュ invalidate

`cms.$handler({ webhookSecret })` にリクエストを投げると、DataSource の `parseWebhook` が
`{ collection, slug? }` を返し、該当スコープが invalidate される。

```ts
const handler = cms.$handler({ webhookSecret: env.NOTION_WEBHOOK_SECRET });
if (url.pathname === "/api/revalidate") {
  return handler(request);
}
```

## 画像配信ルート

Notion 画像 URL は期限付きのため、core 側で SHA256 ハッシュキーに変換して
R2 に永続保存する。レンダリング後の HTML 内の `<img>` は `/api/images/<hash>`
に書き換わるので、同じハッシュを提供するルートを用意する。

`cms.$handler()` はこれを自動でさばくため、ほぼ何も書かなくてよい。

## R2BucketLike / KVNamespaceLike と型依存

`cloudflareCache` が受ける env の binding は構造型 (`R2BucketLike` /
`KVNamespaceLike`) を要求するため、`@cloudflare/workers-types` への
実依存はない。テストではモックに差し替え可能。
