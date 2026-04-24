---
description: Notion トークン・Cloudflare シークレット・env() ヘルパーの扱い
paths:
  - "packages/**"
  - "examples/**"
  - "**/*.env*"
  - "**/.dev.vars*"
  - "**/wrangler.toml"
  - "**/wrangler.jsonc"
  - "**/nhc.config.ts"
---

# シークレットと環境変数

## 基本ルール

- **シークレットをコードにハードコードしない**。テストでも実トークンを埋めない
- **Git 管理ファイルにも入れない**（`.dev.vars` / `.env` は `.gitignore` 対象）
- **ログに出さない**（エラーメッセージにトークンを含めない）

## 主要な環境変数

| 変数 | 用途 | 例 |
|---|---|---|
| `NOTION_TOKEN` | Notion API キー | `ntn_xxxxxxxxxxxxx` |
| `NOTION_DATA_SOURCE_ID` | Notion データベース ID（`data_sources.id`） | UUID |

## ランタイム別

### Node.js

- `process.env.NOTION_TOKEN` を読む（`nodePreset()` が自動取得）
- 未設定時は `CMSError code: "core/config_invalid"`
- `dotenv` 等の外部ライブラリは使わない（Node 24+ の `--env-file` フラグで十分）

### Cloudflare Workers

- `wrangler secret put NOTION_TOKEN`
- `env` 経由でアクセス（`cloudflarePreset({ env })` が処理）
- ローカル開発は `.dev.vars` に記述（`wrangler dev` が自動読み込み、`.gitignore` 対象）

### CLI (`nhc generate`)

- `nhc.config.ts` で `env("NOTION_TOKEN")` を使う（推奨、Prisma 風）
- `--env-file <path>` で任意ファイルから読み込み可
- `.dev.vars` を自動検出する

## `env()` ヘルパー

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
	notionToken: env("NOTION_TOKEN"),
	// env() の戻り値は string ではなく「未解決トークン」。generate 時に解決される
});
```

- Prisma の `env()` と同じ挙動
- **遅延評価**: 設定評価時には throw しない（`nhc generate` 実行時に解決）
- 静的解析時に値が無くてもエラーにしない

## 優先順位（`nhc generate`）

1. `--env-file <path>` で明示指定したファイル
2. `process.env`
3. `.dev.vars`（カレントディレクトリ）

## テストでの扱い

- `vi.stubEnv("NOTION_TOKEN", "test-token")` で安全にセット
- テスト後に `vi.unstubAllEnvs()`
