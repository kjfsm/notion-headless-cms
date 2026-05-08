---
description: adapter-* パッケージ（フロントエンド連携）の規約
paths:
  - "packages/adapter-next/**"
---

# adapter-* パッケージ

`adapter-*` は「フロントエンド / フレームワーク連携」に役割を限定する。
ランタイム差分（Node / Cloudflare）は `nodePreset` (core) / `cloudflarePreset` (cache-r2) で吸収し、
adapter は Next.js / Astro など**フレームワーク側の作法に合わせた薄いグルー**として実装する。

## adapter-next

- Next.js App Router 向けの統合ルートハンドラ
- `createNextHandler(cms, opts?)` — `/app/api/cms/[...path]/route.ts` に置き、画像プロキシ (`GET /api/cms/images/:hash`) と Webhook 受信 (`POST /api/cms/revalidate/:collection`) を 1 つのハンドラで処理する
- CMS インスタンスを受け取り、Next.js の `Route Handler` (`GET` / `POST` 共通) に適合する関数を返す

## 新 adapter 追加時（SvelteKit / Astro integration 等）

1. `packages/adapter-<framework>/` を作成
2. **CMS ファクトリは提供しない**（`createCMS` を一本化しているため）
3. 代わりに、そのフレームワークの規約に合った薄いグルー（middleware / route handler / integration プラグイン）を提供
4. 依存は `@notion-headless-cms/core` と該当フレームワークのみ
5. README と `docs/recipes/<framework>.md` を追加
