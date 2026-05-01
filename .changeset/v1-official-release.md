---
"@notion-headless-cms/core": major
"@notion-headless-cms/renderer": major
"@notion-headless-cms/notion-orm": major
"@notion-headless-cms/cache": major
"@notion-headless-cms/adapter-next": major
"@notion-headless-cms/notion-embed": major
---

v1.0.0 正式リリース

0.x で先行導入していた以下の変更を semver 上も v1.0.0 として正式公開する。

### 主な変更点（0.3.x → 1.0.0）

**コレクション API**
- `get(slug)` → `find(slug)`
- `slugs()` → `params()`
- `revalidate(slug, version)` → `check(slug, version)`

**グローバル操作**
- `$collections` → `collections`
- `$invalidate()` → `invalidate()`
- `$handler()` → `handler()`
- `$getCachedImage()` → `getCachedImage()`

**設定**
- `cache: adapter` → `cache: [adapter]`（常に配列）
- `ttlMs: number` → `swr: { ttlMs: number }`

**エラー処理**
- `CMSError` に `is(code)` / `inNamespace(ns)` インスタンスメソッドを追加
- `matchCMSError(err, handlers)` ユーティリティを追加

**adapter-next**
- `createNextHandler(cms, opts?)` を新設（推奨 API）
- 旧 handler は `@deprecated`

**CLI**
- `columnMappings` → `fieldMappings`

**型の改名**
- `GetOptions` → `FindOptions`
- `RevalidateResult` → `CheckResult`
- 新設: `SWRConfig`

移行ガイド: https://github.com/kjfsm/notion-headless-cms/blob/main/docs/migration/v1.0.md
