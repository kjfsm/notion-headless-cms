---
name: cloudflare-workers
description: Cloudflare Workers / R2 / D1 / KV / Durable Objects / Queues 関連の実装ガイド。adapter-cloudflare / cache-r2 / examples/cloudflare-* を触る時に自動で呼ばれる。旧 AGENTS.md の内容を吸収
---

# cloudflare-workers — Cloudflare 実装ガイド

## 重要

**Workers API と制限は変わる可能性が高い**。作業前に必ず最新ドキュメントを参照すること。

- 公式ドキュメント: https://developers.cloudflare.com/workers/
- Cloudflare Docs MCP（推奨登録）: `https://docs.mcp.cloudflare.com/mcp`

## コマンド

| コマンド | 目的 |
|---|---|
| `npx wrangler dev` | ローカル開発 |
| `npx wrangler deploy` | デプロイ |
| `npx wrangler types` | `worker-configuration.d.ts` 生成 |
| `npx wrangler secret put <NAME>` | シークレット登録 |
| `npx wrangler r2 bucket create <NAME>` | R2 バケット作成 |

`wrangler.toml` または `wrangler.jsonc` の bindings を変えたら **必ず `wrangler types`** を実行。

## Node.js 互換

- `nodejs_compat` フラグで Node API が一部使える
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## このリポジトリの Cloudflare 対応

### adapter-cloudflare

- `createCloudflareCMS({ schema, env, ... })` — `env.CACHE_BUCKET` (R2) を自動検出
- `CloudflareCMSEnv` 型を公開
- 詳細: `.claude/rules/adapter.md`

### cache-r2

- `r2Cache({ bucket })` を返す
- 構造型 `R2BucketLike` を受け取る（`@cloudflare/workers-types` に**実依存しない**）
- 詳細: `.claude/rules/cache.md`

### examples/cloudflare-*

- `cloudflare-astro` / `cloudflare-hono` / `cloudflare-react-router` / `cloudflare-sveltekit`
- `.dev.vars` で `NOTION_TOKEN` を設定（git 管理外）
- `wrangler.toml` に `[[r2_buckets]] binding = "CACHE_BUCKET"`

## エラーコード

- Error 1102（CPU/Memory 超過）: `https://developers.cloudflare.com/workers/platform/limits/` で限度確認
- 全エラー: `https://developers.cloudflare.com/workers/observability/errors/`

## 制限・クォータ

各プロダクトの `/platform/limits/` ページを取得して確認:

- `/workers/platform/limits/`
- `/r2/platform/limits/`
- `/kv/platform/limits/`
- `/d1/platform/limits/`
- `/durable-objects/platform/limits/`
- `/queues/platform/limits/`

## このスキルが吸収した情報

旧 `AGENTS.md` の内容（Cloudflare Workers に関する外部エージェント向け記載）を吸収済み。AGENTS.md 自体は他エージェント互換のため残しているが、中身は「CLAUDE.md を読め」のスタブ。
