# @notion-headless-cms/source-notion

## 0.1.12

### Patch Changes

- bccd931: Notion ページの最終編集日時を BaseContentItem.lastEditedTime として自動セット。

  - **@notion-headless-cms/core**: `BaseContentItem` に `lastEditedTime?: string` フィールドを追加し、Notion の `page.last_edited_time` に対応するシステムフィールドとして定義
  - **@notion-headless-cms/notion-orm**: `mapItemFromPropertyMap()` / `mapItem()` / `parseMapping()` が `page.last_edited_time` から `lastEditedTime` を自動セット。`SystemField` / `SYSTEM_FIELDS` に `"lastEditedTime"` を追加
  - **@notion-headless-cms/cli**: Notion の `last_edited_time` 型を未サポートとしてスキップ（生成コードは DB 列のみ対象）

- Updated dependencies [bccd931]
  - @notion-headless-cms/core@0.3.12

## 0.1.11

### Patch Changes

- Updated dependencies [757c7e3]
  - @notion-headless-cms/core@0.3.11

## 0.1.10

### Patch Changes

- 24bf322: `BaseContentItem.status` と `publishedAt` を `string | null` 許容に変更し、`nhc generate` が `slugField` を `string`（null 非許容）で生成するよう修正

  - `BaseContentItem.status` を `string | null | undefined` に変更（Notion の select 型が null を返す場合があるため）
  - `BaseContentItem.publishedAt` を `string | null | undefined` に変更（同上）
  - `codegen.ts`: `slugField` に指定されたフィールドの型を `string | null` ではなく `string` で生成（slug なしのアイテムは CMS からアクセスされないため）
  - `collection.ts` / `notion-adapter.ts`: `status` の null ガードを `!= null`（null/undefined の両方を弾く）に修正

- Updated dependencies [24bf322]
  - @notion-headless-cms/core@0.3.10

## 0.1.9

### Patch Changes

- 17f4201: # CMS 再設計 (実装変更が大きい patch)

  API・パッケージ構成・CLI 生成物を全面的に作り直した。詳細は `docs/migration/v1.md` を参照。

  ## ハイライト

  - **`createCMS` の API を簡素化**:
    - 12 メソッド → 4 メソッド: `get` / `list` / `params` / `cache.{invalidate,warm,adjacent}`
    - `getItem` → `get`、`getList` → `list`、`getStaticParams` → `params`
    - `getItemMeta` / `getItemContent` / `getStaticPaths` / `checkForUpdate` / `checkListForUpdate` を削除 (SWR は内部で自動)
    - `prefetch` → `cache.warm`、`revalidate(All)` → `cache.invalidate`、`adjacent` → `cache.adjacent`
    - `cms.$revalidate(scope?)` → `cms.$invalidate(scope?)`
  - **戻り値の刷新**:
    - `get(slug)` は `T & { render(opts?) }` を返し、`render()` 呼び出し時に本文を遅延ロード
    - `result.content.html()/markdown()/blocks()` → `result.render({ format?: "html" \| "markdown" })`
    - `list()` は `T[]` を直接返す (旧 `{ items, version }` を廃止)
  - **キャッシュ統合 (`@notion-headless-cms/cache`)**:
    - `cache-r2` / `cache-kv` / `cache-next` を 1 パッケージに集約
    - `memoryCache()` (doc + image)、`r2Cache()` (image)、`kvCache()` (doc)、`cloudflareCache(env)` (KV+R2)、`nextCache()` (Next.js ISR)
    - `cache: CacheAdapter \| CacheAdapter[]` で柔軟に組み合わせ可能
    - `nodePreset` / `cloudflarePreset` を削除
  - **CLI が完全な `nhc.ts` を生成**:
    - 旧 `nhc-schema.ts` (型のみ) → 新 `nhc.ts` (型 + `createCMS` ファクトリ)
    - ユーザーは `import { createCMS } from "./generated/nhc"` で即座に使える
    - select / status のオプションが literal union 型として生成される
    - `nhc.config.ts` の `dataSources: [...]` → `collections: { posts: { ... } }`
  - **パフォーマンス改善**:
    - renderer の unified processor をモジュールスコープでメモ化 (再構築コスト削減)
    - 画像 URL → SHA-256 ハッシュをプロセス内 LRU でメモ化
  - **アーキテクチャ整理**:
    - `CacheAdapter` インターフェースを `handles` フィールドで doc / image に振り分け
    - `scopeDocumentCache` を廃止 (アダプタが直接 `(collection, slug)` を受け取る)
    - core は `CacheAdapter / DocumentCacheOps / ImageCacheOps` を公開、`DocumentCacheAdapter / ImageCacheAdapter` は削除

  ## 削除されたパッケージ

  - `@notion-headless-cms/cache-r2` → `@notion-headless-cms/cache/cloudflare` の `r2Cache`
  - `@notion-headless-cms/cache-kv` → `@notion-headless-cms/cache/cloudflare` の `kvCache`
  - `@notion-headless-cms/cache-next` → `@notion-headless-cms/cache/next` の `nextCache`

  ## 移行例

  ```ts
  // Before (v0.x)
  import { createCMS, nodePreset } from "@notion-headless-cms/core";
  import { cmsDataSources } from "./generated/nhc-schema";

  const cms = createCMS({
    ...nodePreset({ ttlMs: 5 * 60_000 }),
    dataSources: cmsDataSources,
    collections: { posts: { slug: "slug", publishedStatuses: ["公開済み"] } },
  });
  const { items } = await cms.posts.getList();
  const post = await cms.posts.getItem("hello");
  const html = await post?.content.html();

  // After (v1)
  import { createCMS } from "./generated/nhc";
  import { memoryCache } from "@notion-headless-cms/cache";

  const cms = createCMS({
    notionToken: process.env.NOTION_TOKEN!,
    cache: memoryCache(),
    ttlMs: 5 * 60_000,
  });
  const items = await cms.posts.list();
  const post = await cms.posts.get("hello");
  const html = await post?.render();
  ```

- Updated dependencies [17f4201]
  - @notion-headless-cms/core@0.3.9
  - @notion-headless-cms/renderer@0.1.6

## 0.1.8

### Patch Changes

- Updated dependencies [e6d043b]
- Updated dependencies [ac7c5cc]
  - @notion-headless-cms/renderer@0.1.5
  - @notion-headless-cms/core@0.3.8

## 0.1.7

### Patch Changes

- Updated dependencies [5703a6c]
  - @notion-headless-cms/core@0.3.7

## 0.1.6

### Patch Changes

- Updated dependencies [68b01d7]
  - @notion-headless-cms/core@0.3.6

## 0.1.5

### Patch Changes

- Updated dependencies [233af88]
  - @notion-headless-cms/core@0.3.5

## 0.1.4

### Patch Changes

- Updated dependencies [83a5cca]
  - @notion-headless-cms/core@0.3.4

## 0.1.3

### Patch Changes

- Updated dependencies [e719435]
  - @notion-headless-cms/core@0.3.3

## 0.1.2

### Patch Changes

- 7b06514: 後方互換コード・フォールバック・デッドコードを削除（破壊的変更）

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

- Updated dependencies [7b06514]
  - @notion-headless-cms/core@0.3.2

## 0.1.1

### Patch Changes

- 6f34d49: 責務分離リファクタリング: ORM は DB クエリ専念、renderer が Transformer を公開

  - **renderer**: `Transformer`・`BlockHandler`・`TransformerConfig`・`TransformContext`・`BlockConverter` を公開 API として追加。`@notionhq/client` と `notion-to-md` をオプショナル peerDeps に追加
  - **notion-orm**: 内部 `transformer/` を renderer へ移動し `@notion-headless-cms/renderer` に依存変更。`NotionFieldType.select` から `published`/`accessible` フィールド削除。`NotionSchema` から `publishedStatuses`/`accessibleStatuses` 削除
  - **core**: `DataSource` インターフェースから `publishedStatuses`/`accessibleStatuses` を削除。公開条件の唯一の権威は `createCMS({ collections })` の `CollectionSemantics` に統一
  - **cli**: `nhc init` テンプレートを `publishedStatuses` は `createCMS({ collections })` で設定するパターンに更新

- Updated dependencies [6f34d49]
  - @notion-headless-cms/renderer@0.1.4
  - @notion-headless-cms/core@0.3.1

## 0.1.0

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

### Patch Changes

- Updated dependencies [c955826]
  - @notion-headless-cms/core@0.3.0

## 0.0.6

### Patch Changes

- 15d5091: fix: slug を rich_text 専用にマッピング変更

  - `queryPageBySlug` のフィルタを常に `rich_text` 型に統一（`title` 型フィルタを廃止）
  - `nhc generate` の slug 自動検出を `rich_text` 型プロパティ（"slug"/"Slug"/"スラッグ"）専用に変更
  - DB に対象の `rich_text` プロパティが存在しない場合、generate がエラーで失敗するように変更

## 0.0.5

### Patch Changes

- 1304c1b: `defineSchema` 経由で `title` が取得できないバグと `queryPageBySlug` の `title` 型フィルタ未対応を修正

  - `parseMapping` に title 自動セット処理を追加（`mapItem` と同様に Notion ページタイトルを自動マッピング）
  - `queryPageBySlug` が slug フィールドの型に応じて `title` / `rich_text` フィルタを使い分けるよう修正

## 0.0.4

### Patch Changes

- cea9495: update add title properties
- Updated dependencies [cea9495]
  - @notion-headless-cms/core@0.2.1

## 0.0.3

### Patch Changes

- ebf56ea: `@notion-headless-cms/notion-orm` を npm 公開対象に変更。

  これまで `private: true` のため npm には公開されておらず、CLI が生成する
  `nhc-schema.ts` が `@notion-headless-cms/notion-orm` を import しているにも
  関わらず、別リポジトリからは `pnpm add @notion-headless-cms/notion-orm` で
  解決できない状態だった。README / docs / `docs/migration/v1-orm-split.md` で
  インストールを案内している以上、npm に公開されているのが本来の意図である。

  - `package.json` から `"private": true` を削除し、`publishConfig.access: "public"` と
    `provenance: true` を追加（他の公開パッケージと同じ設定）
  - README 等の表記を「npm に公開されるが、ユーザーは直接 import しない」に更新
  - `.claude/rules/package-boundaries.md` の境界ルールも同期

  ユーザー向けの API には変化なし。CLI 生成物 (`nhc-schema.ts`) が引き続き
  唯一の消費者であり、ユーザーは `@notion-headless-cms/notion-orm` を
  直接 import しない。

## 0.0.2

### Patch Changes

- Updated dependencies [53a93f7]
- Updated dependencies [7791e88]
  - @notion-headless-cms/core@0.2.0

## 0.0.1

### Patch Changes

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

- Updated dependencies [19cb87a]
- Updated dependencies [7192646]
- Updated dependencies [f169f34]
- Updated dependencies [bb693f1]
  - @notion-headless-cms/core@0.1.3

## 0.2.2

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

- Updated dependencies [20b0cfc]
- Updated dependencies [6c36d76]
- Updated dependencies [5763f19]
  - @notion-headless-cms/core@0.1.2

## 0.2.1

### Patch Changes

- 8f69e55: update
- Updated dependencies [8f69e55]
  - @notion-headless-cms/transformer@0.1.1
  - @notion-headless-cms/core@0.1.1

## 0.2.0

### Minor Changes

- 25c018d: update version

### Patch Changes

- Updated dependencies [25c018d]
  - @notion-headless-cms/core@0.1.0
  - @notion-headless-cms/fetcher@0.1.0
  - @notion-headless-cms/transformer@0.1.0

## 0.1.1

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

- Updated dependencies [52f002f]
- Updated dependencies [aada8c0]
  - @notion-headless-cms/core@0.0.7
