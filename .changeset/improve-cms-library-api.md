---
"@notion-headless-cms/core": patch
"@notion-headless-cms/adapter-cloudflare": patch
"@notion-headless-cms/adapter-node": patch
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/source-notion": patch
---

ライブラリとしての完成度を高める API 改善

## Breaking Changes

- `cms.cache.read.list()` → `cms.cache.getList()`
- `cms.cache.read.get(slug)` → `cms.cache.get(slug)`
- `cms.cache.manage.prefetchAll/revalidate/sync/checkList/checkItem` → `cms.cache.*` に統合
- トップレベルの重複メソッド（`prefetchAll`, `revalidate`, `syncFromWebhook`, `checkListUpdate`, `checkItemUpdate`）を削除
- `ContentConfig.render` を削除（代わりに `CreateCMSOptions.renderer` を使用）
- `RetryConfig.maxConcurrent` を削除（`RateLimiterConfig.maxConcurrent` は継続サポート）

## 新機能

- `cms.findMany(slugs[])` を追加 — 複数スラッグのバッチ取得
- `QueryBuilder.first()` を追加 — `.paginate({ page: 1, perPage: 1 }).executeOne()` の短縮形
- `CacheAccessor` 型を公開 — `cms.cache` の型付けが可能に
- `@notion-headless-cms/core/cache/noop` サブパスエクスポートを追加

## バグ修正

- `QueryBuilder.adjacent()` が `.sortBy()` のソート状態を無視していた問題を修正

## 改善

- `withRetry` にジッターオプション（デフォルト有効）を追加 — Thundering Herd 対策
- `cache/image_fetch_failed` エラーコードを追加（HTTP エラーを `cache/io_failed` から分離）
- `RateLimiterConfig.maxConcurrent` が `cache.prefetchAll()` のデフォルト同時実行数に反映されるように
- `image.ts` のテストを追加
