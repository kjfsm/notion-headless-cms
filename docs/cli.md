# CLI ツール（nhc）

`@notion-headless-cms/cli` は Notion データベースを introspect して TypeScript スキーマファイルを自動生成する CLI ツール。
Prisma の `prisma db pull` に相当するワークフローを Notion に対して実現する。

## インストール

```bash
pnpm add -D @notion-headless-cms/cli
```

## ワークフロー概要

```
nhc init          →  nhc.config.ts テンプレートを生成
↓ （DB 名 / ID を設定）
nhc generate      →  Notion DB を introspect して nhc-schema.ts を生成（編集不要）
↓
createNodeCMS / createCloudflareCMS で型安全に利用
（published / accessible は sources オプションで差し込む）
```

## `nhc init` — 設定ファイルの生成

```bash
npx nhc init
```

カレントディレクトリに `nhc.config.ts` のテンプレートを生成する。

```
オプション:
  -o, --output <path>   出力先ファイルパス（デフォルト: nhc.config.ts）
  -f, --force           既存ファイルを上書きする
```

生成されるテンプレート:

```ts
import "dotenv/config";
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    {
      name: "posts",
      // dbName で Notion DB を検索して ID を自動解決します
      dbName: "ブログ記事DB",
      // id を直接指定することもできます（id が優先されます）
      // id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      fields: {
        // slug に使う Notion プロパティ名（省略時: title 型プロパティを自動検出）
        // slug: "Slug",
      },
    },
  ],
  // 生成ファイルの出力先（省略時: ./nhc-schema.ts）
  // output: "./nhc-schema.ts",
});
```

先頭の `import "dotenv/config";` は `.env` ファイルから `NOTION_TOKEN` 等を読み込むためのもの。`.env` を使わない場合（シェル側で export する / CI / Cloudflare の `wrangler secret`）は削除してよい。

## `nhc generate` — スキーマの生成

```bash
NOTION_TOKEN=secret_xxx npx nhc generate
```

`nhc.config.ts` を読み込み、各 Notion DB を introspect してスキーマファイルを生成する。

```
オプション:
  -c, --config <path>   設定ファイルのパス（デフォルト: nhc.config.ts）
  -t, --token <token>   Notion API トークン（省略時は NOTION_TOKEN 環境変数）
```

Notion インテグレーショントークンの取得: [Notion Developers](https://www.notion.so/my-integrations)

> Notion インテグレーションに対象 DB への「コンテンツの読み取り」権限が必要。DB の「接続先」からインテグレーションを追加すること。

## `nhc.config.ts` の設定

### `DataSourceConfig`

データソースは2種類の指定方法がある。

#### DB 名で解決（推奨）

```ts
{
  name: "posts",     // コード上の識別子
  dbName: "ブログ記事DB",  // Notion の DB 名（検索に使用）
}
```

#### ID で直接指定

```ts
{
  name: "posts",
  id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  // Notion DB ID
  dbName: "ブログ記事DB",  // 任意（生成ファイルのコメント用）
}
```

`id` を指定した場合は `dbName` での検索をスキップするため、同名の DB が複数存在する場合や DB 名変更に強い。

### `fields` — フィールドのマッピング指定

```ts
fields: {
  slug: "Slug",            // slug に使うプロパティ名
  status: "Status",        // status に使うプロパティ名
  publishedAt: "公開日",    // publishedAt に使うプロパティ名
  // 日本語など ASCII 変換できないプロパティ名は必須指定
  properties: {
    "タイトル": "title",
    "カテゴリ": "category",
  },
}
```

`fields` を省略した場合は自動検出ルールが適用される（後述）。

`published` / `accessible` はここでは設定しない。クライアント作成時の `sources` オプションで差し込む（[生成ファイルは編集不要](#生成ファイルは編集不要) 参照）。

### 複数 DB の設定例

```ts
import "dotenv/config";
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    {
      name: "posts",
      dbName: "ブログ記事DB",
      // fields の省略時は自動検出ルールを適用
    },
    {
      name: "news",
      id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      fields: {
        slug: "Title",
        status: "公開状態",
      },
    },
    {
      name: "members",
      dbName: "メンバーDB",
      fields: {
        // 日本語プロパティ名は properties で明示マッピング
        properties: { "氏名": "fullName", "所属": "department" },
      },
    },
  ],
  output: "./src/generated/nhc-schema.ts",
});
```

## プロパティ型マッピング

| Notion プロパティ型 | TypeScript 型 | フィールド型 |
|---|---|---|
| `title` | `string \| null` | `"title"` |
| `rich_text` | `string \| null` | `"richText"` |
| `select` / `status` | `string \| null` | `"select"` |
| `multi_select` | `string[]` | `"multiSelect"` |
| `date` | `string \| null` | `"date"` |
| `number` | `number \| null` | `"number"` |
| `checkbox` | `boolean` | `"checkbox"` |
| `url` | `string \| null` | `"url"` |
| それ以外 | — | スキップ（コメント付きで記録） |

### 自動検出ルール

`fields.*` の明示指定がない場合:

| フィールド | 検出条件 |
|---|---|
| `slug` | `title` 型のプロパティ（最初に見つかったもの） |
| `status` | 名前が `Status` / `状態` / `state` の `select` または `status` 型 |
| `publishedAt` | 名前が `PublishedAt` / `CreatedAt` / `公開日` 等の `date` 型 |

### 日本語プロパティ名の扱い

ASCII に変換できないプロパティ名（日本語など）は `fields.properties` で TypeScript フィールド名を明示する必要がある。未指定の場合はエラーになる。

```ts
// nhc.config.ts
fields: {
  properties: {
    "タイトル": "title",      // Notion の "タイトル" → TS の title フィールド
    "カテゴリ": "category",
    "公開日時": "publishedAt", // publishedAt として扱う場合も properties に書く
  },
}
```

自動変換できないプロパティに `fields.properties` の指定がない場合:

```
Error: [posts] プロパティ "タイトル" は TypeScript 識別子に自動変換できません。
  → nhc.config.ts の fields.properties に追加してください:
     properties: { "タイトル": "フィールド名" }
```

スキップされる（サポート外の型の）プロパティはコメントとして記録される:

```ts
// スキップ: Formula (未対応のプロパティ型: formula)
```

## 生成ファイルの構造

`nhc generate` が生成する `nhc-schema.ts` は以下の構造になる。

```ts
// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
// Generated: 2024-06-01T00:00:00.000Z

import { z } from "zod";
import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";
import type { BaseContentItem } from "@notion-headless-cms/core";

// ============================================================
// posts  (ブログ記事DB)
// Notion DB ID: abc-123-def-456
// ============================================================

export interface PostsItem extends BaseContentItem {
  title: string | null;
  tags: string[];
  views: number | null;
}

const _postsZodSchema = z.object({
  id: z.string(),
  updatedAt: z.string(),
  slug: z.string().nullable(),
  status: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string().nullable(),
  tags: z.array(z.string()),
  views: z.number().nullable(),
});

const _postsMapping = defineMapping<PostsItem>({
  slug: { type: "title", notion: "Name" },
  status: { type: "select", notion: "Status" },
  publishedAt: { type: "date", notion: "PublishedAt" },
  title: { type: "richText", notion: "Title" },
  tags: { type: "multiSelect", notion: "Tags" },
  views: { type: "number", notion: "Views" },
});

export const postsSchema = defineSchema(_postsZodSchema, _postsMapping);
export const postsSourceId = "abc-123-def-456";

// ============================================================
// NHC Multi-Source Schema
// ============================================================

export const nhcSchema = {
  posts: { id: postsSourceId, dbName: "ブログ記事DB", schema: postsSchema },
} as const;

export type NHCSchema = typeof nhcSchema;
```

### 生成ファイルは編集不要

`nhc generate` で生成した `nhc-schema.ts` は **触らなくてよい**。
`status` フィールドの `published` / `accessible` は生成ファイルには埋め込まれず、クライアント作成時に `sources` オプションで差し込む。

```ts
import { nhcSchema } from "./nhc-schema.ts";
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"], accessible: ["公開", "下書き"] },
    news:  { published: ["掲載中"] },
  },
});
```

`nhc generate` を再実行しても `sources` の設定は上書きされない（アプリコード側にあるため）。

## マルチソースクライアントでの利用

生成した `nhcSchema` をアダプタに渡すと、各ソースに対応する型安全な CMS インスタンスが得られる。

```ts
import { nhcSchema } from "./nhc-schema.ts";
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const client = createNodeCMS({
  schema: nhcSchema,
  cache: { document: "memory", image: "memory", ttlMs: 5 * 60_000 },
});

// posts は CMS<PostsItem> として推論される
const posts = await client.posts.list();
const post = await client.posts.find("my-post-slug");
```

詳細は [マルチソースレシピ](./recipes/multi-source.md) を参照。

## 環境変数

| 変数名 | 説明 |
|---|---|
| `NOTION_TOKEN` | Notion インテグレーションのシークレットキー（必須） |

`nhc generate` は DB の書き込みを一切行わない。読み取り専用で動作する。
