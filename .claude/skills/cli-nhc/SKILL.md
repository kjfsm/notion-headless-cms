---
name: cli-nhc
description: nhc CLI (@notion-headless-cms/cli) の実装慣行。init / generate / defineConfig / env() の設計方針。packages/cli/ を触る時に自動で呼ばれる
---

# cli-nhc — nhc CLI 実装ガイド

## 役割

- Notion DB を introspect して型安全な `nhcSchema.ts` を生成する Prisma ライク CLI
- 生成物を `adapter-*` に渡すことで end-to-end の型安全性を実現

## エントリーポイント

- `bin/nhc` — ラッパースクリプト（git 管理）
- `src/index.ts` — CLI 実装

## コマンド

| コマンド | 動作 |
|---|---|
| `nhc init` | `nhc.config.ts` テンプレを生成 |
| `nhc generate` | Notion API を叩いてスキーマを `output` に出力 |
| `nhc generate --env-file <path>` | 任意の env ファイルから読み込み |

## `nhc.config.ts` の形

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	notionToken: env("NOTION_TOKEN"),
	output: "./generated/nhc-schema.ts",
	sources: {
		posts: {
			dataSourceId: "xxx",  // または dbName
			schema: { /* ... */ },
		},
	},
});
```

- `env(name)` は遅延評価。**設定評価時には throw しない**
- `dbName` 指定時は generate 時に name → id を解決
- `.dev.vars` を自動検出する

## 生成物

- 出力先は `output` フィールドで**必須**
- 生成物は `.gitignore` に追加する（`**/generated`）
- Claude は生成物を直接編集しない（PreToolUse hook でブロック）

## 実装上の注意

- Node.js 24+ 想定（`engines.node: ">=24"`）
- `verbatimModuleSyntax: true` に従い `import type` を使う
- CLI の出力は JSON ではなく人間向けに整形（コード生成結果の要約を出す）
- `--env-file` は `fs.readFileSync` で KEY=VALUE 形式を読む

## エラー

- token 未設定: `CMSError code: "core/config_invalid"`
- Notion API 失敗: 原因を含む `CMSError`
- schema 不整合: `core/schema_invalid`

## テスト

- `__tests__/codegen.test.ts` — コード生成結果の snapshot 比較
- `__tests__/init.test.ts` — `nhc init` のテンプレ生成
- Notion API は `vi.mock("@notionhq/client")` でモック

## 変更時に連動して更新するもの

- `packages/cli/README.md`
- `docs/cli.md`
- `examples/*/nhc.config.ts` が最新 API で動くか
