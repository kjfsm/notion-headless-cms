# @notion-headless-cms/cache

## 0.0.6

### Patch Changes

- 1bae29d: `NextCacheOptions` から未実装の `revalidate` フィールドを削除。

  このオプションは定義されていたが `nextCache()` の実装で一度も参照されておらず、
  ページレベルの `export const revalidate` と混同しやすかった。

## 0.0.5

### Patch Changes

- c75218d: コード予測可能性向上 PR 4: notion-orm / notion-embed / cache 整理

  - **notion-embed**: `fetchOgp` をキャッシュなし純粋関数に変更。HTTP エラー時は Error を投げる (旧: `console.warn + return {}`)。TTL キャッシュが必要な場合は新設の `createOgpFetcher()` ファクトリを使う。インスタンス間でキャッシュを共有しない
  - **notion-embed**: `fetchOembed` の HTTP エラー時も Error を投げる (旧: `console.warn + return {}`)
  - **notion-embed**: `clearOgpCache()` を削除 (キャッシュがスコープ化されたため不要)
  - **notion-embed**: `extractUrlFromMarkdownLink` / `addHttpsToProtocolRelative` / `isHttpUrl` を公開 API として export
  - **cache**: `cloudflareCache(env, opts)` のシグネチャを `cloudflareCache(bindings, opts)` に変更。`bindings.docCache` / `bindings.imgBucket` に KV / R2 の binding インスタンスを直接渡す (旧: env オブジェクト + binding 名文字列)
  - **notion-orm**: `getPlainText()` の戻り値型を `string | null` に統一 (旧: 空文字列を返すケースがあった)
  - **notion-orm / core**: `isArchived` を `archived` フラグのみに変更し `isInTrash` を独立フィールドとして追加 (旧: `isArchived = in_trash || archived` で 2 フラグを混合)
  - **core**: `buildCacheImageFn` の `hashMemo` をモジュール変数からファクトリスコープローカルに変更。インスタンス間でメモを共有しない

- Updated dependencies [45ee864]
- Updated dependencies [84a5639]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
  - @notion-headless-cms/core@0.3.13

## 0.0.4

### Patch Changes

- Updated dependencies [bccd931]
  - @notion-headless-cms/core@0.3.12

## 0.0.3

### Patch Changes

- Updated dependencies [757c7e3]
  - @notion-headless-cms/core@0.3.11

## 0.0.2

### Patch Changes

- Updated dependencies [24bf322]
  - @notion-headless-cms/core@0.3.10

## 0.0.1

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
