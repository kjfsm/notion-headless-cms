# @notion-headless-cms/notion-katex

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
