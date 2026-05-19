---
title: クイックスタート
description: 5 分で notion-headless-cms を動かす
category: はじめに
order: 1
---

# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース（`nhc generate` で introspect する対象）
- Node.js 24 以降

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-source \
  @notion-headless-cms/cache \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

`core` は CMS エンジン本体、`notion-source` は Notion 用データソースアダプター。`notion-orm` / `renderer` は `notion-source` の `dependencies` に含まれるため明示インストール不要。`@notionhq/client` / `zod` / unified 系は peer 依存のため利用側でインストールする。

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
  collections: {
    posts: {
      dbName: "ブログ記事DB",
      publishedStatuses: ["公開済み"],
    },
  },
  output: "./app/generated/nhc.schema.ts",
});
```

```bash
# Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc.schema.ts` には DB 構造（`schema` 定数）だけが入る。ランタイム設定（トークン・キャッシュ・publishedStatuses）は `createClient` 側で組み立てる。

## 最小構成（インメモリキャッシュ付き）

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./app/generated/nhc.schema"; // nhc generate の出力

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: { publishedStatuses: ["公開済み"] },
      },
    }),
  },
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

`memoryCache()` はインプロセス LRU キャッシュ。完全にキャッシュを切る場合は `createClient` の `cache` オプションを省略するか `undefined` を渡す。

`@notion-headless-cms/notion-source` を `import` するだけで `sources.notion` キーが補完候補に現れる（module augmentation = Fastify プラグインと同じパターン）。

## Cloudflare Workers の場合

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./app/generated/nhc.schema";

export default {
  async fetch(req: Request, env: Env) {
    const cms = createClient({
      sources: {
        notion: notionSource({
          schema,
          token: env.NOTION_TOKEN,
          publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
        }),
      },
      cache: cloudflareCache(env),
      swr: { ttlMs: 5 * 60_000 },
    });
    const posts = await cms.posts.list();
    return Response.json(posts);
  },
};
```

`cloudflareCache` は `env.DOC_CACHE` (KV) / `env.IMG_BUCKET` (R2) を自動検出して `kvCache` + `r2Cache` の配列を返す。binding が設定されていない場合は対応するアダプタをスキップする。

## 複数の DB を扱う場合

`nhc.config.ts` に複数の `collections` を書けば、`cms.posts` / `cms.news` のように型安全にアクセスできる。

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  collections: {
    posts: { dbName: "ブログ記事DB", publishedStatuses: ["公開済み"] },
    news: { dbName: "ニュースDB", publishedStatuses: ["公開済み"] },
  },
  output: "./app/generated/nhc.schema.ts",
});
```

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./app/generated/nhc.schema";

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
});

const posts = await cms.posts.list(); // PostsItem[]
const news = await cms.news.list();   // NewsItem[]
```

詳細は [CLI ドキュメント](./cli.md) と [マルチソースレシピ](./recipes/multi-source.md) を参照。

## 画像プロキシ route を作る (Next.js)

Notion の画像 URL は約 1 時間で失効する。`createClient` は画像を SHA256 ハッシュキーで永続キャッシュへ書き込み、`{imageProxyBase}/{hash}` 形式の URL に書き換える。
`imageProxyBase` のデフォルトは `/api/images` で、その URL に対応する route を 1 つ用意するだけで画像が配信できる。

```ts
// app/api/cms/images/[hash]/route.ts
import { cms } from "@/app/lib/cms";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const image = await cms.getCachedImage(hash);
  if (!image) return new Response("Not Found", { status: 404 });
  return new Response(image.data, {
    headers: {
      "content-type": image.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
```

`createClient({ imageProxyBase: "/api/cms/images" })` のように base を変えた場合は、route のパスも合わせて変更する。`@notion-headless-cms/next` の `createNextHandler(cms)` を使うと `/api/cms/images/:hash` ルートが自動でマウントされる（個別 route 不要）。

詳細は [`api/cms-methods.md#cmscacheimage-の利用例`](./api/cms-methods.md#cmscacheimage-の利用例) と [Next.js App Router レシピ](./recipes/nextjs-app-router.md) を参照。

## 次のステップ

- [CLI ツール（nhc）](./cli.md)
- [マルチソース](./recipes/multi-source.md)
- [Cloudflare Workers + R2 + KV](./recipes/cloudflare-workers.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Node スクリプト](./recipes/nodejs-script.md)
- [カスタムデータソース](./recipes/custom-source.md)
- [CMS メソッド一覧](./api/cms-methods.md)
- [エラーコード一覧](./errors/index.md)
