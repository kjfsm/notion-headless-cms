---
description: cache パッケージの構造型インターフェース原則
paths:
  - "packages/cache/**"
---

# @notion-headless-cms/cache パッケージ

キャッシュ実装は単一の `@notion-headless-cms/cache` に集約され、ランタイム別の
実装はサブパスで提供する（`/cloudflare`・`/next`）。`memoryCache` はルートから提供。

## インターフェース

- 実装すべき型は `core/src/types/cache.ts` の `CacheAdapter`（`DocumentCacheOps` / `ImageCacheOps`）
- `core` の公開型として `@notion-headless-cms/core` からもインポート可能
- 新しいキャッシュ実装（Redis / D1 など）はこのインターフェースを実装するだけで差し替え可能

## /cloudflare サブパス（R2 / KV）

`@notion-headless-cms/cache/cloudflare` から:

- `r2Cache({ bucket })` — R2 を画像キャッシュ（必要なら doc も）として返す
- `kvCache({ namespace, prefix? })` — KV をドキュメントキャッシュとして返す
- `cloudflareCache({ docCache, imgBucket }, { prefix? })` / `cloudflarePreset({ env, ctx })` — まとめて配線
- **構造型 `R2BucketLike` / `KVNamespaceLike` を受け取る**ため `@cloudflare/workers-types` への**実依存は持たない**
  - 必要最小限の API のみ要求する型
  - `@cloudflare/workers-types` の `R2Bucket` / `KVNamespace` は構造的に互換

## /next サブパス（Next.js ISR）

`@notion-headless-cms/cache/next` から `nextCache(...)` を提供。内部で `next/cache` を利用し、
`next` は `peerDependencies`。

## エラー

- I/O 失敗: `CMSError code: "cache/io_failed"`
- 画像フェッチ失敗: `CMSError code: "cache/image_fetch_failed"`

## テスト

- R2 / KV は fake（in-memory Map）でテスト。`packages/cache/src/__tests__/` を参考
- Next.js は `next/cache` をモックしてテスト
