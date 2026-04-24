# @notion-headless-cms/cache-r2

## 0.2.1

### Patch Changes

- Updated dependencies [61911e6]
  - @notion-headless-cms/cache-kv@0.1.2

## 0.2.0

### Minor Changes

- 53a93f7: `createCMS` の開発者体験を改善する新 API を追加（Prisma / better-auth スタイル）。

  ## 追加 API

  ### `preset` オプション (`@notion-headless-cms/core`)

  `createCMS` に `preset: "node"` と `ttlMs` を直接指定できるようになった。
  `nodePreset()` のスプレッドが不要になる。

  ```ts
  // Before
  const cms = createCMS({ ...nodePreset({ ttlMs: 5 * 60_000 }), dataSources });

  // After
  const cms = createCMS({ dataSources, preset: "node", ttlMs: 5 * 60_000 });
  ```

  既存のスプレッドパターンは引き続き動作する（後方互換）。

  ### `createCloudflareFactory` (`@notion-headless-cms/cache-r2`)

  Cloudflare Workers 向けのファクトリ関数。全 Cloudflare example で繰り返されていたボイラープレートを 1 行に削減する。

  ```ts
  // Before（手書きのラッパーが必要だった）
  export function createCMS(env: Env) {
    return createCore({
      ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }),
      dataSources,
    });
  }

  // After
  export const createCMS = createCloudflareFactory({
    dataSources,
    ttlMs: 5 * 60_000,
  });
  // 使い方は変わらない: createCMS(env).posts.getList()
  ```

### Patch Changes

- 7791e88: リリース前リファクタリング (0.x 帯のため patch bump)。

  ## API 変更 (0.x につき patch で許容)

  - **`createCMS` 一本化**: `createNodeCMS` / `createCloudflareCMS` を廃止。
    ランタイム差分は `nodePreset()` (core) と `cloudflarePreset({ env })` (cache-r2) で吸収する。
  - **`adapter-node` / `adapter-cloudflare` パッケージ削除**。上記 preset に統合された。
  - **`InvalidateScope` を `{ collection, slug? }` に統一**。旧 `{ slug }` / `{ tag }` 形式を削除。
  - **NHC プレフィクス → CMS プレフィクス**: `NHCConfig` → `CMSConfig`, `NHCSchema` → `CMSSchema`,
    `nhcDataSources` → `cmsDataSources`, `NHCDataSources` → `CMSDataSources`。
    `nhc` CLI / `nhc.config.ts` / `nhc-schema.ts` のファイル名は維持。
  - **CLI / core の生 Error を CMSError に統一**。`cli/*` 名前空間を新設 (`cli/config_invalid`,
    `cli/schema_invalid`, `cli/generate_failed`, `cli/init_failed`, `cli/notion_api_failed`,
    `cli/env_file_not_found`, `cli/config_load_failed`)。
  - **`cache-next` の invalidate を規約タグに変更**: `nhc:col:<name>` /
    `nhc:col:<name>:slug:<slug>` を `revalidateTag` する。
  - **`DataSourceFactory` を generic 化** (`DataSourceFactory<TOptions>`、
    将来 ORM 増強向けの内部 I/F 整備)。

  ## 追加

  - `nodePreset()` (core): memory cache を既定有効化。`cache` / `ttlMs` / `renderer` で上書き可。
  - `cloudflarePreset({ env, ttlMs?, bindings? })` (cache-r2): env binding を自動解決。
    推奨 binding 名 `DOC_CACHE` (KV) / `IMG_BUCKET` (R2)。旧 `CACHE_KV` / `CACHE_BUCKET` もフォールバック認識。
  - `BuiltInCMSErrorCode` に `core/notion_orm_missing` / `cli/*` を追加。
  - `@notion-headless-cms/cli` に `CMSConfig` / `defineConfig` / `env` を整備。
  - Cloudflare KV バックエンドの `kvCache` (cache-kv)。

  ## 整理

  - 全パッケージの `publishConfig.exports` 重複を削除 (root `exports` のみ)。
  - `cache-r2` に `test` スクリプトを追加。

  ## 移行ガイド

  詳細は [`docs/migration/v0.3.md`](./docs/migration/v0.3.md) を参照。

- Updated dependencies [53a93f7]
- Updated dependencies [7791e88]
  - @notion-headless-cms/core@0.2.0
  - @notion-headless-cms/cache-kv@0.1.1

## 0.1.3

### Patch Changes

- 19cb87a: ビルド・CI/CD・Wrangler 設定の基盤を改善しました。ランタイム挙動への影響はありません。

  - 公開時に **npm provenance** を有効化し、各パッケージの `publishConfig` に `"provenance": true` を追加。GitHub Actions の OIDC（`id-token: write`）と連動し、sigstore 証跡付きで公開されます。
  - `@notion-headless-cms/core` と `@notion-headless-cms/source-notion` の `publishConfig.exports` の冗長な重複定義を削除（通常の `exports` と一致していたため）。

- 7192646: `package.json` の `exports` で `types` を先頭に移動して TypeScript の型解決を確実にする。

  publint が `types should be the first in the object as conditions are order-sensitive` を報告していたため、全公開パッケージで `exports[*]` のキー順を `types` → `import` に修正した。動作は同じだが TypeScript の resolution で型ファイルが確実に先に解決される。

- Updated dependencies [19cb87a]
- Updated dependencies [7192646]
- Updated dependencies [f169f34]
- Updated dependencies [bb693f1]
  - @notion-headless-cms/core@0.1.3

## 0.1.2

### Patch Changes

- 6c36d76: 公開前 API 整理。後方互換を壊しうる構造的変更を一括で実施する。

  - **source-notion**: 公開 API から `@notionhq/client/build/src/api-endpoints` の内部型を排除し、自前の `NotionPage` 型で置き換え。`@notionhq/client` を `peerDependencies` に昇格
  - **source-notion**: `NotionSchema<T>` から `zodSchema` フィールドを削除（`defineSchema()` 内部でクロージャ保持）。`zod` を `peerDependencies` に昇格
  - **renderer**: `unified` / `remark-*` / `rehype-*` / `unist-util-visit` を `peerDependencies` へ移動。複数バージョン同居による `Processor` インスタンス不一致問題を回避
  - **renderer**: `PluggableList` 型を re-export し、core の `remarkPlugins` / `rehypePlugins` の型を `unknown[]` → `PluggableList` に変更
  - **core**: `CacheConfig` を `"disabled" | { document?, image?, ttlMs? }` の discriminated union 化。`false` リテラルを廃止
  - **core**: キャッシュアクセサを `cms.cache.read` / `cms.cache.manage` の 3 階層に再編。旧 `cms.cached.*` / `cms.cache.<mutator>` は削除（公開前のため互換レイヤなし）
  - **core**: 観測フックを try/catch で囲んで例外を logger に流すようにし、1 つのフックで他のフックが巻き添えにならないように修正
  - **core**: `onRenderStart` / `onRenderEnd` フックを追加
  - **core**: `memoryDocumentCache` / `memoryImageCache` に `maxItems` / `maxSizeBytes` LRU オプションを追加
  - **core**: `exports` に `./errors` / `./hooks` / `./cache/memory` サブパスを追加
  - **adapter-cloudflare**: `CreateCloudflareCMSOptions.cache` を廃止し `ttlMs?: number` に簡素化
  - **adapter-node**: `NodeCMSOptions.cache` を `"disabled" | { document?: "memory"; image?: "memory"; ttlMs? }` の union に変更
  - **リポジトリ**: 統合済みの `packages/fetcher` / `packages/transformer` を削除
  - **CI**: Node 18 / 20 / 22 のマトリクスに拡張

- 5763f19: フォールバック・型の握りつぶし・空文字列の黙殺を解消し、型安全性と壊れにくさを向上させる。

  - core と renderer の `RendererFn` / `RenderOptions` 型を構造的に互換にし、各アダプターから `as unknown as RendererFn` キャストを排除
  - `cacheImage` の戻り値型を `Promise<string | null>` → `Promise<string>` に統一（renderer 実装は null を返さないため）
  - プラグイン型を `unknown[]` → `readonly unknown[]` に変更し、副作用的な変更を防ぐ
  - `fetchAndCacheImage` が HTTP 失敗を黙殺していたため、`CMSError` を投げるように修正
  - `prefetchAll` の `catch` が失敗件数だけカウントして原因を捨てていたため、`logger.warn` で slug / pageId / エラー内容を記録するように修正
  - `loadDefaultRenderer` のエラーから `cause` を失っていたため保持するように修正
  - `createNodeCMS` の環境変数不足時に素の `Error` を投げていたのを `CMSError` 化（コード: `core/config_invalid`）
  - `source-notion/schema.ts` の `select` パースで空文字列 → null の二重フォールバックを廃止し、直接 null を返すよう単純化
  - `source-notion/mapper.ts` の slug に `z.string().min(1)` を追加し、空スラッグを Zod で早期に弾く

- Updated dependencies [20b0cfc]
- Updated dependencies [6c36d76]
- Updated dependencies [5763f19]
  - @notion-headless-cms/core@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [8f69e55]
  - @notion-headless-cms/core@0.1.1

## 0.1.0

### Minor Changes

- 25c018d: update version

### Patch Changes

- Updated dependencies [25c018d]
  - @notion-headless-cms/core@0.1.0

## 0.0.7

### Patch Changes

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

- Updated dependencies [52f002f]
- Updated dependencies [aada8c0]
  - @notion-headless-cms/core@0.0.7

## 0.0.6

### Patch Changes

- @notion-headless-cms/core@0.0.6

## 0.0.5

### Patch Changes

- 0b25275: update dependencies versions
- Updated dependencies [0b25275]
  - @notion-headless-cms/core@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [5b11fc1]
  - @notion-headless-cms/core@0.0.4

## 0.0.3

### Patch Changes

- b46fc98: update test
- Updated dependencies [b46fc98]
  - @notion-headless-cms/core@0.0.3

## 0.0.2

### Patch Changes

- 5c607b9: update
- Updated dependencies [5c607b9]
  - @notion-headless-cms/core@0.0.2
