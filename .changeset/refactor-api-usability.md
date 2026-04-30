---
"@notion-headless-cms/core": patch
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/cli": patch
---

v1.0: ライブラリ使い勝手改善（破壊的変更）

### コレクション API

- `get(slug)` → `find(slug)`（nullable が直感的）
- `slugs()` → `params()`（Next.js 慣習に合わせる）
- `revalidate(slug, version)` → `check(slug, version)`

### グローバル操作

- `$collections` → `collections`
- `$invalidate()` → `invalidate()`
- `$handler()` → `handler()`
- `$getCachedImage()` → `getCachedImage()`

### 設定

- `cache: adapter` → `cache: [adapter]`（常に配列で型統一）
- `ttlMs: number` → `swr: { ttlMs: number }`（SWR 設定を名前空間に整理）

### エラーハンドリング

- `CMSError` に `is(code)` / `inNamespace(ns)` インスタンスメソッドを追加
- `matchCMSError(err, handlers)` ユーティリティを追加

### adapter-next

- `createNextHandler(cms, opts?)` を新設（推奨 API）
- `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` は `@deprecated`

### CLI

- `columnMappings` → `fieldMappings`（Notion フィールドとの対応であることを明確化）

### 型の改名

- `GetOptions` → `FindOptions`
- `RevalidateResult` → `CheckResult`
- 新設: `SWRConfig`
