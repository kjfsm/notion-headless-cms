---
description: nhc CLI の慣行
paths:
  - "packages/cli/**"
---

# cli パッケージ（`nhc`）

## 基本方針

- `@notion-headless-cms/cms` を使うプロジェクト向けの補助 CLI。スキーマ本体は codegen ではなく
  TS ファースト（`defineCollection`/`defineSchema`）で書き、育てる運用
- `nhc.config.ts` は Notion 側の解決情報（DB 名/ID・fieldMappings）とファイルパスのみを持つ
- CLI の bin エントリは `dist/cli.mjs`（`bin.nhc`）

## 主要コマンド

| コマンド     | 用途                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `nhc init`   | `nhc.config.ts`・`wrangler.toml`・`src/schema.ts`・Hono マウントコード一式を生成               |
| `nhc pull`   | `collections` の各 DB を introspect し、`defineCollection` の雛形コードを `scaffoldDir` に出力 |
| `nhc check`  | `schemaModule` と実 Notion DB の drift を検証（CI 向け、`--json` 対応）                        |
| `nhc doctor` | binding 宣言・webhook secret・token 権限・同期状態・slug 重複を診断                            |
| `nhc sync`   | `schemaModule` の全コレクションをローカルファイルストアへ同期（初回 kick 経路）                |

## `nhc.config.ts` ヘルパー

- `defineConfig(config)` — 設定ヘルパー（型推論用）
- `env(name)` — Prisma 風、遅延評価。設定評価時には throw しない（各コマンド実行時に解決）
- `.dev.vars` を自動検出する

## 生成物のルール

- `nhc init`/`nhc pull` が生成するファイルは既存ファイルを上書きしない（生成物の所有権はユーザーに移る）
- **Claude は shadcn 生成ファイル等と同様、生成物を人力で書き換えたユーザーの意図を尊重し上書きしない**

## データベース解決

- `dataSourceId` と `dbName` の両方が指定可能
- `dbName` がある場合は Notion API で名前→ID を解決する（完全一致のみ）

## 実装上の注意

- Node.js 24+ 想定（`engines.node: ">=24"`）
- `verbatimModuleSyntax: true` に従い `import type` を使う
- CLI の出力は JSON ではなく人間向けに整形（`--json` 指定時のみ機械可読）

## エラー

`CMSError`（`@notion-headless-cms/cms`）の `cli/*` 名前空間で分類する:

- `cli/config_invalid` — `nhc.config.ts` の内容不整合
- `cli/schema_invalid` — スキーマ/マッピング不整合
- `cli/init_failed` — `nhc init` 処理失敗
- `cli/notion_api_failed` — Notion API 呼び出し失敗
- `cli/env_file_not_found` — `--env-file` 指定ファイルが存在しない

## テスト

- `src/__tests__/*.test.ts` — `check`/`doctor`/`pull`/`sync-command`/`scaffold`/`init` の純粋ロジック
- `src/commands/__tests__/*.test.ts` — 各コマンドのラッパー（config-loader・notion-client をモック）
- Notion API は `vi.mock("@notionhq/client")` でモック

## 変更時に連動して更新するもの

- `packages/cli/README.md`
- `docs/ja/cli.md`
- `examples/*/nhc.config.ts` が最新 API で動くか
