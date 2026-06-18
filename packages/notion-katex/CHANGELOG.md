# @notion-headless-cms/notion-katex

## 1.0.7

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.7

## 1.0.6

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.6

## 1.0.5

### Patch Changes

- Updated dependencies [7097371]
  - @notion-headless-cms/notion-orm@0.2.5

## 1.0.4

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.4

## 1.0.3

### Patch Changes

- Updated dependencies [919ec7c]
  - @notion-headless-cms/notion-orm@0.2.3

## 1.0.2

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/notion-orm@0.2.2

## 1.0.1

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.1

## 1.0.0

### Patch Changes

- Updated dependencies [61acb13]
  - @notion-headless-cms/notion-orm@0.2.0

## 0.1.10

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [bb22f7d]
  - @notion-headless-cms/notion-orm@0.1.32

## 0.1.9

### Patch Changes

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

- Updated dependencies [359bc6f]
- Updated dependencies [ac2cfcc]
- Updated dependencies [f6af509]
  - @notion-headless-cms/notion-orm@0.1.30

## 0.1.7

### Patch Changes

- 6137936: pnpm catalog を使って依存バージョンを一元管理するよう整理
- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [6137936]
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/notion-orm@0.1.29

## 0.1.6

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.28

## 0.1.5

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.27

## 0.1.4

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.26

## 0.1.3

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.25

## 0.1.2

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.24

## 0.1.1

### Patch Changes

- 6a24bdc: notion-katex: フェッチ時に数式を KaTeX HTML へ事前変換するパッケージを追加（#221）

  - `@notion-headless-cms/notion-katex` を新設。`notionKatex()` が `BlockEnricher` を返す
  - `notion-orm`: `BlockEnricher` 型と `enrichers` オプションを `NotionCollectionCommonOptions` に追加
  - `react-renderer`: `Equation` コンポーネントが `__cachedHtml` を `dangerouslySetInnerHTML` で描画。Workers バンドルから katex を除外できる

- Updated dependencies [6a24bdc]
  - @notion-headless-cms/notion-orm@0.1.23
