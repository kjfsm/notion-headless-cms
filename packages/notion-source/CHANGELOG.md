# @notion-headless-cms/notion-source

## 0.2.7

### Patch Changes

- 7097371: `cms.<collection>.dbName` を DB 名を埋め込んだプロパティから、実行時に Notion API で取得する非同期メソッド `getDbName(): Promise<string | undefined>` に変更（破壊的変更）。

  - `nhc generate` は schema に `dbName` を埋め込まなくなった。`cms.<collection>.getDbName()` は初回呼び出しで `data_source` を retrieve して表示名を解決し、以降はキャッシュした値を返す。
  - 手書き schema で `dbName` を明示した場合はその値を返し、API を叩かない。
  - `DataSource` インターフェースに任意メソッド `getDbName?(): Promise<string | undefined>` を追加。core はこれに委譲し、未実装なら `undefined` を返す。
  - `CollectionDef.dbName` を廃止（DB 名は DataSource 側で解決する）。

- Updated dependencies [7097371]
  - @notion-headless-cms/notion-orm@0.2.5
  - @notion-headless-cms/core@0.5.6

## 0.2.6

### Patch Changes

- 29040ac: コレクションから Notion DB の表示名を参照できる `cms.<collection>.dbName` を追加。`nhc generate` が introspect 時に取得した DB 名を schema に埋め込み、ページ・要素（`kind: "data"`）の両コレクションで参照できる。手書き schema で `dbName` を省略した場合は `undefined`。
- Updated dependencies [29040ac]
  - @notion-headless-cms/core@0.5.5
  - @notion-headless-cms/notion-orm@0.2.4

## 0.2.5

### Patch Changes

- 919ec7c: 要素（データ）コレクション `kind: "data"` を追加

  URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

  - ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
  - 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
  - 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
  - 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4
  - @notion-headless-cms/notion-orm@0.2.3

## 0.2.4

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3
  - @notion-headless-cms/notion-orm@0.2.2

## 0.2.3

### Patch Changes

- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2
  - @notion-headless-cms/notion-orm@0.2.1

## 0.2.2

### Patch Changes

- Updated dependencies [86585a7]
- Updated dependencies [61acb13]
  - @notion-headless-cms/core@0.5.1
  - @notion-headless-cms/notion-orm@0.2.0

## 0.2.1

### Patch Changes

- 6478628: `notion-source` の Webhook 対応を実装。`NotionCollection.parseWebhook` を追加し、`cms.handler({ webhookSecret })` 経由で Notion Webhook によるキャッシュ無効化が機能するようにした。シークレットは `?secret=` クエリ / `X-Webhook-Secret` ヘッダ / `Authorization: Bearer` のいずれかで検証し、body の `slug` で対象を絞れる（無ければコレクション全体を無効化）。`notionSource()` が各コレクションに `collectionName` を渡して `InvalidateScope.collection` を埋める。
- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [3aa3f1e]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [6478628]
- Updated dependencies [2d6b5b8]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
- Updated dependencies [bb22f7d]
  - @notion-headless-cms/core@0.5.0
  - @notion-headless-cms/markdown-html@1.0.3
  - @notion-headless-cms/notion-orm@0.1.32

## 0.2.0

### Minor Changes

- e2c8bee: M4: deprecated 削除と publishOptions のフォールバック規則明文化 (Issue #333)

  ## Breaking

  - `notionSource({ blocks, ogp })` を削除した (v0.3.25 で `@deprecated` 化されていた)
  - カスタムブロックハンドラと OGP 取得は `fetch: blocksFetcher({ blocks, ogp })` に統一
  - `createCms()` (node / next / cloudflare) からも `blocks` / `ogp` を削除し、`fetch` に集約
  - `@notion-headless-cms/validate` の `validateNotionSourceConfig` も `blocks` / `ogp` の許可をやめた

  ## 移行ガイド

  ```diff
  - notionSource({
  -   schema,
  -   token,
  -   blocks: embed.blocks,
  -   ogp: { enabled: true },
  - })
  + notionSource({
  +   schema,
  +   token,
  +   fetch: blocksFetcher({ blocks: embed.blocks, ogp: { enabled: true } }),
  + })
  ```

  `@notion-headless-cms/fetch-blocks` を依存に追加すること。

  ## docs

  - `packages/notion-source/README.md` に `publishedStatuses` / `accessibleStatuses` のフォールバック規則を追記
    - `accessibleStatuses` 未指定時は閲覧チェックが行われない
    - `publishedStatuses` 未指定時は `list()` が全件返す
    - `publishedStatuses` は `accessibleStatuses` の部分集合となるよう運用するのを推奨

### Patch Changes

- Updated dependencies [c55a06a]
- Updated dependencies [8e73f8e]
- Updated dependencies [64b7d32]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0
  - @notion-headless-cms/notion-orm@0.1.31

## 0.1.8

### Patch Changes

- 359bc6f: fetch 戦略両対応の `ContentExtension` インターフェースを導入し、enrichers を廃止。

  ## 破壊的変更

  - `blocksFetcher` / `notionSource` / `createCms` の `enrichers` オプションを削除。
    拡張はすべて Renderer 側の `extensions` prop へ移動。
  - `notionKatex()` / `notionShiki()` の戻り値が `BlockEnricher`（関数）から
    `ContentExtension`（オブジェクト）に変更。

  ## 新機能

  - `notion-orm`: `ContentExtension` インターフェースをエクスポート。
    `getMarkdownPlugins()` で unified プラグインを、`getBlockComponents()` で
    React コンポーネント上書きを提供する統一 API。
  - `react-renderer`: `NotionRenderer` に `extensions` prop を追加。
    `getBlockComponents()` の戻り値が `components` とマージされる（直接指定が優先）。
  - `fetch-markdown`: `Renderer` に `extensions` prop を追加（同期プラグイン向け）。
    非同期プラグイン（shiki など）は `createNotionMarkdownRenderer(extensions)` を使う。
  - `notion-katex`: `getMarkdownPlugins()` が `rehype-katex` を返す（markdown 戦略対応）。
  - `notion-shiki`: `getMarkdownPlugins()` が `@shikijs/rehype` を返す（markdown 戦略対応）。

  ## 移行方法

  ```ts
  // Before
  notionSource({ schema, token, enrichers: [notionKatex(), notionShiki()] });

  // After — fetch はデータ取得に専念
  notionSource({ schema, token, fetch: blocksFetcher() });

  // Renderer に extensions を渡す
  const extensions = [notionKatex(), notionShiki()];
  <NotionRenderer blocks={item.blocks} extensions={extensions} />
  <Renderer content={item.content} extensions={extensions} />
  ```

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

- Updated dependencies [359bc6f]
- Updated dependencies [ac2cfcc]
- Updated dependencies [f6af509]
  - @notion-headless-cms/notion-orm@0.1.30
  - @notion-headless-cms/core@0.3.25

## 0.1.7

### Patch Changes

- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [6137936]
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/notion-orm@0.1.29
  - @notion-headless-cms/core@0.3.24
  - @notion-headless-cms/markdown-html@1.0.2

## 0.1.6

### Patch Changes

- Updated dependencies [7f2668a]
  - @notion-headless-cms/core@0.3.23
  - @notion-headless-cms/notion-orm@0.1.28

## 0.1.5

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
  - @notion-headless-cms/markdown-html@1.0.1
  - @notion-headless-cms/notion-orm@0.1.27

## 0.1.4

### Patch Changes

- Updated dependencies [64057f4]
  - @notion-headless-cms/core@0.3.21
  - @notion-headless-cms/notion-orm@0.1.26

## 0.1.3

### Patch Changes

- Updated dependencies [52a9f0d]
- Updated dependencies [52a9f0d]
  - @notion-headless-cms/core@0.3.20
  - @notion-headless-cms/notion-orm@0.1.25

## 0.1.2

### Patch Changes

- 30b576e: `cms.<collection>.list()` の戻り値型を CLI 生成の `XxxItem` interface と互換にする。

  - `PropertyDef` に optional な `options?: readonly string[]` を追加。型レベルで literal union を導出するためのメタ情報で、runtime では参照しない。
  - `notion-source` の型導出を `TSTypeForPropDef<P>` に変更し、`P["options"]` が存在する status カラムを literal union に narrow する。
  - CLI が status カラムの選択肢を `options: ["..."] as const` として `*Properties` に出力するよう変更。

  利用側は `nhc generate` を再実行すること。再生成後は CLI が出力する `XxxItem` interface（例: `FixedPage`）をそのまま `cms.fixedPages.list()` の戻り値型として使えるようになる。

- Updated dependencies [30b576e]
  - @notion-headless-cms/core@0.3.19
  - @notion-headless-cms/notion-orm@0.1.24

## 0.1.1

### Patch Changes

- efd3c2f: module augmentation で拡張可能な sources API を追加（#227）

  - `@notion-headless-cms/core`: `CMSAdapter` / `CMSSources` / `MergeSourceCollections` を公開。`createClient({ sources: ... })` を新設し、`createCMS` / `CreateCMSOptions` を `createClient` / `CreateClientOptions` にリネーム（破壊的変更）
  - `@notion-headless-cms/notion-source`: 新規パッケージ。`notionSource({ schema, token, publishOptions })` がコレクションを構築する。`declare module` で `sources.notion` キーが解禁される
  - `@notion-headless-cms/cli`: 生成ファイルを `nhc.schema.ts` に変更（DB 構造のみ）。旧 `createCMS` ラッパー / `NhcConfig` / `Nhc` 型の生成を廃止し、`export const schema` を出力する（破壊的変更）

- Updated dependencies [6a24bdc]
- Updated dependencies [efd3c2f]
  - @notion-headless-cms/notion-orm@0.1.23
  - @notion-headless-cms/core@0.3.18
