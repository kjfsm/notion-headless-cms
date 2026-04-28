# @notion-headless-cms/cli

## 1.0.14

### Patch Changes

- bccd931: Notion ページの最終編集日時を BaseContentItem.lastEditedTime として自動セット。

  - **@notion-headless-cms/core**: `BaseContentItem` に `lastEditedTime?: string` フィールドを追加し、Notion の `page.last_edited_time` に対応するシステムフィールドとして定義
  - **@notion-headless-cms/notion-orm**: `mapItemFromPropertyMap()` / `mapItem()` / `parseMapping()` が `page.last_edited_time` から `lastEditedTime` を自動セット。`SystemField` / `SYSTEM_FIELDS` に `"lastEditedTime"` を追加
  - **@notion-headless-cms/cli**: Notion の `last_edited_time` 型を未サポートとしてスキップ（生成コードは DB 列のみ対象）

- Updated dependencies [bccd931]
  - @notion-headless-cms/core@0.3.12

## 1.0.13

### Patch Changes

- bac925b: Notion `select` 型プロパティの生成型を `string | null` に変更

  これまで Notion の `select` / `status` 型は両方ともリテラル union（例: `"Alice" | null`）を生成していた。
  `select` 型はユーザーが Notion UI から自由に選択肢を追加できるため、新しい選択肢が追加されるたびに
  `nhc generate` の再実行が必要になる問題があった。

  - `status` 型（ワークフロー状態）→ 引き続きリテラル union（例: `"下書き" | "公開済み" | null`）
  - `select` 型（著者・カテゴリ等）→ `string | null` に変更

## 1.0.12

### Patch Changes

- Updated dependencies [757c7e3]
  - @notion-headless-cms/core@0.3.11

## 1.0.11

### Patch Changes

- 24bf322: `BaseContentItem.status` と `publishedAt` を `string | null` 許容に変更し、`nhc generate` が `slugField` を `string`（null 非許容）で生成するよう修正

  - `BaseContentItem.status` を `string | null | undefined` に変更（Notion の select 型が null を返す場合があるため）
  - `BaseContentItem.publishedAt` を `string | null | undefined` に変更（同上）
  - `codegen.ts`: `slugField` に指定されたフィールドの型を `string | null` ではなく `string` で生成（slug なしのアイテムは CMS からアクセスされないため）
  - `collection.ts` / `notion-adapter.ts`: `status` の null ガードを `!= null`（null/undefined の両方を弾く）に修正

- Updated dependencies [24bf322]
  - @notion-headless-cms/core@0.3.10

## 1.0.10

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

## 1.0.9

### Patch Changes

- Updated dependencies [ac7c5cc]
  - @notion-headless-cms/core@0.3.8

## 1.0.8

### Patch Changes

- Updated dependencies [5703a6c]
  - @notion-headless-cms/core@0.3.7

## 1.0.7

### Patch Changes

- 462732a: generate: HTTP キャッシュ無効化と非 ASCII プロパティ名の厳密エラー化

  - Notion API 呼び出しに `cache: "no-store"` を付与し、generate が常に最新のスキーマ情報を取得するようにした
  - TypeScript 識別子に変換できない非 ASCII プロパティ名（例: 日本語）を `columnMappings` 未指定のまま渡した場合、`property_N` に黙認する挙動を廃止し `CMSError (cli/schema_invalid)` を throw するように変更した

  **移行**: 日本語等の非 ASCII プロパティ名がある場合は `nhc.config.ts` で `columnMappings` を指定してください。

## 1.0.6

### Patch Changes

- e19b542: `dbName` での DB 解決を完全一致のみに変更

  - `nhc generate` での `dbName` 検索は完全一致のみを採用するようにした（部分一致のフォールバックを削除）
  - 完全一致する DB が無い場合は `cli/notion_api_failed` で generate を失敗させる
  - 同じ Notion インテグレーションから類似名の DB が複数アクセスできる場合の取り違えを防ぐ

- Updated dependencies [68b01d7]
  - @notion-headless-cms/core@0.3.6

## 1.0.5

### Patch Changes

- Updated dependencies [233af88]
  - @notion-headless-cms/core@0.3.5

## 1.0.4

### Patch Changes

- Updated dependencies [83a5cca]
  - @notion-headless-cms/core@0.3.4

## 1.0.3

### Patch Changes

- Updated dependencies [e719435]
  - @notion-headless-cms/core@0.3.3

## 1.0.2

### Patch Changes

- Updated dependencies [7b06514]
  - @notion-headless-cms/core@0.3.2

## 1.0.1

### Patch Changes

- 6f34d49: 責務分離リファクタリング: ORM は DB クエリ専念、renderer が Transformer を公開

  - **renderer**: `Transformer`・`BlockHandler`・`TransformerConfig`・`TransformContext`・`BlockConverter` を公開 API として追加。`@notionhq/client` と `notion-to-md` をオプショナル peerDeps に追加
  - **notion-orm**: 内部 `transformer/` を renderer へ移動し `@notion-headless-cms/renderer` に依存変更。`NotionFieldType.select` から `published`/`accessible` フィールド削除。`NotionSchema` から `publishedStatuses`/`accessibleStatuses` 削除
  - **core**: `DataSource` インターフェースから `publishedStatuses`/`accessibleStatuses` を削除。公開条件の唯一の権威は `createCMS({ collections })` の `CollectionSemantics` に統一
  - **cli**: `nhc init` テンプレートを `publishedStatuses` は `createCMS({ collections })` で設定するパターンに更新

- Updated dependencies [6f34d49]
  - @notion-headless-cms/core@0.3.1

## 1.0.0

### Major Changes

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

## 0.1.6

### Patch Changes

- 15d5091: fix: slug を rich_text 専用にマッピング変更

  - `queryPageBySlug` のフィルタを常に `rich_text` 型に統一（`title` 型フィルタを廃止）
  - `nhc generate` の slug 自動検出を `rich_text` 型プロパティ（"slug"/"Slug"/"スラッグ"）専用に変更
  - DB に対象の `rich_text` プロパティが存在しない場合、generate がエラーで失敗するように変更

## 0.1.5

### Patch Changes

- 22ab39f: `nhc generate` が生成する Zod スキーマに `title: z.string().nullable().optional()` を追加。`item.title` が型・ランタイム両方で利用可能になる。

## 0.1.4

### Patch Changes

- Updated dependencies [cea9495]
  - @notion-headless-cms/core@0.2.1

## 0.1.3

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

## 0.1.2

### Patch Changes

- 19cb87a: ビルド・CI/CD・Wrangler 設定の基盤を改善しました。ランタイム挙動への影響はありません。

  - 公開時に **npm provenance** を有効化し、各パッケージの `publishConfig` に `"provenance": true` を追加。GitHub Actions の OIDC（`id-token: write`）と連動し、sigstore 証跡付きで公開されます。
  - `@notion-headless-cms/core` と `@notion-headless-cms/source-notion` の `publishConfig.exports` の冗長な重複定義を削除（通常の `exports` と一致していたため）。

- 0a938ab: `nhc generate` 実行時に Notion API が一時的なエラー（429 / 502 / 503 / 504）を返した場合、指数バックオフでリトライするようになりました（最大 4 回）。CI の間欠的な失敗（"DNS cache overflow" など）に対してより安定します。
- f169f34: `nhc init` / `nhc generate` に `-s, --silent` オプションを追加。CI やスクリプトから呼び出す際に stdout ログを抑制できる。エラーは `--silent` でも stderr に出力される。
- 7192646: `package.json` の `exports` で `types` を先頭に移動して TypeScript の型解決を確実にする。

  publint が `types should be the first in the object as conditions are order-sensitive` を報告していたため、全公開パッケージで `exports[*]` のキー順を `types` → `import` に修正した。動作は同じだが TypeScript の resolution で型ファイルが確実に先に解決される。

- f169f34: `nhc init` のテンプレに `import "dotenv/config";` を追加し、`.env` ファイルから `NOTION_TOKEN` 等を読み込めるようにした。`.env` を使わない環境（CI / Cloudflare の `wrangler secret` など）では先頭行を削除すればよい。docs/cli.md に補足を追加。
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

## 0.1.1

### Patch Changes

- b453f2e: CLI ツール（nhc generate / nhc init）とマルチソースクライアントを追加

  - `@notion-headless-cms/cli` を新規追加。`nhc generate` で Notion DB を introspect して `nhc-schema.ts` を生成し、`nhc init` で設定ファイルテンプレートを生成する
  - `createNodeMultiCMS` を `adapter-node` に追加。`nhcSchema` から各ソースの `CMS<T>` インスタンスをまとめて生成する
  - `createCloudflareCMSMulti` を `adapter-cloudflare` に追加。Workers 向けのマルチソースファクトリ
  - `sources` オプションで `published` / `accessible` をクライアント作成時に差し込めるようにし、生成ファイルを編集不要にした
