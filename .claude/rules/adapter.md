---
description: adapter-* パッケージのファクトリ規約
paths:
  - "packages/adapter-cloudflare/**"
  - "packages/adapter-node/**"
  - "packages/adapter-next/**"
---

# adapter-* パッケージ

各ランタイム向けに CMS ファクトリを提供する層。`nhcSchema`（CLI が生成）を受け取り、ソース名でアクセスできる CMS マップを返す。

## 共通方針

- ファクトリ関数名は `create<Runtime>CMS`
- 第一引数は `{ schema: NhcSchema, ... }` を受け取る
- 返り値はソース名ごとの `CMS` インスタンスのマップ（`client.posts.list()` のように使える）
- `renderer` の自動注入（`renderMarkdown`）はアダプタの責務
- 環境変数は**アダプタが読み込む**。`core` は `process.env` を直接触らない

## adapter-cloudflare

- `createCloudflareCMS({ schema, env, sources?, content?, ttlMs? })`
- `env.CACHE_BUCKET`（R2）を自動で `r2Cache({ bucket })` に変換
- `env.CACHE_BUCKET` 未設定時は `noopDocumentCache` / `noopImageCache` にフォールバック
- `CloudflareCMSEnv` 型を公開

## adapter-node

- `createNodeCMS({ schema, sources?, token?, cache?, content? })`
- `process.env.NOTION_TOKEN` を自動読み込み（`token` 未指定時）
- `cache: "disabled" | { document?: "memory"; image?: "memory"; ttlMs? }`
- 未設定時は `CMSError code: "core/config_invalid"`

## adapter-next

- Next.js App Router 向けのルートハンドラ群（ファクトリ関数ではなく handler を返す）
- `createImageRouteHandler(cms)` — `/api/images/[hash]/route.ts` 用
- `createRevalidateRouteHandler(cms, { secret })` — Webhook 受信用
- ファクトリではないため `nhcSchema` は受け取らない

## 新アダプタ追加時

1. `packages/adapter-<runtime>/` を作成
2. `DocumentCacheAdapter` / `ImageCacheAdapter` の注入経路を設計
3. `renderer` 自動注入（`renderMarkdown`）を組み込む
4. README / docs/recipes/ を追加
