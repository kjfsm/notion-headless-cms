---
description: adapter-* パッケージ（フロントエンド連携）の規約
paths:
  - "packages/adapter-next/**"
---

# adapter-* パッケージ

**v0.3.0 から `adapter-*` は「フロントエンド / フレームワーク連携」に役割を限定した。**
ランタイム差分（Node / Cloudflare）は `nodePreset` (core) / `cloudflarePreset` (cache-r2) で吸収する。

## 歴史的経緯

- v0.2.x までの `adapter-node` (`createNodeCMS`) / `adapter-cloudflare` (`createCloudflareCMS`) はランタイム別ファクトリとして存在していた
- v0.3.0 でこれらは廃止。ユーザーは `createCMS({ ...nodePreset(), dataSources })` のように `createCMS` 一本で書く
- 「adapter」は以後、Next.js / Astro など**フレームワーク側の作法に合わせた薄いグルー**を意味する

## adapter-next

- Next.js App Router 向けのルートハンドラ群（ファクトリ関数ではなく handler を返す）
- `createImageRouteHandler(cms)` — `/api/images/[hash]/route.ts` 用
- `createRevalidateRouteHandler(cms, { secret })` — Webhook 受信用
- CMS インスタンスを受け取り、Next.js の `Route Handler` に適合する関数を返す

## 新 adapter 追加時（SvelteKit / Astro integration 等）

1. `packages/adapter-<framework>/` を作成
2. **CMS ファクトリは提供しない**（`createCMS` を一本化しているため）
3. 代わりに、そのフレームワークの規約に合った薄いグルー（middleware / route handler / integration プラグイン）を提供
4. 依存は `@notion-headless-cms/core` と該当フレームワークのみ
5. README と `docs/recipes/<framework>.md` を追加
