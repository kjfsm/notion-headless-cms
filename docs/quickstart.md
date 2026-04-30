# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース（`nhc generate` で introspect する対象）
- Node.js 24 以降

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notion-headless-cms/cache \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

`core` は CMS エンジン本体。`notion-orm` は CLI が生成する `nhc.ts` から参照される内部パッケージで、
ユーザーが直接 import する必要はない。`@notionhq/client` / `zod` / unified 系は peer 依存のため、
利用側でインストールする。

## スキーマを自動生成する

```bash
npx nhc init
```

`nhc.config.ts` を編集して DB を設定する:

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  dataSources: [{ name: "posts", dbName: "ブログ記事DB" }],
  output: "./app/generated/nhc.ts",
});
```

```bash
# Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc.ts` には型付きの `createCMS` ラッパーが含まれる。
`collections` の構成は生成物が持つので、利用側はトークンとキャッシュ設定だけ渡せばよい。

## 最小構成（インメモリキャッシュ付き）

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "./app/generated/nhc";  // nhc generate の出力

const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  cache: [memoryCache()],
  swr: { ttlMs: 5 * 60_000 }, // 5分 TTL
});

// 一覧取得
const posts = await cms.posts.list();

// スラッグで取得 → 本文を HTML / Markdown で取り出す
const post = await cms.posts.find("my-first-post");
if (post) {
  console.log(await post.render());                        // HTML 文字列
  console.log(await post.render({ format: "markdown" })); // Markdown 文字列
}
```

`memoryCache()` はインプロセス LRU キャッシュ。完全にキャッシュを切る場合は
`createCMS` の `cache` オプションを省略するか `undefined` を渡す。

## Cloudflare Workers の場合

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createCMS } from "./app/generated/nhc";

export default {
  async fetch(req: Request, env: Env) {
    const cms = createCMS({
      notionToken: env.NOTION_TOKEN,
      cache: cloudflareCache(env),
      swr: { ttlMs: 5 * 60_000 },
    });
    const posts = await cms.posts.list();
    return Response.json(posts);
  },
};
```

`cloudflareCache` は `env.DOC_CACHE` (KV) / `env.IMG_BUCKET` (R2) を自動検出して
`kvCache` + `r2Cache` の配列を返す。binding が設定されていない場合は対応するアダプタをスキップする。

## 複数の DB を扱う場合

`nhc.config.ts` に複数の `dataSources` を書けば、`cms.posts` / `cms.news` のように型安全にアクセスできる。

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
    { name: "news", dbName: "ニュースDB" },
  ],
  output: "./app/generated/nhc.ts",
});
```

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "./app/generated/nhc";

const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  cache: [memoryCache()],
});

const posts = await cms.posts.list(); // PostsItem[]
const news = await cms.news.list();   // NewsItem[]
```

詳細は [CLI ドキュメント](./cli.md) と [マルチソースレシピ](./recipes/multi-source.md) を参照。

## 次のステップ

- [CLI ツール（nhc）](./cli.md)
- [マルチソース](./recipes/multi-source.md)
- [Cloudflare Workers + R2 + KV](./recipes/cloudflare-workers.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Node スクリプト](./recipes/nodejs-script.md)
- [カスタムデータソース](./recipes/custom-source.md)
- [CMS メソッド一覧](./api/cms-methods.md)
- [v1.0 移行ガイド](./migration/v1.0.md)
- [v0.2 → v0.3 移行ガイド](./migration/v0.3.md)
