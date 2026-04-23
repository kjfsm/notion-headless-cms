# マルチソースレシピ

複数の Notion DB を 1 つのクライアントで型安全に扱うパターン。
`nhc generate` が生成した `cmsDataSources` を `createCMS` に渡すだけ。

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
  output: "./app/generated/nhc-schema.ts",
});
```

詳細は [CLI ドキュメント](../cli.md) を参照。

---

## Node.js

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({ ttlMs: 5 * 60_000 }),
  dataSources: cmsDataSources,
});

// 各ソースは個別の CollectionClient として推論される
const posts = await cms.posts.getList(); // PostsItem[]
const news = await cms.news.getList();   // NewsItem[]
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
import { createCMS } from "@notion-headless-cms/core";
import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
import { cmsDataSources } from "./generated/nhc-schema";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cms = createCMS({
      ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }),
      dataSources: cmsDataSources,
    });

    const url = new URL(request.url);
    if (url.pathname === "/posts") return Response.json(await cms.posts.getList());
    if (url.pathname === "/news") return Response.json(await cms.news.getList());
    return new Response("Not Found", { status: 404 });
  },
};
```

```bash
wrangler secret put NOTION_TOKEN
```

---

## 型推論の仕組み

`cmsDataSources` の型から各ソースのアイテム型が自動推論される。

```ts
// 生成ファイル (nhc-schema.ts) — 編集不要
export interface PostsItem extends BaseContentItem {
  title: string | null;
  tags: string[];
}
export const cmsDataSources = {
  posts: createNotionCollection({ token: env("NOTION_TOKEN"), dataSourceId: postsSourceId, schema: postsSchema }),
  news: createNotionCollection({ token: env("NOTION_TOKEN"), dataSourceId: newsSourceId, schema: newsSchema }),
} as const;

// アプリコード
const cms = createCMS({ ...nodePreset(), dataSources: cmsDataSources });
//    ^? CMSClient<{ posts: DataSource<PostsItem>, news: DataSource<NewsItem> }>

const posts = await cms.posts.getList();
//    ^? PostsItem[]
```

---

## 1 ソースのみ扱いたい場合

`nhc.config.ts` の `dataSources` に 1 件だけ登録すれば、そのまま単一 DB 構成としても使える。

```ts
const cms = createCMS({ ...nodePreset(), dataSources: cmsDataSources });
const posts = await cms.posts.getList();
```

## 関連ドキュメント

- [CLI ツール](../cli.md)
- [Node.js スクリプト](./nodejs-script.md)
- [Cloudflare Workers + R2 + KV](./cloudflare-workers.md)
- [CMS メソッド一覧](../api/cms-methods.md)
