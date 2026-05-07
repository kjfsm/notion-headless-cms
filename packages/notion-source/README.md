# @notion-headless-cms/notion-source

Notion 用データソースアダプター。`@notion-headless-cms/core` の `createClient({ sources: { notion: notionSource(...) } })` に渡して使う。

CLI 生成の `nhc.schema.ts` に書かれた `schema` 定数と Notion API トークンから、`CMSAdapter` を組み立てる薄いラッパー。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-source \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

`@notion-headless-cms/notion-orm` / `@notion-headless-cms/renderer` は本パッケージの `dependencies` に含まれるため明示インストールは不要。

## 使い方

```ts
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: {
          publishedStatuses: ["公開済み"],
          accessibleStatuses: ["下書き", "公開済み"],
        },
      },
    }),
  },
});
```

`@notion-headless-cms/notion-source` を `import` するだけで、`createClient` の `sources` に `notion` キーが補完候補として現れる（Fastify プラグイン型拡張と同じ module augmentation パターン）。

## API

### `notionSource<S extends SchemaMap>(opts: NotionSourceConfig<S>): CMSAdapter`

| オプション | 必須 | 説明 |
|---|---|---|
| `schema` | ✓ | CLI 生成の `nhc.schema.ts` から import する `SchemaMap` |
| `token` | ✓ | Notion API トークン |
| `blocks` | – | カスタムブロックハンドラーのマップ（`@notion-headless-cms/notion-embed` の `embed.blocks` 等） |
| `enrichers` | – | `BlockEnricher` のリスト（`@notion-headless-cms/notion-katex` 等） |
| `ogp` | – | bookmark / embed / link_preview ブロックの OGP 取得設定 |
| `publishOptions` | – | コレクション別の `publishedStatuses` / `accessibleStatuses` |

### `SchemaMap`

CLI が `nhc generate` で出力する `schema` の型。1 コレクションあたり以下を持つ:

```ts
interface CollectionSchemaEntry {
  dataSourceId: string;
  properties: PropertyMap;
  slugField: string;
  statusField?: string;
}
```

## 拡張ポイント — 別ソースの追加

`@notion-headless-cms/core` の `CMSSources` インターフェースを宣言マージすれば、`sources.<key>` を補完候補に追加できる。

```ts
// my-source/index.ts
import type { CMSAdapter } from "@notion-headless-cms/core";

declare module "@notion-headless-cms/core" {
  interface CMSSources {
    contentful?: CMSAdapter;
  }
}

export function contentfulSource(opts: { ... }): CMSAdapter {
  return { collections: { ... } };
}
```

複数ソースを `createClient({ sources: { notion: ..., contentful: ... } })` に渡すと、各ソースの `collections` がマージされて 1 つの `cms.posts` / `cms.products` などとしてアクセスできる。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cli`](../cli) — `nhc generate` で `schema` を生成
- [`@notion-headless-cms/notion-orm`](../notion-orm) — 本パッケージが内部で使う Notion ORM 層
- [`@notion-headless-cms/notion-embed`](../notion-embed) — Notion ブロック → HTML
- [`@notion-headless-cms/notion-katex`](../notion-katex) — equation ブロックの KaTeX pre-render
