# @notion-headless-cms/adapter-cloudflare

## 1.0.0

### Major Changes

- aada8c0: データソース・キャッシュ責務を分離し、core API を破壊的に刷新した。

  ## 主な変更点

  ### core（破壊的変更）

  - `CMSConfig` / `CMSEnv` / `StorageAdapter` を削除し、`CreateCMSOptions` / `DataSourceAdapter` / `DocumentCacheAdapter` / `ImageCacheAdapter` に置換
  - メソッド名を改名: `getItems→list`, `getItemBySlug→findBySlug`, `renderItem→render`, `renderItemBySlug→renderBySlug`, `getItemsCachedFirst→getList`, `getItemCachedFirst→getItem`
  - `waitUntil` をメソッド引数から `createCMS()` オプションに移動
  - 追加 API: `listByStatus`, `where`, `paginate`, `getAdjacent`, `prefetchAll`, `getStaticSlugs`, `revalidate`, `syncFromWebhook`
  - `memoryCache`, `memoryImageCache`, `noopDocumentCache`, `noopImageCache` を同梱
  - `types.ts` を `types/` ディレクトリに分割

  ### cache-r2（破壊的変更）

  - `CloudflareR2StorageAdapter` / `createCloudflareR2StorageAdapter` を削除
  - `r2Cache({ bucket, prefix? })` を追加（`DocumentCacheAdapter & ImageCacheAdapter` を実装）

  ### adapter-cloudflare（破壊的変更）

  - `createCloudflareCMS(env, config?)` → `createCloudflareCMS({ env, schema, content, cache })` に変更

  ### 新規パッケージ

  - `@notion-headless-cms/source-notion`: `notionAdapter()` を提供。core から Notion 依存を分離
  - `@notion-headless-cms/cache-next`: Next.js `unstable_cache` / `revalidateTag` ベースのキャッシュ
  - `@notion-headless-cms/adapter-next`: `createImageRouteHandler` / `createRevalidateRouteHandler` を提供

  詳細な移行手順: `docs/migration/v0-to-v1.md`

### Patch Changes

- Updated dependencies [aada8c0]
  - @notion-headless-cms/core@1.0.0
  - @notion-headless-cms/cache-r2@1.0.0
  - @notion-headless-cms/source-notion@0.2.0

## 0.0.6

### Patch Changes

- @notion-headless-cms/core@0.0.6
- @notion-headless-cms/cache-r2@0.0.6

## 0.0.5

### Patch Changes

- 0b25275: update dependencies versions
- Updated dependencies [0b25275]
  - @notion-headless-cms/cache-r2@0.0.5
  - @notion-headless-cms/core@0.0.5

## 0.0.4

### Patch Changes

- 5b11fc1: env をコンストラクタ（CMSConfig）で受け取るよう変更し、各メソッドの env 引数を削除。
  createCloudflareCMS は env を自動注入するため、呼び出し側での変更は不要。
- Updated dependencies [5b11fc1]
  - @notion-headless-cms/core@0.0.4
  - @notion-headless-cms/cache-r2@0.0.4

## 0.0.3

### Patch Changes

- b46fc98: update test
- Updated dependencies [b46fc98]
  - @notion-headless-cms/cache-r2@0.0.3
  - @notion-headless-cms/core@0.0.3

## 0.0.2

### Patch Changes

- 5c607b9: update
- Updated dependencies [5c607b9]
  - @notion-headless-cms/cache-r2@0.0.2
  - @notion-headless-cms/core@0.0.2
