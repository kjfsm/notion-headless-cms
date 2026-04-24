---
description: nhc CLI の慣行
paths:
  - "packages/cli/**"
---

# cli パッケージ（`nhc`）

## 基本方針

- Prisma 風のスキーマ自動生成 CLI。利用側 DX を重視
- `nhc.config.ts` に書かれた設定から型安全な `nhcSchema.ts` を生成
- 生成物はアダプタ（`adapter-*`）にそのまま渡す
- CLI の bin エントリは git 管理のラッパースクリプト（`bin/nhc`）経由

## 主要コマンド

| コマンド | 用途 |
|---|---|
| `nhc init` | `nhc.config.ts` テンプレを生成 |
| `nhc generate` | Notion DB を introspect して `nhc-schema.ts` を生成 |
| `nhc generate --env-file <path>` | 任意の env ファイルから読み込み |

## `nhc.config.ts` ヘルパー

- `defineConfig(config)` — 設定ヘルパー（型推論用）
- `env(name)` — Prisma 風、遅延評価。設定評価時には throw しない（`nhc generate` 実行時に解決）
- `.dev.vars` を自動検出する

## 生成物のルール

- 出力ディレクトリは `nhc.config.ts` で指定（`output` フィールド必須）
- 生成物（`generated/` など）は `.gitignore` に追加
- **Claude は生成物を直接編集しない**（PreToolUse hook で block）

## データベース解決

- `dataSourceId` と `dbName` の両方が指定可能
- `dbName` がある場合は Notion API で名前→ID を解決する

## 型整合

- `NhcSchema` は `defineSchema` / `defineMapping` 経由で生成
- CLI は出力時にマルチソース対応の型を出す（各ソースが別のスキーマを持つ）

## 実装上の注意

- Node.js 24+ 想定（`engines.node: ">=24"`）
- `verbatimModuleSyntax: true` に従い `import type` を使う
- CLI の出力は JSON ではなく人間向けに整形（コード生成結果の要約を出す）
- `--env-file` は `fs.readFileSync` で KEY=VALUE 形式を読む

## エラー

- token 未設定: `CMSError code: "core/config_invalid"`
- Notion API 失敗: 原因を含む `CMSError`
- schema 不整合: `CMSError code: "core/schema_invalid"`

## テスト

- `__tests__/codegen.test.ts` — コード生成結果の snapshot 比較
- `__tests__/init.test.ts` — `nhc init` のテンプレ生成
- Notion API は `vi.mock("@notionhq/client")` でモック

## 変更時に連動して更新するもの

- `packages/cli/README.md`
- `docs/cli.md`
- `examples/*/nhc.config.ts` が最新 API で動くか
