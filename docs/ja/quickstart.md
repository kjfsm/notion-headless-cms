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

生成された `nhc.schema.ts` には DB 構造（`schema` 定数）だけが入る。ランタイム設定（トークン・content モード・公開ポリシー・ランタイム）は `createCMS` 側で組み立てる。

## 最小構成（Node・既定ランタイム）

```ts
import { createCMS } from "@notion-headless-cms/client";
import { schema } from "./app/generated/nhc.schema"; // nhc generate の出力

const cms = createCMS({
  schema,
  token: process.env.NOTION_TOKEN!,
  content: "html",
  collections: {
    posts: { published: ["公開済み"] },
  },
});

// 一覧取得
const posts = await cms.posts.list();

// スラッグで取得 → 本文を HTML / Markdown で取り出す
const post = await cms.posts.find("my-first-post");
if (post) {
  console.log(await post.html());     // HTML 文字列
  console.log(await post.markdown()); // Markdown 文字列
}
```

`runtime` を省略すると Node 既定（インメモリ LRU キャッシュ + 5 分 TTL）になる。
キャッシュを細かく制御したいときは `runtime: { cache: [...], swr: { ttlMs } }` を渡す。

## Cloudflare Workers の場合

```ts
import { createCMS } from "@notion-headless-cms/client";
import { cloudflarePreset } from "@notion-headless-cms/client/cloudflare";
import { schema } from "./app/generated/nhc.schema";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const cms = createCMS({
      schema,
      token: env.NOTION_TOKEN,
      content: "html",
      runtime: cloudflarePreset({ env, ctx }),
      collections: { posts: { published: ["公開済み"] } },
    });
    const posts = await cms.posts.list();
    return Response.json(posts);
  },
};
```

`cloudflarePreset` は `env.DOC_CACHE` (KV) / `env.IMG_BUCKET` (R2) を自動検出して KV + R2 のキャッシュを配線する。`ctx`（ExecutionContext）を渡すと SWR のバックグラウンド更新が `waitUntil` で配線される。

## 複数の DB を扱う場合

`nhc.config.ts` に複数の `collections` を書けば、`cms.posts` / `cms.news` のように型安全にアクセスできる。

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  collections: {
    posts: { dbName: "ブログ記事DB" },
    news: { dbName: "ニュースDB" },
  },
  output: "./app/generated/nhc.schema.ts",
});
```

```ts
import { createCMS } from "@notion-headless-cms/client";
import { schema } from "./app/generated/nhc.schema";

const cms = createCMS({
  schema,
  token: process.env.NOTION_TOKEN!,
  content: "html",
  collections: {
    posts: { published: ["公開済み"] },
    news: { published: ["公開済み"] },
  },
});

const posts = await cms.posts.list(); // PostsItem[]
const news = await cms.news.list();   // NewsItem[]
```

詳細は [CLI ドキュメント](./cli.md) と [マルチソースレシピ](./recipes/multi-source.md) を参照。

## 画像プロキシ route を作る (Next.js)

Notion の画像 URL は約 1 時間で失効する。`createCMS` は画像を SHA256 ハッシュキーで永続キャッシュへ書き込み、`{imageProxyBase}/{hash}` 形式の URL に書き換える。
`createCMS` の `imageProxyBase` は **`/api/cms/images` に固定**で、`cms.handler()` の既定ルートと一致する。`cms.handler()` を 1 つマウントすれば画像配信もまとめて賄える（専用 route の自前実装は不要）。

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

`createCMS({ imageProxyBase: "/api/cms/images" })` のように base を変えた場合は、route のパスも合わせて変更する。`@notion-headless-cms/client/next` の `createNextHandler(cms)` を使うと `/api/cms/images/:hash` ルートが自動でマウントされる（個別 route 不要）。

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
