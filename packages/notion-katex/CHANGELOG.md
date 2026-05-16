# @notion-headless-cms/notion-katex

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
