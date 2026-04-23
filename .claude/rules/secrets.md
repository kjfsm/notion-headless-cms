---
description: Notion トークン・Cloudflare シークレット・env() ヘルパーの扱い
---

# シークレットと環境変数

## 基本ルール

- **シークレットをコードにハードコードしない**。テストでも実トークンを埋めない
- **Git 管理ファイルにも入れない**（`.dev.vars` は `.gitignore` 対象）
- **ログにトークンを出さない**

## 主要な環境変数

| 変数 | 用途 |
|---|---|
| `NOTION_TOKEN` | Notion API キー |
| `NOTION_DATA_SOURCE_ID` | Notion データベース ID（`data_sources.id`） |

## ランタイム別の設定方法

- **Node.js**: `process.env`。`adapter-node` は自動読み込み。未設定時は `CMSError core/config_invalid`
- **Cloudflare Workers**: `wrangler secret put NOTION_TOKEN`。`env` 経由でアクセス
- **ローカル開発（Workers）**: `.dev.vars` に記述（`.gitignore` 済み）。`wrangler dev` が自動読み込み
- **CLI (`nhc generate`)**: `nhc.config.ts` の `env("NOTION_TOKEN")` ヘルパーを推奨（Prisma 風）。`--env-file <path>` オプションで任意ファイル読み込み可

## `env()` ヘルパー（`nhc.config.ts`）

```ts
import { defineConfig, env } from "@notion-headless-cms/cli";

export default defineConfig({
  notionToken: env("NOTION_TOKEN"),
  // ...
});
```

- `env()` は遅延評価。設定評価時には throw しない（`nhc generate` 実行時に解決）
- `.dev.vars` を自動検出する
