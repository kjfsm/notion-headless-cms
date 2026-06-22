# @notion-headless-cms/core

## 0.5.10

### Patch Changes

- 127f482: 画像キャッシュキーと realtime 通知を改善する。

  - 画像キャッシュキーを Notion 署名ホスト（`prod-files-secure.*.amazonaws.com` / `*.notion.so` / `*.notionusercontent.com`）に限り署名クエリを除いた `origin + pathname` で算出するようにし、再署名のたびに同一画像が別ハッシュで再保存され孤児化する問題を解消（外部画像はクエリを保持。fetch は従来どおりフル URL）。
  - `ImageCacheOps` に任意メソッド `has?(hash)` を追加し、`fetchAndCacheImage` の存在確認を本体 DL を伴う `get` から `has`（R2 は `R2BucketLike.head` 経由）へ切り替えて無駄 I/O を削減。未実装アダプタは `get` にフォールバック（後方互換）。
  - `RealtimeHubDO.webSocketClose` が予約コード（1005/1006/1015）や範囲外コードで `RangeError` を投げないようガードを追加。
  - webhook 由来の `warmByPageId` / `revalidateList`（`refreshList`）が list チャンネル（slug なし）へも publish するようにし、一覧購読クライアントへ新規公開・並び順変化を push できるようにした。

  公開 API シグネチャの破壊的変更はなし（`has` / `head` は任意追加）。

## 0.5.9

### Patch Changes

- 8b11e1c: 更新検知を Notion 実データ基準に再設計した（破壊的変更）。

  - `SWRConfig`: `ttlMs` を廃止し、`recheckWindowMs`（Notion 再照会の最小間隔=coalescing、既定 30 秒）と `staleBlockMs`（ブロック閾値、未指定時は webhook secret あり → 無期限／なし →7 日）に分離。
  - `find()` は「新しければ即キャッシュ表示＋裏で Notion 突合（recheck ウィンドウ内は照会しない＝複数端末を集約）／古ければブロッキング再取得」になり、`FindOptions.force` で明示リロード時にウィンドウを無視して最新を取得できる。
  - Handler: 副作用付き GET だった `GET /versions` を廃止し、`POST /check/{collection}/{slug}?v=&force=` に一本化（Notion を coalescing 付きで実照会し `{ stale, version }` を返す）。`HandlerAdapter.peekVersionFor` と `CollectionClient.peekVersion` を削除。
  - `<NotionRevalidator>`: ポーリングを廃止し、mount／再フォーカス契機で `POST /check` を叩き `stale` のときだけ revalidate する方式へ。`realtime`（Durable Object）設定時はポーリングを停止し WebSocket push を主経路にする。
  - 新規 `isReloadRequest(req)` を `@notion-headless-cms/client` から提供（`Cache-Control: no-cache`/`max-age=0` を検出）。SSR ローダーで `find(slug, { force: isReloadRequest(request) })` に使う。

## 0.5.8

### Patch Changes

- 4303b7b: 更新通知（push）用の `RealtimeAdapter` を追加。`createClient({ realtime })` を指定すると、SWR 差分検出（`find` / `list`）と webhook 再ウォーム（`warmByPageId`）でキャッシュ最新化した直後に `publish({ collection, slug?, version })` を発行し、接続中クライアントへ push できる。未指定なら従来どおり通知しない。`publish` は fail-soft（通知失敗が配信・キャッシュ更新を壊さない）。

## 0.5.7

### Patch Changes

- 4d81ddb: foreground の取得失敗と画像プロキシ 404 を logger に出すようにした

  - `find()` / `list()` / `check()` などユーザー応答に直結する取得がリトライ枯渇後にハード失敗した場合、`logger.error("foreground 取得に失敗", { operation, collection, slug?, code })` を出力する（SWR バックグラウンド更新は従来どおり fail-soft の `warn` のみで、二重出力しない）。
  - 画像プロキシ（`handler` の `GET {basePath}/images/:hash`）でハッシュがキャッシュに無く 404 を返す際に `logger.warn("画像プロキシ: ハッシュ未ヒット", { operation: "handler.image", imageHash, status: 404 })` を出力する。

  Cloudflare Workers などで `logger` を設定していれば、Notion 取得失敗や期限切れ画像の取り逃しをダッシュボードのログで監視できる。

## 0.5.6

### Patch Changes

- 7097371: `cms.<collection>.dbName` を DB 名を埋め込んだプロパティから、実行時に Notion API で取得する非同期メソッド `getDbName(): Promise<string | undefined>` に変更（破壊的変更）。

  - `nhc generate` は schema に `dbName` を埋め込まなくなった。`cms.<collection>.getDbName()` は初回呼び出しで `data_source` を retrieve して表示名を解決し、以降はキャッシュした値を返す。
  - 手書き schema で `dbName` を明示した場合はその値を返し、API を叩かない。
  - `DataSource` インターフェースに任意メソッド `getDbName?(): Promise<string | undefined>` を追加。core はこれに委譲し、未実装なら `undefined` を返す。
  - `CollectionDef.dbName` を廃止（DB 名は DataSource 側で解決する）。

## 0.5.5

### Patch Changes

- 29040ac: コレクションから Notion DB の表示名を参照できる `cms.<collection>.dbName` を追加。`nhc generate` が introspect 時に取得した DB 名を schema に埋め込み、ページ・要素（`kind: "data"`）の両コレクションで参照できる。手書き schema で `dbName` を省略した場合は `undefined`。

## 0.5.4

### Patch Changes

- 919ec7c: 要素（データ）コレクション `kind: "data"` を追加

  URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

  - ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
  - 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
  - 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
  - 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。

## 0.5.3

### Patch Changes

- 85a7cb6: Notion 公式 webhook（integration の Webhooks）受信によるキャッシュの自動ウォームを追加。`createCMS({ notion: { webhookSecret } })`（= `CreateClientOptions.notionWebhookSecret`）を設定すると、`cms.handler()` が `POST {basePath}/notion-webhook` を自動マウントし、`verification_token` 応答・`X-Notion-Signature` の HMAC-SHA256 署名検証・`entity.id`（page）→ slug 逆引きを行って、更新されたページだけをミラー再生成する。初回アクセスのコールドスタート遅延を「ページ更新時」に解消できる。

  あわせて公開 API を追加:

  - `cms.warmByPageId(pageId)` — Notion ページ ID を全コレクション横断で解決し単件ウォームする
  - `cms.<collection>.cache.prime(slug)` — 既存 `warm()` の単件版（1 件だけ取得して meta/content を作り直す）
  - `DataSource.findById?(pageId)` — notion-orm が `pages.retrieve` + parent data source 一致チェックで実装（他 DB のページ混入を防ぐ）

  `core` のゼロ依存は維持（HMAC はグローバル `crypto.subtle` を使用し import しない）。webhook の応答送信後もウォームを完走させるため、設定済みの `waitUntil` をバックグラウンド実行に利用する。

## 0.5.2

### Patch Changes

- a2016b5: `cms.handler()` に更新検知系の 2 ルートを追加し、画像プロキシ・Webhook と同じハンドラ 1 つに集約できるようにする。

  - `GET {basePath}/versions/:collection/:slug` — `peekVersion()`（KV メタのみ、Notion API 非呼び出し）。未登録は `200` + `null`
  - `GET|POST {basePath}/check/:collection/:slug?v={version}` — `check()`（Notion を実照会し差分があればキャッシュ更新）。`{ stale }` を返す。アイテム未存在は `404`

  未知コレクションはいずれも `404`（`handler/unknown_collection`）。`NotionRevalidator` のポーリング先を専用ルート自前実装なしで賄える。

## 0.5.1

### Patch Changes

- 86585a7: Notion 内部リンクの slug 自動解決を追加（#356 / D6）。

  - core に `buildPageLinkMap` / `buildPageIndex` / `normalizePageId` を追加。`cms` のコレクションを走査して `正規化pageId → { href, title }` のプレーンマップを構築する（ゼロ依存・純関数）。URL 既定は `/${collection}/${slug}`、`url` オプションで上書き可。`@notion-headless-cms/client` からも re-export。
  - react-renderer に `pageLinks` プロップを追加。`link_to_page` / page・database mention / `child_page` を `pageLinks` で自サイト URL に解決し、無ければ従来フォールバック。**プレーンオブジェクトのため React Router の loader 戻り値や RSC 境界を越えられる**（関数プロップ `resolvePageUrl` は越えられないため、内部リンクは `pageLinks` を推奨）。
  - `ResolvePageUrlFn` の戻り値を `string | undefined` に緩和（後方互換）。`resolvePageUrl` / `resolvePageTitle` 関数プロップはカスタムルーティング用の escape hatch として存続。

## 0.5.0

### Minor Changes

- 054e3d6: `nodePreset` / `cloudflarePreset` のシグネチャを `{ cache, swr, ...(waitUntil) }` 共通契約に対称化 (Issue #313 / M2)。

  - `cloudflarePreset` に `swr` を追加 (デフォルト ttlMs 5 分)、新 `opts.swr` で上書き可能
  - `DEFAULT_RATE_LIMITER` 定数を core から export し、`RateLimiterConfig` のデフォルト値 (`maxConcurrent: 3`, `retryOn: [429, 502, 503]`, `maxRetries: 4`, `baseDelayMs: 1000`) を IDE 補完可能にした

  （`nextPreset` は v2 で `@notion-headless-cms/client/next` に集約済み）

- 12ddf52: `defineCollection<T>()` ヘルパーと `StrictCollectionDef<T>` 型を新設し、`slugField` / `statusField` を `keyof T & string` で型ガードできるようにした (Issue #314 / M3)。CLI 生成スキーマや手書きの schema で `defineCollection<PostItem>({ slugField: "slag" })` のような誤フィールド名を **コンパイル時に検出**できる。`CollectionDef<T>` 自体は後方互換のため variance を維持。

### Patch Changes

- 6478628: `notionBlocks()` が `undefined` を返したときの警告メッセージを正確化。既定 (blocks 戦略) では設定不要で利用できること、`markdownFetcher` 使用時は markdown→React の Renderer を使うか `blocksFetcher()` に切り替える旨を案内する。挙動は不変。
- e9698a3: `notionBlocks()` がブロックフェッチャ未設定などで `undefined` を返したとき、`notionSource({ fetch: blocksFetcher() })` の設定を促す警告を CollectionClient 単位で一度だけ出すようにした。無言失敗で React レンダリングが空になる問題の発見性を改善する。返り値・公開 API シグネチャは変更なし（挙動互換）。
- f7f0493: `scripts/check-internal-boundary.mjs` を追加し、`packages/*/src/internal/**` への外部 import を CI で禁止 (Issue #315 / M4)。`pnpm lint:boundary` として実行可能、`ci.yml` の lint job に組み込み済み。
- 4183d36: CI verify gate に `pnpm size` (size-limit) を追加し、`publish-dry-run-nightly.yml` で `publint` / `attw` / `size` / `pnpm publish --dry-run` を main の任意時点で毎日検証する (Issue #318 / M7)。`docs/ja/release/meta-package-bump.md` を新設し、changesets の連鎖 bump とレビュー観点を明文化。
- 3f8bd02: 1.0 リリース凍結チェックリスト (`docs/ja/release/1.0-checklist.md`) を新設 (Issue #319 / M8)。公開 API シェイプ・後方互換性・品質ゲート・ドキュメントの 4 区分で凍結対象を列挙し、fixed mode 切替手順 / 1.0-rc.0 リリース手順 / 1.0.0 GA 昇格手順をまとめる。実際の fixed mode 切替・rc 発行はユーザー判断。
- 355f3e1: CI に changeset-check ワークフローを追加し、packages/\*\* に変更がある PR で changeset を必須化 (Issue #306 / S2)。`skip-changeset` ラベルで除外可能。
- 6e1cec6: マルチソース構成のフェイルオーバー (1 つのコレクションが失敗しても他が独立に動く) と、画像キャッシュが Notion 署名 URL の 1 時間失効後も SHA256 ハッシュキーで永続キャッシュから返すことを fakeTimers で明示検証するテストを追加 (Issue #309 / S5)。
- Updated dependencies [3aa3f1e]
- Updated dependencies [2d6b5b8]
  - @notion-headless-cms/markdown-html@1.0.3

## 0.4.0

### Minor Changes

- c55a06a: DX とドキュメント差分の解消 (Issue #332)

  - **core**: 組み込みエラーコード 27 種類すべてに `docsUrl` (docs/ja/errors/index.md へのアンカー) と `nextSteps` の既定値を `CMSError` コンストラクタで自動補完するように。呼び出し側で明示指定した値は引き続き優先される
  - **cli**: `nhc generate` / `nhc init` に `--verbose` / `--debug` フラグを追加。verbose 時は CMSError の `nextSteps` / `docsUrl` を、debug 時はスタックトレースと cause を出力。help に「よくある詰まり所」セクションを追加し、進捗表示も拡充
  - **testing**: 新規パッケージ `@notion-headless-cms/testing` を公開。`createFakeNotionSource({ items })` / `createFakeCache()` / `createFixtureClient(opts)` / `fakeRenderer` を提供。`@notion-headless-cms/core` 以外への依存ゼロ

### Patch Changes

- 8e73f8e: M2: 可観測性の最小セットを追加 (Issue #333)

  - `LogContext` に `traceId` / `backoffMs` を追加
  - `createClient` がクライアント単位の `traceId` を発行し、`withTraceId` で全ログコンテキストに自動付与する (ネスト操作・SWR・retry 経由でも同じ ID が流れる)
  - `cms.traceId` を `CMSGlobalOps` に公開
  - `mergeLoggers` の plugin / direct logger 合成を明文化 (`cms.ts` 内で `withTraceId` を後段に挟む構成へ更新)
  - `RetryConfig.onRetry` のシグネチャに `delayMs` を追加し、ジッター反映後の実際の待機時間を `LogContext.backoffMs` として出せる
  - `CacheAdapter.stats?(): Promise<CacheAdapterStats>` を optional として追加
  - `cms.stats(): Promise<CMSStats>` を新設。doc/img それぞれヒット率・エントリ数・(画像のみ) 合計バイトを返す
  - `memoryCache()` が hit/miss/entries/sizeBytes を集計するように
  - `LogContext` / `CacheAdapterStats` / `CacheAreaStats` を index から re-export

- 64b7d32: M3: キャッシュ層拡張ポイントの整理 (Issue #333)

  - `CacheAdapter` / `DocumentCacheOps` / `ImageCacheOps` の JSDoc を強化
    - `handles` 判定の先勝ちルールを明文化
    - `cms.cacheImage` (= `RenderContext.cacheImage`) と `ImageCacheOps` の責務境界を明示 (adapter から `cacheImage` を呼ばないこと)
    - エラー処理・並列書き込み・fail-soft のガイドラインを追加
  - `docs/ja/recipes/custom-cache.md` に `createFakeCache()` を使ったユニットテストの章を追加し、`handles` 判定と画像プロキシ責務境界の節を追記

- ac2c402: M7: ベンチマークと bundle size 計測の土台を整備 (Issue #333)

  - `.size-limit.json` を現行パッケージ構成 (core / markdown-html / cache / cache-cloudflare / validate) に合わせて更新。廃止された `renderer` / `adapter-next` / `notion-embed` エントリを削除
  - `pnpm size` が正常終了する状態に (next の `@opentelemetry/api` 解決問題を避けるため、`next` 経由のエントリは現状除外)
  - `@notion-headless-cms/core` に `bench` スクリプト (`vitest bench --run`) を追加
  - `packages/core/src/__tests__/cache.bench.ts` を新規追加。最低限の SWR list/find と `stats()` 集計の回帰検知をカバー
  - 上記により `pnpm size` / `pnpm --filter @notion-headless-cms/core bench` を CI から呼び出せるようになった

## 0.3.25

### Patch Changes

- f6af509: Notion コンテンツ取得戦略を差し替え可能化 — Cloudflare Workers Free プランの 50 subrequest 上限対策

  - 新パッケージ `@notion-headless-cms/fetch-blocks`: 既存の `blocks.children.list` 再帰展開を `blocksFetcher()` ファクトリで公開。`/react` サブパスから既存 `NotionRenderer` を `Renderer` として再エクスポート。
  - 新パッケージ `@notion-headless-cms/fetch-markdown`: Notion Markdown export API (`GET /v1/pages/{id}.md`) を 1 リクエストで叩く `markdownFetcher()` を公開。深くネストしたページでも subrequest が 1 で済む。`/react` サブパスから `Renderer` (markdown→HTML) を提供。
  - `notionSource()` に `fetch?: ContentFetcher` オプションを追加。`fetch: markdownFetcher()` のように戦略を差し替えられる。未指定時は従来挙動 (`blocks` 相当) を維持し破壊性なし。
  - `notion-orm`: `ContentFetcher` インターフェース、`FetchContext`、`fetchPageMarkdown` を新規 export。`NotionCollection.loadNotionBlocks` は markdown 戦略選択時に新コード `source/blocks_unsupported` を throw する。
  - `notionSource()` のトップレベル `blocks` / `enrichers` / `ogp` は deprecated。`fetch: blocksFetcher({ blocks, enrichers, ogp })` に移行を推奨 (次のメジャーで削除予定、後方互換は維持)。

  利用例:

  ```ts
  import { notionSource } from "@notion-headless-cms/notion-source";
  import { markdownFetcher } from "@notion-headless-cms/fetch-markdown";

  notionSource({ schema, token, fetch: markdownFetcher() });

  // React 側
  import { Renderer } from "@notion-headless-cms/fetch-markdown/react";
  <Renderer content={post.content} />;
  ```

## 0.3.24

### Patch Changes

- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/markdown-html@1.0.2

## 0.3.23

### Patch Changes

- 7f2668a: KV ポーリングによる SWR バックグラウンド更新完了後の自動再描画を追加

  - `CollectionClient.peekVersion(slug)` を追加: KV のみを読んで `{ notionUpdatedAt, cachedAt }` を返す。Notion API を叩かないため安価なポーリングエンドポイントとして使える
  - `checkAndUpdateItemBg` で差分なし時も常に `cachedAt` を更新するよう変更: ポーリング側が「バックグラウンド確認完了」を `cachedAt` の変化で検出できるようにする
  - `NotionRevalidator` / `useNotionRevalidate` に `poll` オプションを追加: `notionUpdatedAt` 変化で revalidate、`cachedAt` 変化（更新なし）で停止、タイムアウト 30 秒

## 0.3.22

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
  - @notion-headless-cms/markdown-html@1.0.1

## 0.3.21

### Patch Changes

- 64057f4: 後方互換性のために残されていたコードとコメントを削除

  - adapter-next: `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` と `RevalidateHandlerOptions` 型を削除。`createNextHandler` を使用すること
  - notion-embed: YouTube プロバイダの `ogp` オプションを `fetchData` に改名（旧名は廃止、内部実装は oEmbed のまま）
  - notion-embed: `renderTranscription` ハンドラを削除し、`transcription` ブロックは `meeting_notes` と同じレンダリングに統一（`--legacy` 修飾子を削除）
  - react-renderer: `ComponentOverrides.Transcription` スロットを削除。`transcription` ブロックは常に `Unsupported` にフォールバック
  - core: `loadNotionBlocks` 追加以前のキャッシュエントリを再生成する lazy backfill ロジックを削除（古いキャッシュは `cms.invalidate()` で手動更新が必要）
  - docs/migration/ 配下のマイグレーションガイドを一括削除

## 0.3.20

### Patch Changes

- 52a9f0d: Notion 更新の表示反映を 1 行で書ける再検証ヘルパを追加。

  - `@notion-headless-cms/react-renderer/router`: React Router 用の `useNotionRevalidate()` フックと `<NotionRevalidator />` コンポーネント。内部で `useRevalidator` を呼び、loader を再走させる。
  - `@notion-headless-cms/react-renderer/next`: Next.js App Router 用の同 API。内部で `useRouter().refresh()` を呼び、Server Component を再評価させる。
  - `@notion-headless-cms/core/html`: React 非依存の `notionRevalidatorScript()`。Astro / Hono / Express など素の HTML を返すフレームワーク向けに、タブ可視化で `location.reload()` する `<script>` 文字列を返す。

  いずれもクエリパラメータも別 API への fetch も発生せず、フレームワーク本来の再評価機構だけを使う。サーバ側の `cloudflarePreset({ env, ctx })` 等で `waitUntil` を渡しておけば、SWR の bg 更新で KV キャッシュが最新化された次のリクエストで画面が静かに切り替わる。

- 52a9f0d: レビューに伴う細部改善とドキュメント更新。

  - `react-renderer/router` と `react-renderer/next` で重複していた `NotionRevalidateTrigger` / `UseNotionRevalidateOptions` / トリガー処理を `internal/revalidate.ts` に集約し、`useCallback` で revalidate を安定化。
  - `core/html` の `notionRevalidatorScript({ nonce })` で nonce を base64 / base64url 文字（`A-Za-z0-9+/=_-`）に厳格化。属性値ブレイクアウトを未然に防ぐため不正な値は throw する。
  - `docs/recipes/cloudflare-workers.md` を `cloudflarePreset` ベースに全面書き換え、`swr.ttlMs` 推奨を撤廃して「永続キャッシュ + lastEditedTime 検知」方針に揃える。
  - `docs/recipes/nextjs-app-router.md` に `<NotionRevalidator />` セクションを追加。
  - `docs/recipes/useswr-integration.md` に「単純な再検証なら `react-renderer/router` / `react-renderer/next` の方が短い」という導入を追加。
  - `packages/cache/README.md` / `packages/core/README.md` / `packages/react-renderer/README.md` を現状の API と推奨パターンに揃える。

## 0.3.19

### Patch Changes

- 30b576e: `cms.<collection>.list()` の戻り値型を CLI 生成の `XxxItem` interface と互換にする。

  - `PropertyDef` に optional な `options?: readonly string[]` を追加。型レベルで literal union を導出するためのメタ情報で、runtime では参照しない。
  - `notion-source` の型導出を `TSTypeForPropDef<P>` に変更し、`P["options"]` が存在する status カラムを literal union に narrow する。
  - CLI が status カラムの選択肢を `options: ["..."] as const` として `*Properties` に出力するよう変更。

  利用側は `nhc generate` を再実行すること。再生成後は CLI が出力する `XxxItem` interface（例: `FixedPage`）をそのまま `cms.fixedPages.list()` の戻り値型として使えるようになる。

## 0.3.18

### Patch Changes

- efd3c2f: module augmentation で拡張可能な sources API を追加（#227）

  - `@notion-headless-cms/core`: `CMSAdapter` / `CMSSources` / `MergeSourceCollections` を公開。`createClient({ sources: ... })` を新設し、`createCMS` / `CreateCMSOptions` を `createClient` / `CreateClientOptions` にリネーム（破壊的変更）
  - `@notion-headless-cms/notion-source`: 新規パッケージ。`notionSource({ schema, token, publishOptions })` がコレクションを構築する。`declare module` で `sources.notion` キーが解禁される
  - `@notion-headless-cms/cli`: 生成ファイルを `nhc.schema.ts` に変更（DB 構造のみ）。旧 `createCMS` ラッパー / `NhcConfig` / `Nhc` 型の生成を廃止し、`export const schema` を出力する（破壊的変更）

## 0.3.17

### Patch Changes

- 2257467: react-renderer 経由でも Notion ブロックツリーと画像をキャッシュできるようにする。

  - core: `DataSource.loadNotionBlocks` (optional) を追加し、`CachedItemContent` / `ItemWithContent` に `notionBlocks` を含める。`cms.posts.find()` 経由で SWR キャッシュに乗る。
  - core: `cms.cacheImage` / `cms.imageProxyBase` を公開。画像キャッシュが設定されていれば Notion 画像 URL を SHA256 ハッシュキーのプロキシ URL へ変換できる。
  - notion-orm: `NotionCollection.loadNotionBlocks` を実装 (内部で `fetchBlockTree` を呼ぶ)。
  - react-renderer: `@notion-headless-cms/react-renderer/server` サブパスから `resolveBlockImageUrls(blocks, cacheImage)` を提供。サーバー側で image / video / audio / file / pdf の file 型 URL をプロキシ URL へ事前解決する。

## 0.3.16

### Patch Changes

- Updated dependencies [01fa3f3]
  - @notion-headless-cms/renderer@0.1.8

## 0.3.15

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
  - @notion-headless-cms/renderer@0.1.7

## 0.3.14

### Patch Changes

- 63f5f38: ライブラリ使い勝手改善

  ### コレクション API

  - `get(slug)` → `find(slug)`（nullable が直感的）
  - `slugs()` → `params()`（Next.js 慣習に合わせる）
  - `revalidate(slug, version)` → `check(slug, version)`

  ### グローバル操作

  - `$collections` → `collections`
  - `$invalidate()` → `invalidate()`
  - `$handler()` → `handler()`
  - `$getCachedImage()` → `getCachedImage()`

  ### 設定

  - `cache: adapter` → `cache: [adapter]`（常に配列で型統一）
  - `ttlMs: number` → `swr: { ttlMs: number }`（SWR 設定を名前空間に整理）

  ### エラーハンドリング

  - `CMSError` に `is(code)` / `inNamespace(ns)` インスタンスメソッドを追加
  - `matchCMSError(err, handlers)` ユーティリティを追加

  ### adapter-next

  - `createNextHandler(cms, opts?)` を新設（推奨 API）
  - `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` は `@deprecated`

  ### CLI

  - `columnMappings` → `fieldMappings`（Notion フィールドとの対応であることを明確化）

  ### 型の改名

  - `GetOptions` → `FindOptions`
  - `RevalidateResult` → `CheckResult`
  - 新設: `SWRConfig`

## 0.3.13

### Patch Changes

- 45ee864: `updatedAt` を廃止し `lastEditedTime` に一本化。`list()` に `accessibleStatuses` フィルタを適用、デフォルトソート（`publishedAt` 降順）を実装。
- 84a5639: Notion Datasource API のページオブジェクトフィールドをサポートし、エラーハンドリングを強化

  - core: `BaseContentItem` に `createdAt`, `isArchived`, `coverImageUrl`, `iconEmoji` を追加。`fetchListRaw`/`findRaw` で `isArchived:true` のアイテムを自動除外
  - notion-orm: `mapper.ts` でヘルパー関数 (`extractPageTitle`, `extractCoverUrl`, `extractIconEmoji`) を追加し、新フィールドのマッピングをサポート。スラグが空の場合 `CMSError` をスロー
  - notion-orm: `schema.ts` の `parseMapping` で新フィールドをセット
  - notion-embed: OGP/oEmbed の HTTP エラーおよびネットワーク例外を `console.warn` で記録
  - cli: 生成コードに新メタデータフィールドを追加、`DataSourceObjectResponse` インポートをメインエントリに変更して安定化

- c75218d: サイレントフォールバック撤廃・`onSwrError` hook 追加・`renderer` 必須化

  - `renderer` オプションが必須になりました（`RendererFn` 型、省略不可）。動的 import フォールバックは削除されました。`@notion-headless-cms/renderer` の `renderMarkdown` を明示的に渡してください
  - `loadBlocks` 失敗時に空配列を返すフォールバックを削除。`source/load_blocks_failed` CMSError をスローするようになりました
  - `CMSHooks` に `onSwrError(error, ctx)` hook を追加。SWR バックグラウンド処理（メタ更新・コンテンツ再構築・リスト更新）で失敗した場合に呼ばれます
  - 画像フェッチ時に Content-Type ヘッダがない、または `image/*` でない場合は `cache/image_invalid_content_type` CMSError をスローするようになりました（URL 拡張子推測・`image/jpeg` デフォルトフォールバックを廃止）
  - 新エラーコード追加: `source/load_blocks_failed`, `cache/image_invalid_content_type`, `swr/item_check_failed`, `swr/list_check_failed`, `swr/content_rebuild_failed`

- c75218d: webhook `:collection` 単一経路化・adapter-next ハンドラ分割

  **core**:

  - Webhook URL パターンを `POST /revalidate/:collection` に変更（汎用 JSON body フォールバック廃止）
  - `HandlerAdapter.parseWebhook` を `parseWebhookFor(collection, req, secret)` に置換。未知コレクションは `webhook/unknown_collection`、未実装は `webhook/not_implemented` CMSError をスロー
  - 新エラーコード追加: `webhook/signature_invalid`, `webhook/payload_invalid`, `webhook/unknown_collection`, `webhook/not_implemented`
  - CMSError コードから HTTP ステータスへの明示マッピング (401/400/404/501)

  **adapter-next**:

  - `createRevalidateRouteHandler` を廃止し以下の 2 関数に分割:
    - `createCollectionRevalidateRouteHandler` — `/api/revalidate/[collection]/route.ts` 用。JSON パース失敗は 400 を返す
    - `createInvalidateAllRouteHandler` — 全体無効化用の管理エンドポイント向け

- c75218d: コード予測可能性向上 PR 4: notion-orm / notion-embed / cache 整理

  - **notion-embed**: `fetchOgp` をキャッシュなし純粋関数に変更。HTTP エラー時は Error を投げる (旧: `console.warn + return {}`)。TTL キャッシュが必要な場合は新設の `createOgpFetcher()` ファクトリを使う。インスタンス間でキャッシュを共有しない
  - **notion-embed**: `fetchOembed` の HTTP エラー時も Error を投げる (旧: `console.warn + return {}`)
  - **notion-embed**: `clearOgpCache()` を削除 (キャッシュがスコープ化されたため不要)
  - **notion-embed**: `extractUrlFromMarkdownLink` / `addHttpsToProtocolRelative` / `isHttpUrl` を公開 API として export
  - **cache**: `cloudflareCache(env, opts)` のシグネチャを `cloudflareCache(bindings, opts)` に変更。`bindings.docCache` / `bindings.imgBucket` に KV / R2 の binding インスタンスを直接渡す (旧: env オブジェクト + binding 名文字列)
  - **notion-orm**: `getPlainText()` の戻り値型を `string | null` に統一 (旧: 空文字列を返すケースがあった)
  - **notion-orm / core**: `isArchived` を `archived` フラグのみに変更し `isInTrash` を独立フィールドとして追加 (旧: `isArchived = in_trash || archived` で 2 フラグを混合)
  - **core**: `buildCacheImageFn` の `hashMemo` をモジュール変数からファクトリスコープローカルに変更。インスタンス間でメモを共有しない

## 0.3.12

### Patch Changes

- bccd931: Notion ページの最終編集日時を BaseContentItem.lastEditedTime として自動セット。

  - **@notion-headless-cms/core**: `BaseContentItem` に `lastEditedTime?: string` フィールドを追加し、Notion の `page.last_edited_time` に対応するシステムフィールドとして定義
  - **@notion-headless-cms/notion-orm**: `mapItemFromPropertyMap()` / `mapItem()` / `parseMapping()` が `page.last_edited_time` から `lastEditedTime` を自動セット。`SystemField` / `SYSTEM_FIELDS` に `"lastEditedTime"` を追加
  - **@notion-headless-cms/cli**: Notion の `last_edited_time` 型を未サポートとしてスキップ（生成コードは DB 列のみ対象）

## 0.3.11

### Patch Changes

- 757c7e3: `CollectionClient` に `check(slug, currentVersion)` メソッドを追加。

  Notion から最新版を取得して `updatedAt` と比較し、差分があればキャッシュを更新してアイテムを返す。
  ページ表示後の 1 回限りのクライアント再検証エンドポイントの実装に使う。

  ```ts
  const result = await cms.posts.check(slug, post.updatedAt);
  // { stale: false } | { stale: true; item: ItemWithRender<T> } | null
  ```

## 0.3.10

### Patch Changes

- 24bf322: `BaseContentItem.status` と `publishedAt` を `string | null` 許容に変更し、`nhc generate` が `slugField` を `string`（null 非許容）で生成するよう修正

  - `BaseContentItem.status` を `string | null | undefined` に変更（Notion の select 型が null を返す場合があるため）
  - `BaseContentItem.publishedAt` を `string | null | undefined` に変更（同上）
  - `codegen.ts`: `slugField` に指定されたフィールドの型を `string | null` ではなく `string` で生成（slug なしのアイテムは CMS からアクセスされないため）
  - `collection.ts` / `notion-adapter.ts`: `status` の null ガードを `!= null`（null/undefined の両方を弾く）に修正

## 0.3.9

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
  - @notion-headless-cms/renderer@0.1.6

## 0.3.8

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

- Updated dependencies [e6d043b]
  - @notion-headless-cms/renderer@0.1.5

## 0.3.7

### Patch Changes

- 5703a6c: `CollectionClient` に更新検知プリミティブ `checkForUpdate` / `checkListForUpdate` を追加する

  ## 新規 API

  - `checkForUpdate({ slug, since })` — 指定アイテムが `since` 以降に更新されたか 1 コールで確認する。更新あり時は最新 `ItemWithContent` を返す
  - `checkListForUpdate({ since, filter? })` — リスト全体が `since` 以降に更新されたか確認する。更新あり時は最新 `items` と `version` を返す
  - `revalidateAll()` — コレクション全体のキャッシュを無効化する（旧 `revalidate()` / `revalidate("all")` の置き換え）

  ## 破壊的変更

  - `getList()` の戻り値が `T[]` から `{ items: T[]; version: string }` に変更。`version` は `DataSource.getListVersion()` で計算したフィルタ済みアイテムの識別子
  - `revalidate()` の引数が `scope?: "all" | { slug: string }` から `slug: string` に変更。引数なしでの全件無効化は `revalidateAll()` を使う

  ## 新規エクスポート型

  - `CheckForUpdateResult<T>`
  - `CheckListForUpdateResult<T>`
  - `GetListResult<T>`

## 0.3.6

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

## 0.3.5

### Patch Changes

- 233af88: キャッシュフック API の統一と型安全性の向上

  ## 破壊的変更

  ### 1. `onListCacheHit` の引数を `CachedItemList<T>` 単引数に統一

  `onCacheHit` が `CachedItem<T>` オブジェクト一つを受け取るのと対称になるよう変更。

  ```diff
  - onListCacheHit?: (items: T[], cachedAt: number) => void;
  + onListCacheHit?: (list: CachedItemList<T>) => void;
  ```

  移行:

  ```ts
  // Before
  onListCacheHit: (items, cachedAt) => { ... }

  // After
  onListCacheHit: ({ items, cachedAt }) => { ... }
  ```

  ### 2. `onCacheUpdate` → `onCacheRevalidated` にリネーム

  SWR バックグラウンド再検証でキャッシュに書き込んだことを明示する名前に変更。

  ```diff
  - onCacheUpdate?: (slug: string, item: CachedItem<T>) => void;
  + onCacheRevalidated?: (slug: string, item: CachedItem<T>) => void;
  ```

  ### 3. `onListCacheUpdate` → `onListCacheRevalidated` にリネーム、引数も `CachedItemList<T>` に変更

  ```diff
  - onListCacheUpdate?: (items: T[]) => void;
  + onListCacheRevalidated?: (list: CachedItemList<T>) => void;
  ```

  ## 新機能

  ### 4. `logLevel` オプション（`CreateCMSOptions`）

  指定したレベル未満のログを内部で抑制する。Cloudflare Workers Observability のように debug ログが課金対象になる環境で有用。

  ```ts
  createCMS({ dataSources, preset: "node", logLevel: "info" });
  ```

  ### 5. `CollectionSemantics<T>` にコレクション固有フック

  `collections` オプションでコレクションごとに型付きフックを定義できる。アプリ側が `CMSHooks<Post>` を直接記述せずに済む。

  ```ts
  createCMS({
    dataSources: { posts: createNotionCollection<Post>({ ... }) },
    collections: {
      posts: {
        slug: "slug",
        hooks: {
          // item の型が Post に自動推論される
          onCacheHit: (slug, item) => console.log(item.item.title),
        },
      },
    },
  })
  ```

## 0.3.4

### Patch Changes

- 83a5cca: キャッシュ関連のログ強化・スコープ分離バグ修正

  - `LogContext` に `cachedAt`・`cacheAdapter`・`imageHash` フィールドを追加し、キャッシュの鮮度や画像ハッシュキーをログで確認できるようにした
  - `CMSHooks` に `onCacheUpdate` / `onListCacheUpdate` フックを追加。SWR バックグラウンド差分チェックで更新を検出しキャッシュを差し替えたときに発火する
  - `getItem` / `getList` でキャッシュヒット（`cachedAt` 付き）・ミス・TTL 期限切れ・アイテム未発見を `debug` ログとして出力するようにした
  - `revalidate()` / `$revalidate()` 呼び出し時にキャッシュ無効化ログを追加した
  - SWR バックグラウンド更新で差分検出（変更前 `notionUpdatedAt` 付き）・差し替え / 差分なし・TTL リセットを `debug` ログとして出力するようにした
  - 画像キャッシュのヒット・ミス・保存に `imageHash` をログコンテキストへ追加した
  - 複数コレクションが同一 `DocumentCacheAdapter` を共有するとき、リストキャッシュがコレクション間で上書きされるバグを修正した（`scopeDocumentCache` 内でコレクション別クロージャ変数に分離）
  - `$revalidate()` が `scopeDocumentCache` の `listSlot` をクリアせずキャッシュが残るバグを修正した

## 0.3.3

### Patch Changes

- e719435: SWR の挙動を刷新: TTL 切れはブロッキングフェッチ、TTL 未設定/期限内は毎回バックグラウンド差分チェック。`getLastModified`/`getListVersion` で変更がない場合は再レンダリングをスキップし、TTL ありなら `cachedAt` をリセットして期限切れを先送りする。

## 0.3.2

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

## 0.3.1

### Patch Changes

- 6f34d49: 責務分離リファクタリング: ORM は DB クエリ専念、renderer が Transformer を公開

  - **renderer**: `Transformer`・`BlockHandler`・`TransformerConfig`・`TransformContext`・`BlockConverter` を公開 API として追加。`@notionhq/client` と `notion-to-md` をオプショナル peerDeps に追加
  - **notion-orm**: 内部 `transformer/` を renderer へ移動し `@notion-headless-cms/renderer` に依存変更。`NotionFieldType.select` から `published`/`accessible` フィールド削除。`NotionSchema` から `publishedStatuses`/`accessibleStatuses` 削除
  - **core**: `DataSource` インターフェースから `publishedStatuses`/`accessibleStatuses` を削除。公開条件の唯一の権威は `createCMS({ collections })` の `CollectionSemantics` に統一
  - **cli**: `nhc init` テンプレートを `publishedStatuses` は `createCMS({ collections })` で設定するパターンに更新

- Updated dependencies [6f34d49]
  - @notion-headless-cms/renderer@0.1.4

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
