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
  schema,
  token: process.env.NOTION_TOKEN!,
  content: "html", // "html" | "react"（取得戦略 + renderer を内部結線）
  collections: { posts: { published: ["公開済み"] } },
});

const posts = await cms.posts.list();
const post = await cms.posts.find("my-first-post");
const html = await post?.html();
```

## 使い方（Cloudflare / Next）

`runtime` に各 preset の戻り値を渡す。

```ts
import { createCMS } from "@notion-headless-cms/client";
import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";

export const makeCms = (env: Env, ctx: ExecutionContext) =>
  createCMS({
    schema,
    token: env.NOTION_TOKEN,
    content: "react",
    runtime: cloudflarePreset({ env, ctx }),
    collections: { posts: { published: ["公開済み"] } },
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
| token / content / 公開ポリシー / ランタイム | `createCMS` の引数 |
