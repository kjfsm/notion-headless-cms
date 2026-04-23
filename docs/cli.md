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
createCMS({ ...nodePreset() | ...cloudflarePreset({ env }), dataSources: cmsDataSources })
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
  -s, --silent          ログ出力を抑制する
```

生成されるテンプレート:

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
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
  output: "./app/generated/nhc-schema.ts",
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
  -c, --config <path>    設定ファイルのパス（デフォルト: nhc.config.ts）
  -t, --token <token>    Notion API トークン（省略時は NOTION_TOKEN 環境変数）
  --env-file <path>      任意の env ファイルから読み込み（未指定なら .dev.vars を自動検出）
  -s, --silent           ログ出力を抑制する
```

Notion インテグレーショントークンの取得: [Notion Developers](https://www.notion.so/my-integrations)

> Notion インテグレーションに対象 DB への「コンテンツの読み取り」権限が必要。DB の「接続先」からインテグレーションを追加すること。

## `nhc.config.ts` の設定

### `DataSourceConfig`

データソースは2種類の指定方法がある。

#### DB 名で解決（推奨）

```ts
{
  name: "posts",           // コード上の識別子
  dbName: "ブログ記事DB",  // Notion の DB 名（検索に使用）
}
```

#### ID で直接指定

```ts
{
  name: "posts",
  id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  dbName: "ブログ記事DB", // 任意（生成ファイルのコメント用）
}
```

`id` を指定した場合は `dbName` での検索をスキップするため、同名の DB が複数存在する場合や DB 名変更に強い。

### `fields` — フィールドのマッピング指定

```ts
fields: {
  slug: "Slug",          // slug に使うプロパティ名
  status: "Status",      // status に使うプロパティ名
  publishedAt: "公開日", // publishedAt に使うプロパティ名
  // 日本語など ASCII 変換できないプロパティ名は必須指定
  properties: {
    "タイトル": "title",
    "カテゴリ": "category",
  },
}
```

`fields` を省略した場合は自動検出ルールが適用される（後述）。

### `notionToken` / `env()`

`notionToken` は CLI が Notion API を叩く際のトークン。遅延評価ヘルパー `env("NAME")` を渡すのが推奨。

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  dataSources: [/* ... */],
  output: "./app/generated/nhc-schema.ts",
});
```

`env()` は `process.env[name]` を評価するが、設定評価時には throw せず、`nhc generate` 実行時にトークン不在ならエラーになる。`.dev.vars` を自動検出するため Cloudflare Workers プロジェクトでも追加設定不要。

### 複数 DB の設定例

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
    {
      name: "news",
      id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      fields: { slug: "Title", status: "公開状態" },
    },
    {
      name: "members",
      dbName: "メンバーDB",
      fields: {
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
fields: {
  properties: {
    "タイトル": "title",
    "カテゴリ": "category",
    "公開日時": "publishedAt",
  },
}
```

自動変換できないプロパティに `fields.properties` の指定がない場合:

```
CMSError [cli/schema_invalid]: [posts] プロパティ "タイトル" は TypeScript 識別子に自動変換できません。
  → nhc.config.ts の fields.properties に追加してください:
     properties: { "タイトル": "フィールド名" }
```

## 生成ファイルの構造

`nhc generate` が生成する `nhc-schema.ts` は以下の構造になる（概要）。

```ts
// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
import { z } from "zod";
import {
  createNotionCollection,
  defineMapping,
  defineSchema,
} from "@notion-headless-cms/notion-orm";
import type { BaseContentItem } from "@notion-headless-cms/core";
import { env } from "@notion-headless-cms/cli";

// -------------------------------------
// posts  (ブログ記事DB)
// -------------------------------------
export interface PostsItem extends BaseContentItem { /* ... */ }
export const postsSchema = defineSchema(/* ... */);
export const postsSourceId = "abc-123-def-456";

// -------------------------------------
// CMS DataSources
// -------------------------------------
export const cmsDataSources = {
  posts: createNotionCollection({
    token: env("NOTION_TOKEN"),
    dataSourceId: postsSourceId,
    schema: postsSchema,
  }),
} as const;
export type CMSDataSources = typeof cmsDataSources;
```

### 生成ファイルは編集不要

生成した `nhc-schema.ts` は **触らなくてよい**。`published` / `accessible` は
`createCMS` のコレクションレベルオプションではなく、`nhc.config.ts` の
`fields` + 生成された schema で定義される。

## CMS クライアントでの利用

生成した `cmsDataSources` を `createCMS` にそのまま渡す。

```ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({ ttlMs: 5 * 60_000 }),
  dataSources: cmsDataSources,
});

// posts は CollectionClient<PostsItem> として推論される
const posts = await cms.posts.getList();
const post = await cms.posts.getItem("my-post-slug");
```

Cloudflare Workers の場合:

```ts
import { createCMS } from "@notion-headless-cms/core";
import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
import { cmsDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  ...cloudflarePreset({ env }),
  dataSources: cmsDataSources,
});
```

詳細は [マルチソースレシピ](./recipes/multi-source.md) と [Cloudflare Workers レシピ](./recipes/cloudflare-workers.md) を参照。

## 環境変数

| 変数名 | 説明 |
|---|---|
| `NOTION_TOKEN` | Notion インテグレーションのシークレットキー（必須） |

`nhc generate` は DB の書き込みを一切行わない。読み取り専用で動作する。

## エラーコード

CLI が throw するエラーは `CMSError` の `cli/*` 名前空間で分類される:

- `cli/config_invalid` — `nhc.config.ts` の内容不整合
- `cli/config_load_failed` — 設定ファイル読み込み失敗
- `cli/schema_invalid` — スキーマ/マッピング不整合 (生成時の検証エラー)
- `cli/generate_failed` — `nhc generate` の処理失敗
- `cli/init_failed` — `nhc init` の処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` で指定されたファイルが存在しない

`isCMSErrorInNamespace(err, "cli/")` で分岐できる。
