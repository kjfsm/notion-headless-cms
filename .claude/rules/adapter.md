---
description: フレームワークグルー（Next.js 連携等）の規約
paths:
  - "packages/client/**"
---

# フレームワークグルー（Next.js 連携等）

フレームワークグルーは「フロントエンド / フレームワーク連携」に役割を限定する。
ランタイム差分（Node / Cloudflare）は `nodePreset` (core) / `cloudflarePreset`
（`@notion-headless-cms/cache` の `/cloudflare` サブパス）で吸収し、グルーは
Next.js / Astro など**フレームワーク側の作法に合わせた薄い層**として実装する。

現行のグルーは `@notion-headless-cms/client` の `/next` `/react` サブパスに同梱されている（独立した `adapter-*`
パッケージは存在しない。v0.3.0 の preset 化で役割を分離した）。

## @notion-headless-cms/client/next

- Next.js App Router 向けの統合ルートハンドラ
- `createNextHandler(cms, opts?)` — `/app/api/cms/[...path]/route.ts` に置き、画像プロキシ (`GET /api/cms/images/:hash`) と Webhook 受信 (`POST /api/cms/revalidate/:collection`) を 1 つのハンドラで処理する
- `createNextWebhookHandler(cms, opts?)` — Webhook 受信 + `next/cache` の `revalidateTag` / `revalidatePath` 連携
- CMS インスタンスを受け取り、Next.js の `Route Handler` (`GET` / `POST` 共通) に適合する関数を返す

## 新しいフレームワーク連携を足すとき（SvelteKit / Astro integration 等）

1. `@notion-headless-cms/client` のサブパスにグルーを足すか、専用パッケージを作る
2. **CMS ファクトリは createCMS に一本化**（グルーは CMS インスタンスを受け取るだけ）
3. 代わりに、そのフレームワークの規約に合った薄いグルー（middleware / route handler / integration プラグイン）を提供
4. 依存は `@notion-headless-cms/core` と該当フレームワークのみ
5. README と `docs/ja/recipes/<framework>.md` を追加
