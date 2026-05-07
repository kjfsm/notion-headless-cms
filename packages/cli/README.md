# @notion-headless-cms/cli

Notion データベースを introspect して TypeScript スキーマファイルを自動生成する CLI ツール。Prisma の `prisma db pull` に相当するワークフローを Notion に対して実現する。

## インストール

```bash
pnpm add -D @notion-headless-cms/cli
```

## クイックスタート

```bash
# 1. 設定ファイルのテンプレートを生成
npx nhc init

# 2. nhc.config.ts を編集（DB 名 / ID を設定）

# 3. Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc.schema.ts` には DB 構造（`schema` 定数）だけが入る。`@notion-headless-cms/notion-source` の `notionSource()` に渡して `createClient` を組み立てる:

```ts
import { createClient, memoryCache } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

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
  swr: { ttlMs: 5 * 60_000 },
});

const posts = await cms.posts.list();
```

## `nhc.config.ts`

`defineConfig()` で設定を定義し、`default export` する。`env()` は遅延評価の環境変数ヘルパー。

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "src/generated/nhc.schema.ts",
  collections: {
    posts: {
      dbName: "ブログ記事DB",
      // databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // dbName の代わりに直接指定可
      publishedStatuses: ["公開済み"],
      accessibleStatuses: ["下書き", "公開済み"],
      // slugField: "slug",     // デフォルト "slug"
      // statusField: "status", // デフォルト "status"
      // 日本語など ASCII 変換不能なプロパティ名は明示マッピング必須
      // fieldMappings: { "タイトル": "title", "カテゴリ": "category" },
    },
  },
});
```

> **注意**: `publishedStatuses` / `accessibleStatuses` は `nhc.config.ts` に書いても**生成ファイルには埋め込まれない**。生成物は DB 構造（`schema`）のみを持ち、ランタイムの公開ステータスは `notionSource({ publishOptions })` で指定する。`nhc.config.ts` に書く意義は「設定を一元管理する備忘録」のみ。

### `CollectionGenConfig` オプション

| フィールド | 必須 | 説明 |
|---|---|---|
| `dbName` | (`databaseId` 未指定時) | Notion DB 名（完全一致で検索） |
| `databaseId` | (`dbName` 未指定時) | Notion DB ID（指定時は `dbName` より優先） |
| `slugField` | – | slug に使う TS フィールド名（デフォルト `"slug"`） |
| `statusField` | – | status に使う TS フィールド名（デフォルト `"status"`） |
| `publishedStatuses` | – | `notionSource({ publishOptions })` への移行用メモ |
| `accessibleStatuses` | – | 同上 |
| `fieldMappings` | – | `{ Notion プロパティ名: TS フィールド名 }` の明示マッピング |

## コマンド一覧

### `nhc init`

`nhc.config.ts` のテンプレートを生成。

```
Options:
  -o, --output <path>   出力先 (デフォルト: nhc.config.ts)
  -f, --force           既存ファイルを上書き
```

### `nhc generate`

`nhc.config.ts` を読み込み、Notion DB を introspect して `nhc.schema.ts` を生成。

```
Options:
  -c, --config <path>    設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>    Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>      任意の env ファイル (未指定なら .dev.vars 自動検出)
  -s, --silent           ログ抑制
```

## プロパティ型マッピング

| Notion | TypeScript | フィールド型 |
|---|---|---|
| `title` | `string \| null`（`slugField` 指定時は `string`） | `"title"` |
| `rich_text` | `string \| null` | `"richText"` |
| `select` | `string \| null` | `"select"` |
| `status` | `"値1" \| "値2" \| ... \| null`（literal union） | `"status"` |
| `multi_select` | `string[]` | `"multiSelect"` |
| `date` | `string \| null` | `"date"` |
| `number` | `number \| null` | `"number"` |
| `checkbox` | `boolean` | `"checkbox"` |
| `url` | `string \| null` | `"url"` |
| その他 | — | スキップ（コメント付き） |

## 生成ファイルの構造

```ts
// 自動生成 — 編集不要
import type { PropertyMap } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";

export const postsDataSourceId = "xxx-yyy-zzz";

export const postsProperties = {
  slug: { type: "richText" as const, notion: "URL" },
  status: { type: "status" as const, notion: "ステータス" },
  // ...
} as const satisfies PropertyMap;

export interface Post {
  id: string;
  lastEditedTime: string;
  slug: string;
  status: "公開済み" | "下書き" | null;
  // ...
}

// 全コレクションのスキーマ集約 (notionSource() に渡す)
export const schema = {
  posts: {
    dataSourceId: postsDataSourceId,
    properties: postsProperties,
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;
```

## エラーコード

CLI が throw するエラーは `CMSError` の `cli/*` 名前空間で分類される:

- `cli/config_invalid` — `nhc.config.ts` の内容不整合
- `cli/config_load_failed` — 設定ファイル読み込み失敗
- `cli/schema_invalid` — スキーマ/マッピング不整合
- `cli/generate_failed` — `nhc generate` 処理失敗
- `cli/init_failed` — `nhc init` 処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` 指定ファイルが存在しない

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — `createClient`
- [`@notion-headless-cms/notion-source`](../notion-source) — 生成された `schema` を消費する Notion アダプター
- [`@notion-headless-cms/notion-orm`](../notion-orm) — `notion-source` 内部の Notion ORM 層
