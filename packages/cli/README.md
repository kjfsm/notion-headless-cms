# @notion-headless-cms/cli

Notion データベースを introspect して TypeScript スキーマファイルを自動生成する CLI ツール。Prisma の `prisma db pull` に相当するワークフローを Notion に対して実現する。

## インストール

```bash
npm install -D @notion-headless-cms/cli
```

## クイックスタート

```bash
# 1. 設定ファイルのテンプレートを生成
npx nhc init

# 2. nhc.config.ts を編集（DB 名 / ID を設定）

# 3. Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc-schema.ts` はそのままアダプタに渡せる（編集不要）。
`published` / `accessible` はクライアント作成時に `sources` で差し込む。

```ts
import { nhcSchema } from "./nhc-schema.ts";
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"], accessible: ["公開", "下書き"] },
  },
});
const posts = await client.posts.list();
```

## `nhc.config.ts`

`defineConfig()` で設定を定義し、`default export` する。

```ts
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    // DB 名で自動解決
    {
      name: "posts",
      dbName: "ブログ記事DB",
    },
    // ID で直接指定
    {
      name: "news",
      id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
  ],
  // 生成ファイルの出力先（省略時: ./nhc-schema.ts）
  output: "./src/nhc-schema.ts",
});
```

### `DataSourceConfig` オプション

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | `string` | コード上で使う識別子（`client.posts` など） |
| `id` | `string`（任意） | Notion DB ID。指定時は `dbName` より優先 |
| `dbName` | `string`（`id` 未指定時は必須） | Notion DB 名（前方一致で検索） |
| `fields.slug` | `string`（任意） | slug に使う Notion プロパティ名（省略時: `title` 型プロパティを自動検出） |
| `fields.status` | `string`（任意） | status に使う Notion プロパティ名（省略時: `Status` / `状態` 等を自動検出） |
| `fields.publishedAt` | `string`（任意） | publishedAt に使う Notion プロパティ名（省略時: `PublishedAt` / `公開日` 等を自動検出） |
| `fields.properties` | `Record<string, string>`（任意） | Notion プロパティ名 → TypeScript フィールド名の明示マッピング。日本語など ASCII 変換できない名前は必須 |

> `published` / `accessible` は `nhc.config.ts` で設定しない。クライアント作成時（`createNodeCMS` / `createCloudflareCMS`）の `sources` オプションで差し込む。

## コマンド一覧

### `nhc init`

`nhc.config.ts` のテンプレートを生成する。

```bash
nhc init [options]

Options:
  -o, --output <path>   出力先ファイルパス（デフォルト: nhc.config.ts）
  -f, --force           既存ファイルを上書きする
```

### `nhc generate`

`nhc.config.ts` を読み込み、Notion DB を introspect してスキーマファイルを生成する。

```bash
nhc generate [options]

Options:
  -c, --config <path>   設定ファイルのパス（デフォルト: nhc.config.ts）
  -t, --token <token>   Notion API トークン（省略時は NOTION_TOKEN 環境変数を使用）
```

## プロパティ型マッピング

| Notion プロパティ型 | TypeScript 型 | Zod | フィールド型 |
|---|---|---|---|
| `title` | `string \| null` | `z.string().nullable()` | `"title"` |
| `rich_text` | `string \| null` | `z.string().nullable()` | `"richText"` |
| `select` / `status` | `string \| null` | `z.string().nullable()` | `"select"` |
| `multi_select` | `string[]` | `z.array(z.string())` | `"multiSelect"` |
| `date` | `string \| null` | `z.string().nullable()` | `"date"` |
| `number` | `number \| null` | `z.number().nullable()` | `"number"` |
| `checkbox` | `boolean` | `z.boolean()` | `"checkbox"` |
| `url` | `string \| null` | `z.string().nullable()` | `"url"` |
| その他 | — | — | スキップ（コメント付き） |

### 自動検出ルール

`fields.*` で明示指定しない場合は以下のルールで自動検出する。

| フィールド | 自動検出の条件 |
|---|---|
| `slug` | `title` 型プロパティ（最初に見つかったもの） |
| `status` | プロパティ名が `Status` / `状態` / `state` の `select` または `status` 型 |
| `publishedAt` | プロパティ名が `PublishedAt` / `CreatedAt` / `公開日` 等の `date` 型 |

## 生成ファイルの構造

`nhc generate` が生成する `nhc-schema.ts` の概略:

```ts
// このファイルは nhc generate により自動生成されました。
import { z } from "zod";
import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";
import type { BaseContentItem } from "@notion-headless-cms/core";

// --- posts (ブログ記事DB) ---
export interface PostsItem extends BaseContentItem {
  title: string | null;
  tags: string[];
}

const _postsZodSchema = z.object({ ... });
const _postsMapping = defineMapping<PostsItem>({ ... });

export const postsSchema = defineSchema(_postsZodSchema, _postsMapping);
export const postsSourceId = "xxx-yyy-zzz";

// --- NHC Multi-Source Schema ---
export const nhcSchema = {
  posts: { id: postsSourceId, dbName: "ブログ記事DB", schema: postsSchema },
} as const;

export type NHCSchema = typeof nhcSchema;
```

> **`nhc-schema.ts` は編集不要**: `status` フィールドの `published` / `accessible` は生成ファイルに埋め込まれず、クライアント作成時の `sources` オプションで差し込む。`nhc generate` を再実行しても設定が失われない。

## 関連パッケージ

- [`@notion-headless-cms/adapter-node`](../adapter-node) — Node.js 向け `createNodeCMS`
- [`@notion-headless-cms/adapter-cloudflare`](../adapter-cloudflare) — Cloudflare Workers 向け `createCloudflareCMS`
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソースアダプタ
- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
