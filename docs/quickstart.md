# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース（`nhc generate` で introspect する対象）
- Node.js 24 以降

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

`core` は `createCMS` / `nodePreset` を提供する本体。`notion-orm` は
CLI が生成する `nhc-schema.ts` から参照される内部パッケージで、
ユーザーが直接 import する必要はない。`@notionhq/client` / `zod` /
unified 系は peer 依存のため、利用側でインストールする。

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
  output: "./app/generated/nhc-schema.ts",
});
```

```bash
# Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

## 最小構成（インメモリキャッシュ付き）

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./app/generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({ ttlMs: 5 * 60_000 }), // memory cache + 5分 TTL
  dataSources: cmsDataSources,
});

// 一覧取得
const posts = await cms.posts.getList();

// スラッグで取得 → 本文を blocks / html / markdown で取り出す
const post = await cms.posts.getItem("my-first-post");
if (post) {
  console.log(post.content.blocks);        // ContentBlock[]
  console.log(await post.content.html());  // HTML 文字列 (遅延)
}
```

`nodePreset()` はデフォルトで `memoryDocumentCache` + `memoryImageCache`
を有効化する。完全にキャッシュを切る場合は `nodePreset({ cache: "disabled" })`、
任意の cache adapter を差し込む場合は `nodePreset({ cache: { document: ..., image: ... } })` を使う。

## Cloudflare Workers の場合

```ts
import { createCMS } from "@notion-headless-cms/core";
import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
import { cmsDataSources } from "./app/generated/nhc-schema";

export default {
  async fetch(req: Request, env: Env) {
    const cms = createCMS({
      ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }),
      dataSources: cmsDataSources,
    });
    const posts = await cms.posts.getList();
    return Response.json(posts);
  },
};
```

`cloudflarePreset` は `env.NOTION_TOKEN` / `env.DOC_CACHE` (KV) /
`env.IMG_BUCKET` (R2) を自動解決する。旧名 `CACHE_KV` / `CACHE_BUCKET`
もフォールバックとして認識される。binding 名をカスタマイズする場合は
`cloudflarePreset({ env, bindings: { docCache: "MY_KV", imgBucket: "MY_R2" } })`。

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
  output: "./app/generated/nhc-schema.ts",
});
```

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./app/generated/nhc-schema";

const cms = createCMS({ ...nodePreset(), dataSources: cmsDataSources });

const posts = await cms.posts.getList(); // PostsItem[]
const news = await cms.news.getList();   // NewsItem[]
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
- [v0.2 → v0.3 移行ガイド](./migration/v0.3.md)
