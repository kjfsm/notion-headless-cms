# @notion-headless-cms/cli

`@notion-headless-cms/cms` を使うプロジェクトのための CLI ツール。Notion データベースを introspect して `defineCollection` の雛形コードを生成したり、TS スキーマと実 Notion DB の差分(drift)を検証したりする。

スキーマ本体は codegen ではなく TS ファースト(`defineCollection`/`defineSchema`)で書き、育てる運用。CLI はその橋渡し役に徹する。

## インストール

```bash
pnpm add -D @notion-headless-cms/cli
```

## クイックスタート

```bash
# 1. nhc.config.ts・wrangler.toml・src/schema.ts・Hono マウントコード一式を生成
npx nhc init

# 2. wrangler.toml の KV/R2/DO binding、src/schema.ts の dataSourceId、
#    nhc.config.ts の collections.posts.dbName を実際の値に差し替える

# 3. binding・token・slug 重複を診断
NOTION_TOKEN=secret_xxx npx nhc doctor
```

## `nhc.config.ts`

`defineConfig()` で設定を定義し、`default export` する。`env()` は遅延評価の環境変数ヘルパー。

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  schemaModule: "src/schema.ts", // nhc check が読む、ユーザーが書いた TS スキーマ
  scaffoldDir: "src/collections", // nhc pull の出力先。既定 "src/collections"
  collections: {
    posts: {
      dbName: "ブログ記事DB", // または { databaseId: "..." }
      // 日本語などのプロパティ名は明示マッピングしておくと nhc pull の出力が
      // 読みやすい識別子になり、nhc check の照合にも使われる
      fieldMappings: { 名前: "title", URL: "slug", ステータス: "status" },
    },
  },
});
```

### `CollectionSourceConfig` オプション

| フィールド | 必須 | 説明 |
|---|---|---|
| `dbName` | (`databaseId` 未指定時) | Notion DB 名（完全一致で検索） |
| `databaseId` | (`dbName` 未指定時) | Notion DB ID（指定時は `dbName` より優先） |
| `fieldMappings` | – | `{ Notion プロパティ名: TS フィールド名 }` の明示マッピング |

## コマンド一覧

### `nhc init`

`nhc.config.ts` に加え、`wrangler.toml`・`src/schema.ts`・Hono マウントコード一式(`src/lib/do.ts`・`src/lib/cms.ts`・`src/index.ts`)を生成する。既存ファイルは上書きしない（生成物の所有権はユーザーに移る）。

```
Options:
  -o, --output <path>    nhc.config.ts の出力先 (デフォルト: nhc.config.ts)
  -f, --force            既存ファイルを上書き
```

### `nhc pull`

`nhc.config.ts` の `collections` の各 DB を introspect し、`defineCollection` の雛形 TS コードを `scaffoldDir` に出力する。既存ファイルは上書きしない。`fieldMappings` に無いプロパティは ASCII 識別子へ自動変換される（非 ASCII 名は `unnamedTitle` のような種別ベースの識別子にフォールバック）。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル (未指定なら .dev.vars 自動検出)
  --scaffold-dir <path>     雛形の出力先ディレクトリ (既定: scaffoldDir または src/collections)
  -s, --silent              ログ抑制
```

### `nhc check`

`schemaModule` のスキーマと実 Notion DB との drift（プロパティ追加・削除・型変更・options 変更）を検証する。drift があれば非ゼロ終了する（CI 向け）。`--json` で機械可読な出力も可能。`fieldMappings` は `nhc pull` と同じ解決順で照合に使われる。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル
  --json                    機械可読な JSON で結果を出力
  -s, --silent              ログ抑制
```

### `nhc doctor`

binding 宣言(wrangler.toml)・webhook secret・token 権限・同期状態・slug 重複を診断する。

```
Options:
  -c, --config <path>          設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>          Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>            任意の env ファイル
  --wrangler-config <path>     wrangler 設定ファイルのパス (デフォルト: wrangler.toml)
  --stats-url <url>            デプロイ済み Worker の同期統計エンドポイント URL (任意)
  --json                       機械可読な JSON で結果を出力
  -s, --silent                 ログ抑制
```

### `nhc sync`

`schemaModule` の全コレクションをローカルファイルストア(`cacheDir`)へ同期する（初回 kick 経路）。KV/R2 への実書き込みは行わない。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル
  --cache-dir <path>        マテリアライズ先のローカルディレクトリ (デフォルト: .nhc-cache)
  --json                    機械可読な JSON で結果を出力
  -s, --silent              ログ抑制
```

すべてのコマンドは `--verbose`（詳細ログ）・`--debug`（スタックトレース）を共通でサポートする。

```bash
npx nhc pull
npx nhc check --json
npx nhc doctor
```

詳細は [`docs/ja/cli.md`](../../docs/ja/cli.md) を参照。

## エラーコード

CLI が throw するエラーは `CMSError`（`@notion-headless-cms/cms`）の `cli/*` 名前空間で分類される:

- `cli/config_invalid` — `nhc.config.ts` の内容不整合
- `cli/schema_invalid` — スキーマ/マッピング不整合
- `cli/init_failed` — `nhc init` 処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` 指定ファイルが存在しない

## 関連パッケージ

- [`@notion-headless-cms/cms`](../cms) — `createCMS`/`defineCollection`/`defineSchema`
