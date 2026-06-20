---
title: マルチソース構成
description: 複数 DataSource を組み合わせる
category: レシピ
order: 7
---

# マルチソースレシピ

複数の Notion DB（あるいは別ソース）を 1 つのクライアントで型安全に扱うパターン。

## 事前準備：スキーマの生成

```bash
pnpm add -D @notion-headless-cms/cli
npx nhc init
# nhc.config.ts を編集して複数 DB を設定
npx nhc generate
```

`nhc.config.ts` の例:

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "src/generated/nhc.schema.ts",
  collections: {
    posts: { dbName: "ブログ記事DB", publishedStatuses: ["公開済み"] },
    news: {
      databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      publishedStatuses: ["公開済み"],
    },
  },
});
```

詳細は [CLI ドキュメント](../cli.md) を参照。

---

## Node.js（Notion 複数 DB）

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: { publishedStatuses: ["公開済み"] },
        news: { publishedStatuses: ["公開済み"] },
      },
    }),
  },
  cache: [memoryCache()],
  swr: { recheckWindowMs: 30_000, staleBlockMs: 5 * 60_000 },
});

// 各コレクションは個別の CollectionClient として推論される
const posts = await cms.posts.list(); // Post[]
const news = await cms.news.list();   // News[]
```

## Cloudflare Workers

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "DOC_CACHE"
id = "xxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "nhc-images"
```

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cms = createClient({
      sources: {
        notion: notionSource({
          schema,
          token: env.NOTION_TOKEN,
          publishOptions: {
            posts: { publishedStatuses: ["公開済み"] },
            news: { publishedStatuses: ["公開済み"] },
          },
        }),
      },
      cache: cloudflareCache(env),
      swr: { recheckWindowMs: 30_000, staleBlockMs: 5 * 60_000 },
    });

    const url = new URL(request.url);
    if (url.pathname === "/posts") return Response.json(await cms.posts.list());
    if (url.pathname === "/news") return Response.json(await cms.news.list());
    return new Response("Not Found", { status: 404 });
  },
};
```

---

## 異なるソースを混在させる

`createClient({ sources })` は複数アダプターの `collections` を自動マージする。各アダプターは `@notion-headless-cms/core` の `CMSSources` インターフェースを宣言マージで拡張するため、`import` するだけで sources のキーが補完候補に現れる。

```ts
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { contentfulSource } from "@example/contentful-source"; // 仮想例
import { schema as notionSchema } from "./generated/nhc.schema";

const cms = createClient({
  sources: {
    notion: notionSource({ schema: notionSchema, token: process.env.NOTION_TOKEN! }),
    contentful: contentfulSource({ /* ... */ }),
  },
  cache: [memoryCache()],
});

await cms.posts.list();    // Notion 由来
await cms.products.list(); // Contentful 由来
```

> 同名コレクションは後勝ち（`Object.assign`）。ソース間で名前が衝突しないように調整する。

---

## 型推論の仕組み

`MergeSourceCollections<S>` 型ユーティリティで、すべてのソースの `collections` が交差型としてマージされる。各 `CollectionDef<T>` の `T` がそのまま `CollectionClient<T>` に伝わる。

```ts
// 生成ファイル (nhc.schema.ts) — 編集不要
export interface Post {
  id: string;
  slug: string;
  title: string | null;
  /* ... */
}
export interface News {
  id: string;
  slug: string;
  headline: string | null;
}

export const schema = {
  posts: { dataSourceId: "...", properties: postsProperties, slugField: "slug" },
  news: { dataSourceId: "...", properties: newsProperties, slugField: "slug" },
} as const satisfies SchemaMap;

// アプリコード
const cms = createClient({ sources: { notion: notionSource({ schema, token }) } });
//    ^? CMSClient<{ posts: CollectionDef<Post>; news: CollectionDef<News> }>

const posts = await cms.posts.list();
//    ^? Post[]
```

---

## 1 ソースのみ扱いたい場合

`nhc.config.ts` の `collections` に 1 件だけ登録すれば、そのまま単一 DB 構成としても使える。

```ts
const cms = createClient({
  sources: { notion: notionSource({ schema, token }) },
  cache: [memoryCache()],
});
const posts = await cms.posts.list();
```

## 関連ドキュメント

- [CLI ツール](../cli.md)
- [Node.js スクリプト](./nodejs-script.md)
- [Cloudflare Workers + R2 + KV](./cloudflare-workers.md)
- [カスタムデータソース](./custom-source.md) — 自前のソースアダプターを作る
- [CMS メソッド一覧](../api/cms-methods.md)
