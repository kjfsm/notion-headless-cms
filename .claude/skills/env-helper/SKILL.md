---
name: env-helper
description: シークレットと環境変数の扱い方。env() ヘルパー、process.env、wrangler secret、.dev.vars の優先順位
---

# env-helper — 環境変数の扱い

## 原則

1. **ハードコード禁止**（テストでも実トークンを埋めない）
2. **Git 管理外**（`.dev.vars` / `.env` は `.gitignore`）
3. **ログに出さない**（エラーメッセージにトークンを含めない）

## ランタイム別

### Node.js

- `process.env.NOTION_TOKEN` を読む
- `adapter-node` が自動読み込み（未設定時 `CMSError core/config_invalid`）
- `dotenv` のような外部ライブラリは使わない（Node 24+ の `--env-file` フラグで十分）

### Cloudflare Workers

- `wrangler secret put NOTION_TOKEN`
- `env` 経由でアクセス（`adapter-cloudflare` が処理）
- ローカル開発は `.dev.vars` に記述（`wrangler dev` が自動読み込み）

### CLI (`nhc generate`)

- `nhc.config.ts` で `env("NOTION_TOKEN")` を使う
- 遅延評価: 設定評価時には throw しない
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
- 静的解析時に値が無くてもエラーにしない

## 優先順位（`nhc generate`）

1. `--env-file <path>` で明示指定したファイル
2. `process.env`
3. `.dev.vars`（カレントディレクトリ）

## 代表的な環境変数

| 変数 | 用途 | 例 |
|---|---|---|
| `NOTION_TOKEN` | Notion API キー | `ntn_xxxxxxxxxxxxx` |
| `NOTION_DATA_SOURCE_ID` | データベース ID | UUID |

## テストでの扱い

- `vi.stubEnv("NOTION_TOKEN", "test-token")` で安全にセット
- テスト後に `vi.unstubAllEnvs()`
