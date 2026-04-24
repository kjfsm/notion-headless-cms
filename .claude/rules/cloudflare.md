---
description: Cloudflare Workers / R2 / KV 関連の実装慣行（cache-r2 / cloudflarePreset / examples/cloudflare-*）
paths:
  - "packages/cache-r2/**"
  - "packages/cache-kv/**"
  - "examples/cloudflare-*/**"
  - "**/wrangler.toml"
  - "**/wrangler.jsonc"
---

# Cloudflare Workers 実装ガイド

## 重要

**Workers API と制限は変わる可能性が高い**。作業前に必ず最新ドキュメントを参照する。

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

`wrangler.toml` / `wrangler.jsonc` の bindings を変えたら **必ず `wrangler types`** を実行。

## Node.js 互換

- `nodejs_compat` フラグで Node API が一部使える
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## このリポジトリの Cloudflare 対応

v0.3.0 以降、ランタイム別ファクトリ（旧 `adapter-cloudflare` / `createCloudflareCMS`）は廃止された。現状:

### `cloudflarePreset` (cache-r2)

- `createCMS({ ...cloudflarePreset({ env }), dataSources })` で使う
- `env.DOC_CACHE` (KV) と `env.IMG_BUCKET` (R2) を自動検出
- 詳細: `.claude/rules/cache.md` / `.claude/rules/package-boundaries.md`

### cache-r2

- `r2Cache({ bucket })` で `DocumentCacheAdapter` + `ImageCacheAdapter` を返す
- 構造型 `R2BucketLike` を受け取るため `@cloudflare/workers-types` に**実依存しない**
- ユーザーは `env.IMG_BUCKET` をそのまま渡せる（構造的サブタイプで互換）

### examples/cloudflare-*

- `cloudflare-astro` / `cloudflare-hono` / `cloudflare-react-router` / `cloudflare-sveltekit`
- `.dev.vars` で `NOTION_TOKEN` を設定（git 管理外）
- `wrangler.toml` に R2 バケットと KV namespace を binding

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
