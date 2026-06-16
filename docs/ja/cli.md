---
title: CLI ツール (nhc)
description: スキーマ生成と運用の CLI ガイド
category: ガイド
order: 2
---

# CLI ツール（nhc）

`@notion-headless-cms/cli` は Notion データベースを introspect して TypeScript スキーマファイルを自動生成する CLI ツール。Prisma の `prisma db pull` に相当するワークフローを Notion に対して実現する。

## インストール

```bash
pnpm add -D @notion-headless-cms/cli
```

## ワークフロー概要

```
nhc init          →  nhc.config.ts テンプレートを生成
↓ （DB 名 / ID を設定）
nhc generate      →  Notion DB を introspect して nhc.schema.ts を生成（DB 構造のみ）
↓
createClient({ sources: { notion: notionSource({ schema, token, publishOptions }) }, cache, ... })
```

## `nhc init` — 設定ファイルの生成

```bash
npx nhc init
```

カレントディレクトリに `nhc.config.ts` のテンプレートを生成する。

```
オプション:
  -o, --output <path>    出力先ファイルパス（デフォルト: nhc.config.ts）
  -t, --template <name>  ランタイム別テンプレート（デフォルト: node）
  -f, --force            既存ファイルを上書きする
  -s, --silent           ログ出力を抑制する
```

### `--template` でランタイムに合わせる

`--template` を指定すると、ランタイムに合った `output` パスと「次のステップ」（追加すべき依存・
binding・対応する example への導線）を出力する。

| テンプレート | 想定 | `output` |
|---|---|---|
| `node`（既定） | Node.js (Express / Hono など) | `src/generated/nhc.schema.ts` |
| `cloudflare-react-router` | Workers + React Router v7 | `./app/generated/nhc.ts` |
| `cloudflare-hono` | Workers + Hono | `./src/generated/nhc.ts` |
| `next` | Next.js App Router | `./app/generated/nhc.ts` |

```bash
npx nhc init --template cloudflare-react-router
# → app/generated/nhc.ts 向けの config と、CF Workers + RR のセットアップ手順を表示
```

> フルスタックの雛形（ルート・`wrangler.toml`・`workers/app.ts` など）が欲しい場合は、対応する
> `examples/*` をコピーするのが早い。`--template` はその入口（config と手順）を用意する。

生成されるテンプレート:

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "src/generated/nhc.schema.ts",
  collections: {
    posts: {
      // dbName で Notion DB を検索して ID を自動解決します
      dbName: "ブログ記事DB",
      // databaseId を直接指定することもできます (databaseId が優先されます)
      // databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      publishedStatuses: ["公開済み"],
      // accessibleStatuses: ["下書き", "公開済み"],
      // slugField: "slug",     // デフォルト
      // statusField: "status", // デフォルト
      // 日本語など ASCII 変換できないプロパティ名は明示マッピング必須
      // fieldMappings: { "タイトル": "title", "カテゴリ": "category" },
    },
  },
});
```

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

### `CollectionGenConfig`

```ts
collections: {
  posts: {
    dbName: "ブログ記事DB",            // Notion DB 名（完全一致）
    // databaseId: "xxx-yyy-zzz",     // dbName の代わりに直接指定可
    // kind: "page",                  // 既定。URL ルーティングするページ
    publishedStatuses: ["公開済み"],   // 備忘録（生成物には埋め込まれない）
    accessibleStatuses: ["下書き", "公開済み"],
    slugField: "slug",                // デフォルト "slug"
    statusField: "status",            // デフォルト "status"
    fieldMappings: { "タイトル": "title" }, // 日本語プロパティの明示マッピング
  },
}
```

> **重要**: `publishedStatuses` / `accessibleStatuses` を `nhc.config.ts` に書いても、生成ファイルには埋め込まれない（DB 構造のみが出力される）。実際の公開ステータスは `notionSource({ publishOptions })` で指定する。

### ページコレクションと要素（データ）コレクション（`kind`）

コレクションには 2 種類ある。

| `kind` | 用途 | クライアント API | slug |
|---|---|---|---|
| `"page"`（既定） | URL ルーティングする記事・固定ページ | `find(slug)` / `list()` / `params()` / 本文（`html()` 等） | 必須（`slugField`） |
| `"data"` | URL を持たない要素（設定値一覧・選択肢リストなど） | `list()` / `get(id)` / `cache.invalidate()` のみ | 不要 |

```ts
collections: {
  posts: { dbName: "ブログ記事DB" },              // kind: "page"（既定）
  settings: { dbName: "サイト設定DB", kind: "data" }, // URL を持たない要素
}
```

- 要素コレクションは Notion DB に slug プロパティを用意する必要がない。`cms.settings.list()` で全件、`cms.settings.get(id)` で 1 件取得する。
- 生成されるアイテム型から `slug` は除去されるため、`cms.settings.find(...)` / `.params()` / `item.slug` はコンパイルエラーになる（ページとの誤用を型で防ぐ）。
- 内部のキャッシュ identity はページが slug、要素が Notion ページ ID。
- Notion DB の表示名は `await cms.settings.getDbName()` で取得できる（ページコレクションも同様に `await cms.posts.getDbName()`）。schema には埋め込まず、初回呼び出し時に Notion API で `data_source` を取得して解決し、以降はキャッシュした値を返す。手書き schema で `dbName` を明示した場合はその値を返し API を叩かない。DataSource が未対応の場合は `undefined`。

### `notionToken` / `env()`

`notionToken` は CLI が Notion API を叩く際のトークン。遅延評価ヘルパー `env("NAME")` を渡すのが推奨。

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  collections: { /* ... */ },
  output: "src/generated/nhc.schema.ts",
});
```

`env()` は `process.env[name]` を評価するが、設定評価時には throw せず、`nhc generate` 実行時にトークン不在ならエラーになる。`.dev.vars` を自動検出するため Cloudflare Workers プロジェクトでも追加設定不要。

### 複数 DB の設定例

```ts
import "dotenv/config";
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  output: "src/generated/nhc.schema.ts",
  collections: {
    posts: { dbName: "ブログ記事DB", publishedStatuses: ["公開済み"] },
    news: {
      databaseId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      publishedStatuses: ["公開済み"],
    },
    members: {
      dbName: "メンバーDB",
      fieldMappings: { 氏名: "fullName", 所属: "department" },
    },
  },
});
```

## プロパティ型マッピング

| Notion プロパティ型 | TypeScript 型 | フィールド型 |
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
| それ以外 | — | スキップ（コメント付きで記録） |

> `select` 型はユーザーが自由に選択肢を追加できるため `string | null` のままにする。`status` 型（ワークフロー状態）のみ literal union を生成する。

### 日本語プロパティ名の扱い

ASCII に変換できないプロパティ名（日本語など）は `fieldMappings` で TypeScript フィールド名を明示する必要がある。未指定の場合はエラーになる。

```ts
fieldMappings: {
  "タイトル": "title",
  "カテゴリ": "category",
  "公開日時": "publishedAt",
}
```

## 生成ファイルの構造

`nhc generate` が生成する `nhc.schema.ts` は以下の構造になる。

```ts
// このファイルは nhc generate により自動生成されました。手動編集は nhc generate で上書きされます。
import type { PropertyMap } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";

// =============================================================
// posts  (ブログ記事DB)
// Notion DB ID: abc-123-def-456
// =============================================================

export const postsDataSourceId = "abc-123-def-456";

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

// =============================================================
// Schema 集約 (notionSource() に渡す)
// =============================================================
export const schema = {
  posts: {
    dataSourceId: postsDataSourceId,
    properties: postsProperties,
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;
```

### 生成ファイルは編集不要

生成した `nhc.schema.ts` は **触らなくてよい**。ランタイム設定（トークン・公開ステータス・キャッシュ等）はすべて `createClient` 側で組み立てる。

## CMS クライアントでの利用

生成した `schema` を `notionSource()` に渡し、`createClient({ sources })` で組み込む。

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

// posts は CollectionClient<Post> として推論される
const posts = await cms.posts.list();
const post = await cms.posts.find("my-post-slug");
```

Cloudflare Workers の場合:

```ts
import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cms = createClient({
      sources: {
        notion: notionSource({
          schema,
          token: env.NOTION_TOKEN,
          publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
        }),
      },
      cache: cloudflareCache(env),
    });
    return Response.json(await cms.posts.list());
  },
};
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
- `cli/schema_invalid` — スキーマ/マッピング不整合（生成時の検証エラー）
- `cli/generate_failed` — `nhc generate` の処理失敗
- `cli/init_failed` — `nhc init` の処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` で指定されたファイルが存在しない

`isCMSErrorInNamespace(err, "cli/")` で分岐できる。
