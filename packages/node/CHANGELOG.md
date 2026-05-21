# @notion-headless-cms/node

## 1.1.0

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
- Updated dependencies [e2c8bee]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0
  - @notion-headless-cms/notion-source@0.2.0

## 1.0.4

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

- Updated dependencies [359bc6f]
- Updated dependencies [f6af509]
  - @notion-headless-cms/notion-source@0.1.8
  - @notion-headless-cms/core@0.3.25

## 1.0.3

### Patch Changes

- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/core@0.3.24
  - @notion-headless-cms/markdown-html@1.0.2
  - @notion-headless-cms/notion-source@0.1.7

## 1.0.2

### Patch Changes

- Updated dependencies [7f2668a]
  - @notion-headless-cms/core@0.3.23
  - @notion-headless-cms/notion-source@0.1.6

## 1.0.1

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
  - @notion-headless-cms/notion-source@0.1.5
  - @notion-headless-cms/markdown-html@1.0.1
