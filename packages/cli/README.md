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

生成された `nhc-schema.ts` はそのまま `createCMS` に渡せる (編集不要)。

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({ ttlMs: 5 * 60_000 }),
  dataSources: cmsDataSources,
});

const posts = await cms.posts.getList();
```

## `nhc.config.ts`

`defineConfig()` で設定を定義し、`default export` する。
`env()` は遅延評価の環境変数ヘルパー。

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
    { name: "news", id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
  ],
  output: "./app/generated/nhc-schema.ts",
});
```

### `DataSourceConfig` オプション

| フィールド | 型 | 説明 |
|---|---|---|
| `name` | `string` | コード上で使う識別子 (`cms.posts` など) |
| `id` | `string` (任意) | Notion DB ID。指定時は `dbName` より優先 |
| `dbName` | `string` (`id` 未指定時は必須) | Notion DB 名 (完全一致で検索。一致しない場合は generate に失敗) |
| `fields.slug` | `string` (任意) | slug に使う Notion プロパティ名 |
| `fields.status` | `string` (任意) | status に使う Notion プロパティ名 |
| `fields.publishedAt` | `string` (任意) | publishedAt に使う Notion プロパティ名 |
| `fields.properties` | `Record<string, string>` (任意) | 日本語など ASCII 変換不能な Notion プロパティ名の明示マッピング |

## コマンド一覧

### `nhc init`

`nhc.config.ts` のテンプレートを生成。

```
Options:
  -o, --output <path>   出力先 (デフォルト: nhc.config.ts)
  -f, --force           既存ファイルを上書き
```

### `nhc generate`

`nhc.config.ts` を読み込み、Notion DB を introspect して `nhc-schema.ts` を生成。

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
| `title` | `string \| null` | `"title"` |
| `rich_text` | `string \| null` | `"richText"` |
| `select` / `status` | `string \| null` | `"select"` |
| `multi_select` | `string[]` | `"multiSelect"` |
| `date` | `string \| null` | `"date"` |
| `number` | `number \| null` | `"number"` |
| `checkbox` | `boolean` | `"checkbox"` |
| `url` | `string \| null` | `"url"` |
| その他 | — | スキップ (コメント付き) |

`fields.*` 省略時の自動検出:
- `slug` — `title` 型 (最初に見つかったもの)
- `status` — 名前が `Status` / `状態` / `state` の `select` / `status` 型
- `publishedAt` — 名前が `PublishedAt` / `CreatedAt` / `公開日` 等の `date` 型

## 生成ファイルの構造

```ts
// 自動生成 — 編集不要
import { z } from "zod";
import {
  createNotionCollection,
  defineMapping,
  defineSchema,
} from "@notion-headless-cms/notion-orm";
import type { BaseContentItem } from "@notion-headless-cms/core";
import { env } from "@notion-headless-cms/cli";

export interface PostsItem extends BaseContentItem { /* ... */ }
export const postsSchema = defineSchema(/* ... */);
export const postsSourceId = "xxx-yyy-zzz";

export const cmsDataSources = {
  posts: createNotionCollection({
    token: env("NOTION_TOKEN"),
    dataSourceId: postsSourceId,
    schema: postsSchema,
  }),
} as const;
export type CMSDataSources = typeof cmsDataSources;
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

- [`@notion-headless-cms/core`](../core) — `createCMS` / `nodePreset`
- [`@notion-headless-cms/cache-r2`](../cache-r2) — `cloudflarePreset`
- [`@notion-headless-cms/notion-orm`](../notion-orm) — 内部 ORM (private)
