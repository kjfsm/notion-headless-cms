---
description: examples/ の最小動作方針
paths:
  - "examples/**"
---

# examples/ パッケージ

## 目的

フレームワーク別に**最小限の動作例**を提供する。ユーザーがコピー元として使うため、シンプルで読みやすいコードを優先。

## 原則

- **公開 API のみ使用**（`packages/*/src/internal/*` を参照しない）
- **プロダクション機能を足さない**（認証、ロギング、監視などは別リポジトリの責務）
- **依存は最小限**。`@notion-headless-cms/adapter-*` と該当フレームワークのみ
- 型生成は `nhc generate` に統一。`nhc.config.ts` + `nhc-schema.ts` を生成するパターン
- `.dev.vars` / `.env` はコミットしない（`.gitignore` に追加）

## 存在する examples

- `cloudflare-astro` / `cloudflare-hono` / `cloudflare-react-router` / `cloudflare-sveltekit`
- `node-express`
- `vercel-nextjs`

## 新 example 追加時

1. `examples/<name>/` を作成
2. `package.json` の `private: true`、`workspace:*` で `@notion-headless-cms/adapter-*` を参照
3. README に「依存インストール → 環境変数 → 実行手順」の 3 ステップを記載
4. ビルドが CI で通ることを確認（`turbo run build --filter=examples/<name>`）

## Cloudflare examples 固有

- `wrangler.toml` の `[[r2_buckets]] binding = "CACHE_BUCKET"` を使う
- `npx wrangler types` で `worker-configuration.d.ts` を生成（Biome 無視対象）
- `NOTION_TOKEN` は `wrangler secret put` / `.dev.vars`
