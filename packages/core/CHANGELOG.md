# @notion-headless-cms/core

## 0.3.0

### Minor Changes

- c955826: feat: createCMS コレクション検証・公開条件指定、generate 全プロパティ出力

  ### @notion-headless-cms/cli（破壊的変更）

  - `nhc generate` の生成スキーマ形式を刷新。Zod / `defineSchema` / `cmsDataSources` を廃止し、`{name}SourceId` と `{name}Properties` のみを生成するシンプルな形式に変更
  - `nhc.config.ts` の `DataSourceConfig.fields` を削除し `columnMappings` に変更（非 ASCII 列名のマッピング専用）
  - 非 ASCII プロパティ名は `property_1`, `property_2`... に自動変換し warn を出力
  - `columnMappings` で明示マッピング可能、存在しないプロパティを指定した場合はエラー

  ### @notion-headless-cms/core（後方互換）

  - `createCMS` に `collections` オプションを追加（`CollectionSemantics` 型）
  - `collections[name].slug` が未指定の場合に `CMSError(core/config_invalid)` をスロー
  - `collections[name].publishedStatuses` / `accessibleStatuses` を DataSource 側の設定より優先して適用
  - 新型エクスポート: `CollectionSemantics`, `PropertyDef`, `PropertyMap`
  - `DataSource.findBySlug` を optional に変更、`findByProp?` と `readonly properties?: PropertyMap` を追加

  ### @notion-headless-cms/notion-orm（後方互換）

  - `createNotionCollection` に `properties` オプションを追加（PropertyMap ベースのマッピング）
  - `findByProp(notionPropName, value)` メソッドを実装（Core が slug ルックアップに利用）
  - 内部に `queryPageByProp` を追加（Notion API のプロパティフィルタクエリ）

## 0.2.1

### Patch Changes

- cea9495: update add title properties

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

- Updated dependencies [7791e88]
  - @notion-headless-cms/renderer@0.1.3

## 0.1.3

### Patch Changes

- 19cb87a: ビルド・CI/CD・Wrangler 設定の基盤を改善しました。ランタイム挙動への影響はありません。

  - 公開時に **npm provenance** を有効化し、各パッケージの `publishConfig` に `"provenance": true` を追加。GitHub Actions の OIDC（`id-token: write`）と連動し、sigstore 証跡付きで公開されます。
  - `@notion-headless-cms/core` と `@notion-headless-cms/source-notion` の `publishConfig.exports` の冗長な重複定義を削除（通常の `exports` と一致していたため）。

- 7192646: `package.json` の `exports` で `types` を先頭に移動して TypeScript の型解決を確実にする。

  publint が `types should be the first in the object as conditions are order-sensitive` を報告していたため、全公開パッケージで `exports[*]` のキー順を `types` → `import` に修正した。動作は同じだが TypeScript の resolution で型ファイルが確実に先に解決される。

- f169f34: Prisma ORM 風のコレクション別 API に全面刷新（破壊的変更）。限定公開期間中のため patch bump。

  ## アーキテクチャ

  `core` を CMS 機能（キャッシュ・画像プロキシ・Web ハンドラ）に専念させ、Notion 固有処理を `@notion-headless-cms/notion-orm`（新規 private パッケージ）に分離した。ユーザーは `notion-orm` を直接 import しない。将来的に `notion-orm` はリポジトリ分離可能な設計。

  ## 主な変更

  - `@notion-headless-cms/source-notion` → `@notion-headless-cms/notion-orm` に改名（private: true）。`notionAdapter` は `createNotionCollection` に改名（旧名はエイリアスとして残す）。
  - `createCMS({ source })` を `createCMS({ dataSources: { posts, authors } })` に変更。各データソースは CLI 生成の `nhcDataSources` として渡す。
  - CMS クライアントはコレクション別 API に刷新:
    - `cms.posts.getItem(slug)` — 本文込みで単件取得（SWR 自動）
    - `cms.posts.getList(opts?)` — 公開済み一覧（本文なし）
    - `cms.posts.getStaticParams()` / `getStaticPaths()` — SSG 用
    - `cms.posts.adjacent(slug)` — 前後記事ナビゲーション
    - `cms.posts.revalidate()` / `cms.posts.prefetch()`
    - `cms.$revalidate(scope?)` / `cms.$getCachedImage(hash)` / `cms.$handler(opts)` — グローバル操作
  - 本文を **`ContentBlock[]` の AST 第一級** で返す仕様に。`post.content.blocks` は常に同梱、`html()` / `markdown()` は遅延メソッド。
  - `DataSource<T>` インターフェースを core に新設（ユーザー非公開・将来の拡張点）。`loadBlocks` / `getLastModified` / `getListVersion` / `resolveImageUrl` / `parseWebhook` を追加。
  - `cms.$handler()` — Web Standard な Request/Response ルーター（画像プロキシ / Webhook 受信）。Next / Hono / Cloudflare Workers で共通利用可能。
  - CLI 生成物 `nhc-schema.ts` は `nhcDataSources`（`createNotionCollection` 呼び出し済み）を出力。ユーザーは `createCMS({ dataSources: nhcDataSources })` だけで良い。
  - 旧 `cms.list()` / `cms.find()` / `cms.cache.*` / `cms.query()` / `QueryBuilder` / `cms.createCachedImageResponse()` / `SchemaConfig` / `DataSourceAdapter` は削除。
  - `adapter-next` の `createImageRouteHandler` / `createRevalidateRouteHandler` は新 API に合わせて書き直し（`$getCachedImage` / `$revalidate` を内部で使用）。
  - 新 example: `examples/node-hono` を追加。実 Notion に接続して getItem / getList / blocks 取得・画像プロキシ・revalidate の動作を検証済み。

- bb693f1: 単一ソース CMS を廃止し `createNodeCMS` / `createCloudflareCMS` をマルチソース一本化しました（破壊的変更）。

  - `createCloudflareCMSMulti` / `createNodeMultiCMS` を `createCloudflareCMS` / `createNodeCMS` に改名し、旧単一ソース版のファクトリは削除しました。`nhc generate` が生成した `nhcSchema` を渡すと、ソース名でアクセスできる `CMS` のマップが返ります。
  - `MultiSourceEntry` / `MultiSourceSchema` / `MultiCMSResult` を `SourceEntry` / `NHCSchema` / `CMSMap` に改名し、`@notion-headless-cms/source-notion` に一元化しました（両アダプタで重複していた定義を削除）。
  - `CloudflareCMSEnv` から `NOTION_DATA_SOURCE_ID` / `DB_NAME` を削除しました。各ソースの `dataSourceId` は `nhcSchema` から取得されます。
  - Notion fetcher のページネーションを `paginate()` ヘルパーに共通化し、`QueryBuilder` のソート・ステータス解決処理を private メソッドに抽出しました。
  - `core/cms.ts` から `buildCachedItem` を `rendering.ts` に分離し、責務を整理しました。
  - `notionAdapter` のオーバーロードを整理し、`as unknown as T` キャストを解消しました。
  - `Logger` の `context` を `LogContext` 型で構造化しました（後方互換あり）。`tsconfig.json` に `useUnknownInCatchVariables` を明示しました。
  - CLI の `notion-client` のエラー判定を `getErrorCode` ヘルパーに統合しました（挙動変更なし）。

- Updated dependencies [19cb87a]
- Updated dependencies [7192646]
  - @notion-headless-cms/renderer@0.1.2

## 0.1.2

### Patch Changes

- 20b0cfc: ライブラリとしての完成度を高める API 改善

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

- Updated dependencies [6c36d76]
- Updated dependencies [5763f19]
  - @notion-headless-cms/renderer@0.1.1

## 0.1.1

### Patch Changes

- 8f69e55: update
- Updated dependencies [8f69e55]
  - @notion-headless-cms/transformer@0.1.1

## 0.1.0

### Minor Changes

- 25c018d: update version

### Patch Changes

- Updated dependencies [25c018d]
  - @notion-headless-cms/fetcher@0.1.0
  - @notion-headless-cms/renderer@0.1.0
  - @notion-headless-cms/transformer@0.1.0

## 0.0.7

### Patch Changes

- 52f002f: 宣言的スキーマ定義（`col` / `defineSchema`）を追加し、Notion DB カラムの型を自動推論できるようにした。

  ## source-notion

  - `col` ヘルパーを追加: `title` / `richText` / `date` / `number` / `checkbox` / `url` / `multiSelect` / `select` の各カラム定義を作成できる
  - `defineSchema()` 関数を追加: カラム定義マップから `NotionSchema<T>` を生成し、`notionAdapter` に渡すだけで TypeScript 型が自動推論される
  - `default` オプション対応: 固定値または動的関数（`(page) => T`）を指定でき、Notion プロパティ未設定時のフォールバックとして使われる
  - `default` 未指定は `T | null`、指定ありは `T`（`checkbox` / `multiSelect` は常に非 null）という厳密な型設計
  - `notionAdapter` の `schema` オプションに `defineSchema()` の戻り値を渡せるようになった
  - `publishedStatuses` / `accessibleStatuses` が `schema` の `select` 定義から自動抽出される

  ## core

  - `DataSourceAdapter` インターフェースに `publishedStatuses?` / `accessibleStatuses?` を追加
  - `CMS` コンストラクタで `source` が保持するフィルタ設定を `schema` 未指定時のフォールバックとして参照するようになった

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

## 0.0.6

### Patch Changes

- Updated dependencies [ac73f36]
  - @notion-headless-cms/fetcher@0.0.4
  - @notion-headless-cms/renderer@0.0.4
  - @notion-headless-cms/transformer@0.0.4

## 0.0.5

### Patch Changes

- 0b25275: update dependencies versions

## 0.0.4

### Patch Changes

- 5b11fc1: env をコンストラクタ（CMSConfig）で受け取るよう変更し、各メソッドの env 引数を削除。
  createCloudflareCMS は env を自動注入するため、呼び出し側での変更は不要。

## 0.0.3

### Patch Changes

- b46fc98: update test
- Updated dependencies [b46fc98]
  - @notion-headless-cms/fetcher@0.0.3
  - @notion-headless-cms/renderer@0.0.3
  - @notion-headless-cms/transformer@0.0.3

## 0.0.2

### Patch Changes

- 5c607b9: update
- Updated dependencies [5c607b9]
  - @notion-headless-cms/fetcher@0.0.2
  - @notion-headless-cms/renderer@0.0.2
  - @notion-headless-cms/transformer@0.0.2
