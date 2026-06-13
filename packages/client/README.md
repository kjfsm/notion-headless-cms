# @notion-headless-cms/client

`createCMS` 単一エントリ。**DB の構造は `schema`（生成物）、それ以外の振る舞いは
`createCMS` の引数**で定義する。`createClient` + `notionSource` + preset の合成を 1 つに集約する。

> v2 使い勝手再設計（RFC: `docs/ja/rfc/v2-usability-redesign.md`）の最初の実装。

## インストール

```bash
pnpm add @notion-headless-cms/client @notion-headless-cms/cli
pnpm add @notionhq/client zod notion-to-md
```

## 使い方（Node）

```ts
import { createCMS } from "@notion-headless-cms/client";
import { schema } from "./generated/nhc";

export const cms = createCMS({
  notion: {
    schema,
    token: process.env.NOTION_TOKEN!,
    collections: { posts: { published: ["公開済み"] } },
  },
  render: { content: "html" }, // "html" | "react"（取得戦略 + renderer を内部結線）
  // cache 省略時は in-process memory が既定（document / image 兼用）
});

const posts = await cms.posts.list();
const post = await cms.posts.find("my-first-post");
const html = await post?.html();
```

## 使い方（Cloudflare / Next）

`cache` に役割別（document / image）でアダプタを明示する。

```ts
import { createCMS } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";

export const makeCms = (env: Env, ctx: ExecutionContext) =>
  createCMS({
    notion: {
      schema,
      token: env.NOTION_TOKEN,
      collections: { posts: { published: ["公開済み"] } },
    },
    render: { content: "react" },
    cache: {
      document: kvCache({ namespace: env.DOC_CACHE }),
      image: r2Cache({ bucket: env.IMG_BUCKET }),
      waitUntil: (p) => ctx.waitUntil(p),
    },
  });
```

## content モードと型

| content | アイテムに生えるアクセサ |
|---|---|
| `"html"` | `html()` / `markdown()` |
| `"react"` | `notionBlocks()`（`undefined` にならない） |

content モードでアクセサ型が切り替わるため、`"html"` で `notionBlocks()` を呼ぶような
不整合は型エラーになる。

## 責務分割

| 情報 | 住所 |
|---|---|
| DB 構造（id / properties / slugField / statusField） | `schema`（`nhc generate`） |
| 取得元（schema / token / 公開ポリシー） | `createCMS({ notion })` |
| 出力先（content / 画像プロキシ / OGP） | `createCMS({ render })` |
| キャッシュ戦略（document / image / swr / waitUntil） | `createCMS({ cache })` |
