---
description: Cloudflare Workers / R2 / KV 関連の実装慣行（cms の /cloudflare サブパス / examples/cloudflare-*）
paths:
  - "packages/cms/**"
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

Cloudflare 対応はランタイム専用のファクトリではなく、`@notion-headless-cms/cms` の `/cloudflare` サブパスとして提供する。

### @notion-headless-cms/cms/cloudflare（サブパス）

`packages/cms/src/cloudflare.ts` に実装がある。

- `kvDocStore(namespace)` / `r2BlobStore(bucket)` — KV をドキュメントインデックス、R2 をエントリ本体・画像バイナリのストアとして返す（`createCMS({ stores: { docs, blobs } })` に渡す）
- `KVNamespaceLike` / `R2BucketLike` / `R2ObjectLike` — 構造型。`@cloudflare/workers-types` に実依存しない
- `createSyncCoordinatorDO({ createCMS })` — Notion アクセスを直列化する同期エンジンを Durable Object として export するファクトリ。DO は `POST /kick` `/webhook` `/reconcile`・`GET /state` `/stats` の内部エンドポイントと `alarm()` を持つ
- `durableObjectSyncDelegate({ stub })` — 読者用 stateless Worker 側の `createCMS({ syncDelegate })` に渡す、DO stub への転送実装（`createSyncCoordinatorDO` が作る DO クラスと対になる）
- `RealtimeHubDO` / `durableObjectRealtime(...)` / `broadcastToSockets` / `parseSubscribeChannel` — WebSocket 購読者へ同期完了イベントを push する realtime hub 用 Durable Object 実装
- `DurableObjectNamespaceLike` / `DurableObjectStubLike` / `HibernatableWebSocketLike` / `RealtimeDurableObjectStateLike` — これらも構造型
- 実例: `examples/cloudflare-hono/src/lib/cms.ts`（読者側 Worker）と `src/lib/do.ts`（`SyncCoordinatorDO`）

### examples/cloudflare-*

- `cloudflare-astro` / `cloudflare-hono` / `cloudflare-react-router`
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
