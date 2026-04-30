# マルチソースレシピ

複数の Notion DB を 1 つのクライアントで型安全に扱うパターン。
`nhc generate` が生成した `createCMS` ラッパーを使うだけ。

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
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
    { name: "news", id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  ],
  output: "./app/generated/nhc.ts",
});
```

詳細は [CLI ドキュメント](../cli.md) を参照。

---

## Node.js

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "./generated/nhc";

const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  cache: [memoryCache()],
  swr: { ttlMs: 5 * 60_000 },
});

// 各ソースは個別の CollectionClient として推論される
const posts = await cms.posts.list(); // PostsItem[]
const news = await cms.news.list();   // NewsItem[]
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
import { createCMS } from "./generated/nhc";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cms = createCMS({
      notionToken: env.NOTION_TOKEN,
      cache: cloudflareCache(env),
      swr: { ttlMs: 5 * 60_000 },
    });

    const url = new URL(request.url);
    if (url.pathname === "/posts") return Response.json(await cms.posts.list());
    if (url.pathname === "/news") return Response.json(await cms.news.list());
    return new Response("Not Found", { status: 404 });
  },
};
```

```bash
wrangler secret put NOTION_TOKEN
```

---

## 型推論の仕組み

`nhc generate` が生成する `createCMS` ラッパーは各ソースのアイテム型を静的に持つ。

```ts
// 生成ファイル (nhc.ts) — 編集不要
export interface PostsItem extends BaseContentItem {
  title: string | null;
  tags: string[];
}
export interface NewsItem extends BaseContentItem {
  headline: string | null;
}

export function createCMS(config: NhcConfig): {
  posts: CollectionClient<PostsItem>;
  news: CollectionClient<NewsItem>;
} { /* ... */ }

// アプリコード
const cms = createCMS({ notionToken: "...", cache: [memoryCache()] });
//    ^? { posts: CollectionClient<PostsItem>; news: CollectionClient<NewsItem> }

const posts = await cms.posts.list();
//    ^? PostsItem[]
```

---

## 1 ソースのみ扱いたい場合

`nhc.config.ts` の `dataSources` に 1 件だけ登録すれば、そのまま単一 DB 構成としても使える。

```ts
const cms = createCMS({ notionToken: "...", cache: [memoryCache()] });
const posts = await cms.posts.list();
```

## 関連ドキュメント

- [CLI ツール](../cli.md)
- [Node.js スクリプト](./nodejs-script.md)
- [Cloudflare Workers + R2 + KV](./cloudflare-workers.md)
- [CMS メソッド一覧](../api/cms-methods.md)
