---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/cache-r2": patch
---

後方互換コード・フォールバック・デッドコードを削除（破壊的変更）

## Breaking Changes

### `@notion-headless-cms/core`

- `memoryCache()` を削除。`memoryDocumentCache()` を使ってください
- `DataSource.findBySlug` をインターフェースから削除。`findByProp` + `collections[].slug` を使ってください
- `CachedItemWithBlocks` 型を削除。`CachedItem`（`blocks?` / `markdown?` フィールドを追加済み）を使ってください

### `@notion-headless-cms/notion-orm`

- `notionAdapter` を削除。`createNotionCollection` を使ってください
- `NotionAdapterOptions` 型を削除。`NotionCollectionOptions` を使ってください

### `@notion-headless-cms/cache-r2`

- `CloudflarePresetEnv.CACHE_KV` / `CACHE_BUCKET` を削除。`DOC_CACHE` / `IMG_BUCKET` を使ってください
