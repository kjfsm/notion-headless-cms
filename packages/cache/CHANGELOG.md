# @notion-headless-cms/cache

## 3.0.0

### Major Changes

- v3 ゼロベース再設計（epic #437）を機に、モノレポ全パッケージのバージョン番号を
  `3.0.0` に統一する。この changeset 単体では各パッケージのコードに変更は無い
  （他の changeset で実際の変更が入るパッケージ以外は純粋なバージョン整列）。
  今回のみの一括整列であり、以降は各パッケージ独立のバージョニングに戻す
  （`.changeset/config.json` の `fixed`/`linked` は変更しない）。

### Patch Changes

- Updated dependencies
  - @notion-headless-cms/core@1.0.0

## 0.1.14

### Patch Changes

- Updated dependencies [0dbc727]
  - @notion-headless-cms/core@0.5.14

## 0.1.13

### Patch Changes

- Updated dependencies [a3b567f]
  - @notion-headless-cms/core@0.5.13

## 0.1.12

### Patch Changes

- Updated dependencies [bd05d42]
  - @notion-headless-cms/core@0.5.12

## 0.1.11

### Patch Changes

- Updated dependencies [5dab6df]
  - @notion-headless-cms/core@0.5.11

## 0.1.10

### Patch Changes

- 127f482: 画像キャッシュキーと realtime 通知を改善する。

  - 画像キャッシュキーを Notion 署名ホスト（`prod-files-secure.*.amazonaws.com` / `*.notion.so` / `*.notionusercontent.com`）に限り署名クエリを除いた `origin + pathname` で算出するようにし、再署名のたびに同一画像が別ハッシュで再保存され孤児化する問題を解消（外部画像はクエリを保持。fetch は従来どおりフル URL）。
  - `ImageCacheOps` に任意メソッド `has?(hash)` を追加し、`fetchAndCacheImage` の存在確認を本体 DL を伴う `get` から `has`（R2 は `R2BucketLike.head` 経由）へ切り替えて無駄 I/O を削減。未実装アダプタは `get` にフォールバック（後方互換）。
  - `RealtimeHubDO.webSocketClose` が予約コード（1005/1006/1015）や範囲外コードで `RangeError` を投げないようガードを追加。
  - webhook 由来の `warmByPageId` / `revalidateList`（`refreshList`）が list チャンネル（slug なし）へも publish するようにし、一覧購読クライアントへ新規公開・並び順変化を push できるようにした。

  公開 API シグネチャの破壊的変更はなし（`has` / `head` は任意追加）。

- Updated dependencies [127f482]
  - @notion-headless-cms/core@0.5.10

## 0.1.9

### Patch Changes

- 8b11e1c: 更新検知を Notion 実データ基準に再設計した（破壊的変更）。

  - `SWRConfig`: `ttlMs` を廃止し、`recheckWindowMs`（Notion 再照会の最小間隔=coalescing、既定 30 秒）と `staleBlockMs`（ブロック閾値、未指定時は webhook secret あり → 無期限／なし →7 日）に分離。
  - `find()` は「新しければ即キャッシュ表示＋裏で Notion 突合（recheck ウィンドウ内は照会しない＝複数端末を集約）／古ければブロッキング再取得」になり、`FindOptions.force` で明示リロード時にウィンドウを無視して最新を取得できる。
  - Handler: 副作用付き GET だった `GET /versions` を廃止し、`POST /check/{collection}/{slug}?v=&force=` に一本化（Notion を coalescing 付きで実照会し `{ stale, version }` を返す）。`HandlerAdapter.peekVersionFor` と `CollectionClient.peekVersion` を削除。
  - `<NotionRevalidator>`: ポーリングを廃止し、mount／再フォーカス契機で `POST /check` を叩き `stale` のときだけ revalidate する方式へ。`realtime`（Durable Object）設定時はポーリングを停止し WebSocket push を主経路にする。
  - 新規 `isReloadRequest(req)` を `@notion-headless-cms/client` から提供（`Cache-Control: no-cache`/`max-age=0` を検出）。SSR ローダーで `find(slug, { force: isReloadRequest(request) })` に使う。

- Updated dependencies [8b11e1c]
  - @notion-headless-cms/core@0.5.9

## 0.1.8

### Patch Changes

- 4303b7b: 更新通知（push）の Cloudflare トランスポートを追加。`@notion-headless-cms/cache/realtime` に Durable Object(WebSocket Hibernation) ハブ `RealtimeHubDO` と `durableObjectRealtime({ namespace })`（`RealtimeAdapter` 実装）を追加し、`@notion-headless-cms/client/cloudflare` から re-export。`createCMS({ realtime })` で受け取り `createClient` へ流す。クライアントは `?collection=&slug=` 付きで WS 購読し、`publish` が該当 channel tag へ broadcast する。構造型で受けるため `@cloudflare/workers-types` への実依存は持たない。
- Updated dependencies [4303b7b]
  - @notion-headless-cms/core@0.5.8

## 0.1.7

### Patch Changes

- Updated dependencies [4d81ddb]
  - @notion-headless-cms/core@0.5.7

## 0.1.6

### Patch Changes

- Updated dependencies [7097371]
  - @notion-headless-cms/core@0.5.6

## 0.1.5

### Patch Changes

- Updated dependencies [29040ac]
  - @notion-headless-cms/core@0.5.5

## 0.1.4

### Patch Changes

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4

## 0.1.3

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3

## 0.1.2

### Patch Changes

- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2

## 0.1.1

### Patch Changes

- Updated dependencies [86585a7]
  - @notion-headless-cms/core@0.5.1

## 0.1.0

### Minor Changes

- 054e3d6: `nodePreset` / `cloudflarePreset` のシグネチャを `{ cache, swr, ...(waitUntil) }` 共通契約に対称化 (Issue #313 / M2)。

  - `cloudflarePreset` に `swr` を追加 (デフォルト ttlMs 5 分)、新 `opts.swr` で上書き可能
  - `DEFAULT_RATE_LIMITER` 定数を core から export し、`RateLimiterConfig` のデフォルト値 (`maxConcurrent: 3`, `retryOn: [429, 502, 503]`, `maxRetries: 4`, `baseDelayMs: 1000`) を IDE 補完可能にした

  （`nextPreset` は v2 で `@notion-headless-cms/client/next` に集約済み）

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0

## 0.0.19

### Patch Changes

- Updated dependencies [c55a06a]
- Updated dependencies [8e73f8e]
- Updated dependencies [64b7d32]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0

## 0.0.18

### Patch Changes

- Updated dependencies [f6af509]
  - @notion-headless-cms/core@0.3.25

## 0.0.17

### Patch Changes

- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/core@0.3.24

## 0.0.16

### Patch Changes

- Updated dependencies [7f2668a]
  - @notion-headless-cms/core@0.3.23

## 0.0.15

### Patch Changes

- 700ca69: 完全刷新: nodePreset・メタパッケージ・パッケージ rename・CMSError 拡張・cloudflarePreset ctx 必須化

  ## 破壊的変更

  ### @notion-headless-cms/core
  - `createClient` のサンプルコードを `sources` + `nodePreset()` 形式に刷新
  - `ContentConfig.imageProxyBase` を削除（`CreateClientOptions.imageProxyBase` を使うこと）
  - 公開 export から `CollectionDef` / `CollectionsConfig` / `InferCollectionItem` / `CollectionClientImpl` / `collectionKey` / `CMSAdapter` / `MergeSourceCollections` を削除（`@notion-headless-cms/core/source-author` サブパスから import すること）
  - `CMSError` に `nextSteps?: readonly string[]` / `docsUrl?: string` / `format()` を追加

  ### @notion-headless-cms/cache
  - `cloudflarePreset` の `ctx` が必須になった（省略すると SWR 背景更新が Works ランタイムに打ち切られる）
  - テスト用途には `cloudflarePreset.forTest({ env })` を提供

  ### @notion-headless-cms/notion-source
  - `CMSAdapter` / `CollectionDef` の import 元を `@notion-headless-cms/core/source-author` に変更

  ## 新機能

  ### @notion-headless-cms/core
  - `nodePreset(opts?)` を追加。`...nodePreset()` を `createClient` にスプレッドするだけで Node.js の標準構成（memoryCache + SWR 5 分）が有効になる
  - `@notion-headless-cms/core/source-author` サブパスを追加。データソースアダプター実装者向けの型を分離
  - `@notion-headless-cms/core/preset/node` サブパスを追加

  ## パッケージ rename (旧パッケージは廃止)
  - `@notion-headless-cms/notion-embed` → `@notion-headless-cms/block-html`
  - `@notion-headless-cms/renderer` → `@notion-headless-cms/markdown-html`
  - `@notion-headless-cms/adapter-next` → `@notion-headless-cms/next` に統合

  ## 新規メタパッケージ
  - `@notion-headless-cms/node`: Node.js 向け (core + notion-source + markdown-html + nodePreset)
  - `@notion-headless-cms/cloudflare`: Cloudflare Workers 向け (core + notion-source + cache/cloudflare + block-html)
  - `@notion-headless-cms/next`: Next.js 向け (core + notion-source + markdown-html + createNextHandler)

- Updated dependencies [700ca69]
  - @notion-headless-cms/core@0.3.22

## 0.0.14

### Patch Changes

- Updated dependencies [64057f4]
  - @notion-headless-cms/core@0.3.21

## 0.0.13

### Patch Changes

- 52a9f0d: `@notion-headless-cms/cache/cloudflare` から `cloudflarePreset({ env, ctx })` を追加。`createClient` に展開するだけで KV/R2 キャッシュと `waitUntil` を一括で注入できる。`ctx.waitUntil` を渡すことで SWR のバックグラウンド更新が Cloudflare Workers のレスポンス送信後も完走し、Notion 側の更新が KV キャッシュに確実に反映されるようになる。
- Updated dependencies [52a9f0d]
- Updated dependencies [52a9f0d]
  - @notion-headless-cms/core@0.3.20

## 0.0.12

### Patch Changes

- Updated dependencies [30b576e]
  - @notion-headless-cms/core@0.3.19

## 0.0.11

### Patch Changes

- Updated dependencies [efd3c2f]
  - @notion-headless-cms/core@0.3.18

## 0.0.10

### Patch Changes

- Updated dependencies [2257467]
  - @notion-headless-cms/core@0.3.17

## 0.0.9

### Patch Changes

- @notion-headless-cms/core@0.3.16

## 0.0.8

### Patch Changes

- 71702e6: ライブラリ使い勝手改善

  ### 主な変更点

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

- Updated dependencies [71702e6]
  - @notion-headless-cms/core@0.3.15

## 0.0.7

### Patch Changes

- Updated dependencies [63f5f38]
  - @notion-headless-cms/core@0.3.14

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
