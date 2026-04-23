---
description: cache-* パッケージの構造型インターフェース原則
paths:
  - "packages/cache-r2/**"
  - "packages/cache-next/**"
---

# cache-* パッケージ

## インターフェース

- 実装すべき型は `core/src/types/cache.ts` の `DocumentCacheAdapter<T>` / `ImageCacheAdapter`
- `core` の公開型として `@notion-headless-cms/core` からもインポート可能
- 新しいキャッシュ実装（Redis / D1 など）はこのインターフェースを実装するだけで差し替え可能

## cache-r2（Cloudflare R2）

- `r2Cache({ bucket })` で `DocumentCacheAdapter` & `ImageCacheAdapter` を返す
- **構造型 `R2BucketLike` を受け取る**ため `@cloudflare/workers-types` への**実依存は持たない**
  - 必要最小限の API のみ要求する型
  - `@cloudflare/workers-types` の `R2Bucket` は構造的に互換

## cache-next（Next.js ISR）

- `nextCache({ revalidate?, tags? })` で `DocumentCacheAdapter` を返す
- 内部で `next/cache` の `unstable_cache` と `revalidateTag` を利用
- `next` は `peerDependencies`

## エラー

- I/O 失敗: `CMSError code: "cache/io_failed"`
- 画像フェッチ失敗: `CMSError code: "cache/image_fetch_failed"`

## テスト

- R2 は fake bucket（in-memory Map）でテスト。`__tests__/r2-cache.test.ts` を参考
- Next.js は `unstable_cache` をモックしてテスト
