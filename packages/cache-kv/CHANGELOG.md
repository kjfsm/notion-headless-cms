# @notion-headless-cms/cache-kv

## 0.1.12

### Patch Changes

- ac7c5cc: メタデータと本文を独立キーに分離。`getItem()` を非同期遅延ロード化、`checkForUpdate` を軽量化、useSWR 連携 API を追加（破壊的変更）。

  ## なぜ

  - `CachedItem` が `{ html, item, blocks?, markdown?, ... }` を 1 JSON に統合していたため、メタだけ欲しい場合でも HTML 込みのフルペイロードが転送される
  - `checkForUpdate` が `revalidate()` で cache を破棄してから `getItem()` で **強制的に HTML を再レンダリング** していた
  - クライアント側 (useSWR 等) で「メタを即時表示、本文は遅延ロード」が表現できなかった

  ## 主な変更

  ### 公開 API

  新規:

  - `cms.posts.getItemMeta(slug): Promise<T | null>` — メタのみ。useSWR の fetcher として直接渡せる
  - `cms.posts.getItemContent(slug): Promise<ItemContentPayload | null>` — 本文 (`html` / `markdown` / `blocks` / `notionUpdatedAt`) のみ
  - `CachedItemMeta<T>` / `CachedItemContent` / `ItemContentPayload` 型を export

  挙動変更:

  - `getItem(slug)`: メタは即座に返り、`item.content.html()` / `markdown()` / `blocks()` を呼んだ時点で初めて本文をロード（lazy）
  - `checkForUpdate({ slug, since })`: cache を破棄せず、メタのみで差分判定。差分検出時は `invalidate({ kind: "content" })` + `waitUntil` でバックグラウンド再生成。戻り値は `{ changed: true; meta: T }`（旧: `{ changed: true; item: ItemWithContent<T> }`）
  - `checkListForUpdate`: 個別アイテムの content cache は触らず、リストのみ更新

  破壊的変更:

  - `CachedItem<T>` 型を削除。代わりに `CachedItemMeta<T>` と `CachedItemContent` を使う
  - `DocumentCacheAdapter` の `getItem`/`setItem` を `getItemMeta`/`setItemMeta` + `getItemContent`/`setItemContent` に分割
  - `ContentResult.blocks` を `() => Promise<ContentBlock[]>` に変更（同期 getter から async メソッドへ）
  - `CMSHooks.beforeCache` を `beforeCacheMeta` + `beforeCacheContent` に分割
  - `InvalidateScope` に `kind?: "meta" | "content" | "all"` を追加。アダプタ実装はこの粒度を尊重する

  ### ストレージキー設計

  | Adapter | meta key                        | content key                        | list key               |
  | ------- | ------------------------------- | ---------------------------------- | ---------------------- |
  | R2      | `{prefix}meta/{slug}.json`      | `{prefix}content/{slug}.json`      | `{prefix}content.json` |
  | KV      | `{prefix}meta:{slug}`           | `{prefix}content:{slug}`           | `{prefix}content`      |
  | Next.js | tag `nhc:col:{c}:slug:{s}:meta` | tag `nhc:col:{c}:slug:{s}:content` | tag `nhc:col:{c}`      |

  R2 / KV のアダプタは `delete` / `list` を要求する `R2BucketLike` / `KVNamespaceLike` インターフェースを公開（Cloudflare Workers の R2Bucket / KVNamespace と structural に互換）。

  ### 移行ガイド

  ```diff
  - const cached = await cms.posts.docCache.getItem(slug);
  + const meta = await cms.posts.docCache.getItemMeta(slug);
  + const content = await cms.posts.docCache.getItemContent(slug);

  - if (result.changed) console.log(result.item);
  + if (result.changed) console.log(result.meta); // ItemWithContent ではなく T

  - const blocks = post.content.blocks;
  + const blocks = await post.content.blocks();

  - hooks: { beforeCache: (cached) => ({ ...cached, html: rewrite(cached.html) }) }
  + hooks: { beforeCacheContent: (content) => ({ ...content, html: rewrite(content.html) }) }
  ```

  ### useSWR レシピ

  `docs/recipes/useswr-integration.md` 参照。クライアント側で `useSWR("/api/.../meta", ...)` と `useSWR("/api/.../content", ...)` を別キーで張り、`checkForUpdate` 戻り値の `meta` で `mutate` する典型パターンを記載。

- Updated dependencies [ac7c5cc]
  - @notion-headless-cms/core@0.3.8

## 0.1.11

### Patch Changes

- Updated dependencies [5703a6c]
  - @notion-headless-cms/core@0.3.7

## 0.1.10

### Patch Changes

- 68b01d7: コード品質改善（正式リリース前）

  - `BuiltInCMSErrorCode` を公開型として export し、IDE hover で各エラーコードの説明を参照できるようにした
  - `withRetry()` の jitter=true コードパスのテストを追加
  - `getItem()` 並行呼び出し時の一貫性テストを追加
  - handler の PUT/DELETE/POST など未対応 HTTP メソッドへの応答テストを追加
  - vitest coverage 閾値（lines/functions/branches: 80/80/70%）を設定
  - `withRetry()`、`buildCacheImageFn()` に JSDoc を追加
  - `loadDefaultRenderer` から不要な `export` を削除
  - `cache-r2/r2-cache.ts` の冗長な `R2BucketLike` 再エクスポートを削除
  - `@cloudflare/workers-types` の未使用 devDependency を削除
  - 不要ファイル（`cache-r2/src/r2.ts`、`renderer/src/transformer/index.ts`）を削除
  - vitest.workspace.ts から削除済みパッケージ（adapter-cloudflare、adapter-node）の参照を削除
  - Knip を CI（lint ジョブ）に組み込み、未使用コード・依存を自動検出
  - CONTRIBUTING.md を新規作成

- Updated dependencies [68b01d7]
  - @notion-headless-cms/core@0.3.6

## 0.1.9

### Patch Changes

- Updated dependencies [233af88]
  - @notion-headless-cms/core@0.3.5

## 0.1.8

### Patch Changes

- Updated dependencies [83a5cca]
  - @notion-headless-cms/core@0.3.4

## 0.1.7

### Patch Changes

- Updated dependencies [e719435]
  - @notion-headless-cms/core@0.3.3

## 0.1.6

### Patch Changes

- Updated dependencies [7b06514]
  - @notion-headless-cms/core@0.3.2

## 0.1.5

### Patch Changes

- Updated dependencies [6f34d49]
  - @notion-headless-cms/core@0.3.1

## 0.1.4

### Patch Changes

- Updated dependencies [c955826]
  - @notion-headless-cms/core@0.3.0

## 0.1.3

### Patch Changes

- Updated dependencies [cea9495]
  - @notion-headless-cms/core@0.2.1

## 0.1.2

### Patch Changes

- 61911e6: 0.1.1 で npm 公開時に tarball へ `dist/` が含まれず import に失敗していた不具合を再公開で解消。Version Packages PR に対する `publish --dry-run` ワークフローを追加し、同種の事故を CI で事前検知できるようにした。

## 0.1.1

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
