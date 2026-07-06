---
title: CLI ツール (nhc)
description: nhc init/pull/check/doctor/sync のガイド
category: ガイド
order: 2
---

# CLI ツール（nhc）

`@notion-headless-cms/cli` は `@notion-headless-cms/cms` を使うプロジェクト向けの補助 CLI。

現行アーキテクチャ（v3, `packages/cms`）はスキーマ本体を codegen ではなく **TypeScript ファースト**（`defineCollection`/`defineSchema`）で書き、育てる運用にしている。CLI は「Notion DB を introspect して雛形コードを出す」「TS スキーマと実 DB の drift を検証する」「binding や同期状態を診断する」という橋渡し役に徹し、スキーマそのものを生成し続けることはしない。

## インストール

```bash
pnpm add -D @notion-headless-cms/cli
```

## ワークフロー概要

```
nhc init    →  nhc.config.ts・wrangler.toml・src/schema.ts・Hono マウントコード一式を生成
↓ （wrangler.toml の binding、schema.ts の dataSourceId、nhc.config.ts の dbName を実値に差し替え）
nhc pull    →  Notion DB を introspect し、defineCollection の雛形を scaffoldDir に出力
↓ （雛形を見ながら schema.ts を仕上げる。以降は手で育てる）
nhc check   →  schema.ts と実 Notion DB の drift を検証（CI に組み込む）
nhc doctor  →  binding・webhook secret・token・同期状態・slug 重複を診断
nhc sync    →  ローカルファイルストアへの同期を手動 kick（初回動作確認用）
```

## `nhc init` — プロジェクト一式の生成

```bash
npx nhc init
```

カレントディレクトリに `nhc.config.ts` に加え、`wrangler.toml`・`src/schema.ts`・Hono マウントコード一式（`src/lib/do.ts`・`src/lib/cms.ts`・`src/index.ts`）を生成する。`examples/cloudflare-hono` と同じ配線（読者用 stateless Worker + Notion 同期を担う Durable Object）を再現する、実働可能なフルスタック雛形になっている。

```
Options:
  -o, --output <path>    nhc.config.ts の出力先 (デフォルト: nhc.config.ts)
  -f, --force            既存ファイルを上書き
```

既存ファイルは上書きしない（生成物の所有権はユーザーに移る）。同じ理由で `nhc init` を再実行しても、書き換え済みのファイルは壊れない。作り直したい場合のみ `--force` を付ける。

生成される `wrangler.toml` には KV namespace（既定 binding 名 `DOC_INDEX`）・R2 bucket（`ENTRY_BUCKET`）・Durable Object（`SyncCoordinatorDO` / binding `SYNC_COORDINATOR`）・日次 cron trigger が一通り雛形として入る。`REPLACE_WITH_...` になっている ID / bucket 名を実際の値に差し替える。

生成される `src/schema.ts` は最小の `posts` コレクション 1 つだけを持つ雛形。`dataSourceId` は `REPLACE_WITH_DATA_SOURCE_ID` のプレースホルダになっているため、対象 DB を用意してから `nhc pull` で実プロパティに合わせて仕上げるか、手で `dataSourceId` を書き換える。

## `nhc.config.ts` の設定

`defineConfig()` で設定を定義し、`default export` する。

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

### `notionToken` / `env()`

`env(name)` は Prisma の `env()` と同じ発想の遅延評価ヘルパー。設定を評価した時点では値を解決せず throw もしない。各コマンド実行時にトークンが無ければ初めてエラーになる。`.dev.vars` を自動検出するため、Cloudflare Workers プロジェクトでも追加設定なしで動く。

優先順位は次の通り。

1. `--env-file <path>` で明示指定したファイル
2. `process.env`
3. `.dev.vars`（カレントディレクトリ）

### `CollectionSourceConfig`

| フィールド | 必須 | 説明 |
|---|---|---|
| `dbName` | (`databaseId` 未指定時) | Notion DB 名（完全一致で検索） |
| `databaseId` | (`dbName` 未指定時) | Notion DB ID（指定時は `dbName` より優先） |
| `fieldMappings` | – | `{ Notion プロパティ名: TS フィールド名 }` の明示マッピング |

## `nhc pull` — DB を introspect して雛形を出力

```bash
NOTION_TOKEN=secret_xxx npx nhc pull
```

`nhc.config.ts` の `collections` の各 DB を introspect し、`defineCollection` の雛形 TS コードを `scaffoldDir`（既定 `src/collections`）に出力する。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル (未指定なら .dev.vars 自動検出)
  --scaffold-dir <path>     雛形の出力先ディレクトリ (既定: scaffoldDir または src/collections)
  -s, --silent              ログ抑制
```

既存ファイルは上書きしない。`nhc init`/`nhc pull` の生成物はいずれも一度作ったら手で育てていくものという扱いで、ライブラリ側が黙って上書きすることはない。

### プロパティ型のマッピング

| Notion プロパティ型 | 生成される呼び出し |
|---|---|
| `title` | `prop.title()` |
| `rich_text` | `prop.richText()` |
| `select` | `prop.select([...options] as const)` |
| `status` | `prop.status([...options] as const)` |
| `multi_select` | `prop.multiSelect([...options] as const)` |
| `date` | `prop.date()` |
| `number` | `prop.number()` |
| `checkbox` | `prop.checkbox()` |
| `url` | `prop.url()` |
| `formula` / `rollup` | `prop.formula("string", ...)` / `prop.rollup("string", ...)`（結果型を確認するコメント付き） |
| `relation` / `people` / `files` / `unique_id` / `created_time` / `last_edited_by` | 対応する `prop.*()` |
| それ以外の未対応型 | コメントアウトされた行として出力（手動対応を促す） |

### 識別子の自動変換と非 ASCII フォールバック

Notion プロパティ名は camelCase の TS 識別子に自動変換される（例: `"公開日時"` のような ASCII に変換できない名前を除く）。`fieldMappings` で明示していないプロパティが対象。

非 ASCII のみで構成される名前（日本語プロパティ名など）は正規化すると空文字列になるため、プロパティ種別ベースのフォールバック識別子（`unnamedTitle` / `unnamedRichText` / `unnamedSelect` / `unnamedStatus` / `unnamedMultiSelect` / `unnamedDate` / `unnamedNumber` / `unnamedCheckbox` / `unnamedUrl` など）に自動フォールバックする。同じフォールバック名が複数プロパティで衝突する場合は連番（`unnamedSelect2` など）が付く。

生成された識別子が実際の Notion プロパティ名と異なる場合（`fieldMappings` 指定時・非 ASCII フォールバック時・大文字小文字違いなど）は、`prop.*()` の末尾引数に実名が自動で渡される（`prop.title("名前")` のように）。これが `packages/cms` 側の別名解決の仕組みで、スキーマのキー名と Notion 側の表示名を分離できる。

```ts
// 生成例（fieldMappings 未指定・日本語プロパティ名のみの DB）
export const posts = defineCollection({
  dataSourceId: "abc-123-def-456",
  slug: "unnamedRichText",
  properties: {
    /** 元のプロパティ名: "名前" */
    unnamedTitle: prop.title("名前"),
    /** 元のプロパティ名: "URL" */
    unnamedRichText: prop.richText("URL"),
  },
});
```

`fieldMappings` を先に書いておけば、こうした読みにくい `unnamed*` 系の識別子ではなく意図した名前（`title`/`slug` 等）で生成される。

## `nhc check` — スキーマと実 DB の drift 検証

```bash
NOTION_TOKEN=secret_xxx npx nhc check --json
```

`schemaModule` で指定した TS スキーマファイルを読み込み、実 Notion DB との drift を検証する。検出できる drift の種類:

| `kind` | 意味 |
|---|---|
| `added` | Notion 側に新しいプロパティが増えた（スキーマ未定義） |
| `removed` | スキーマにあるプロパティが Notion 側から無くなった |
| `type_changed` | プロパティの型が変わった（例: `select` → `multi_select`） |
| `options_changed` | `select`/`status`/`multi_select` の選択肢が追加・削除・変更された |

drift が 1 件でもあれば非ゼロ終了する（CI 向け）。`fieldMappings` は `nhc pull` と同じ解決順（`fieldMappings` → 自動識別子 → 実名そのまま）で照合キーを決定するため、DB 側の表示名を変えても `fieldMappings` を直すだけで追随できる。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル
  --json                    機械可読な JSON で結果を出力
  -s, --silent              ログ抑制
```

CI では `npx nhc check --json` の終了コードで drift の有無を判定し、`--json` の出力を PR コメント等に転記する運用が想定されている。

## `nhc doctor` — 稼働環境の診断

```bash
npx nhc doctor
```

binding 宣言（`wrangler.toml`）・webhook secret・token 権限・同期状態・slug 重複を診断し、`ok` / `warn` / `error` のステータス付きチェック結果を出す。

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

チェック項目:

- **KV binding** / **R2 binding** / **Durable Object binding** — `wrangler.toml` に必要な binding が揃っているか（欠けていれば `error`）
- **Webhook secret** — 未設定なら `warn`（反映が差分ポーリング頼みになり遅延するため）
- **Notion token** — `--stats-url` 等から到達できる場合に有効性を検証。検証できない場合は `warn`
- **同期失敗** — 直近の同期失敗件数（`--stats-url` の同期統計から取得。1 件以上で `warn`）
- **slug 重複** — コレクション内で同じ slug を持つエントリが無いか（重複があれば `error`）

`--stats-url` にデプロイ済み Worker の統計エンドポイント（`cms.fetch()` が配信する同期統計 API）を渡すと、token 検証・同期失敗チェックの精度が上がる。省略時はローカルで判定できる範囲（binding 宣言・slug 重複等）のみ診断する。

## `nhc sync` — ローカル同期の手動 kick

```bash
npx nhc sync
```

`schemaModule` の全コレクションをローカルファイルストア（`cacheDir`）へ同期する。動作確認・初回の疎通確認のための経路で、KV/R2 への実書き込みは行わない。CLI プロセス内で `cursor` が尽きるまで同期をループ実行し、完了してからプロセスを終了する（Worker 側の chunked sync のような自己継続待ちはしない）。

```
Options:
  -c, --config <path>       設定ファイルパス (デフォルト: nhc.config.ts)
  -t, --token <token>       Notion API トークン (省略時は NOTION_TOKEN)
  --env-file <path>         任意の env ファイル
  --cache-dir <path>        マテリアライズ先のローカルディレクトリ (デフォルト: .nhc-cache)
  --json                    機械可読な JSON で結果を出力
  -s, --silent              ログ抑制
```

## 共通オプション

すべてのコマンドは `--verbose`（詳細ログ）・`--debug`（スタックトレース）を共通でサポートする。

```bash
npx nhc pull
npx nhc check --json
npx nhc doctor
npx nhc sync --verbose
```

## エラーコード

CLI が throw するエラーは `CMSError`（`@notion-headless-cms/cms`）の `cli/*` 名前空間で分類される。詳細は [エラーコード一覧](./errors/index.md#cli) を参照。

- `cli/config_invalid` — `nhc.config.ts` の内容不整合
- `cli/schema_invalid` — スキーマ/マッピング不整合
- `cli/init_failed` — `nhc init` 処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` 指定ファイルが存在しない

`isCMSErrorInNamespace(err, "cli/")` で分岐できる。

## 関連ドキュメント

- [クイックスタート](./quickstart.md)
- [エラーコード一覧](./errors/index.md)
- [`packages/cli/README.md`](../../packages/cli/README.md) — パッケージ本体の簡潔なリファレンス
