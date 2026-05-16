# @notion-headless-cms/notion-shiki

## 0.1.3

### Patch Changes

- 6137936: pnpm catalog を使って依存バージョンを一元管理するよう整理
- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [6137936]
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/notion-orm@0.1.29

## 0.1.2

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.28

## 0.1.1

### Patch Changes

- b26e623: feat(#220): notion-shiki パッケージと react-renderer/code サブパス export を追加

  - `@notion-headless-cms/notion-shiki` 新規パッケージ: fetch 時に shiki で code ブロックを pre-render し `block.code.__cachedHtml` へ埋め込む `BlockEnricher` を提供。Workers バンドルから shiki を除外できる（`notion-katex` の Code 版）
  - `react-renderer` の `Code` スタブを更新: `__cachedHtml` が付与されていれば `dangerouslySetInnerHTML` で描画、なければ従来の `<pre>` にフォールバック（完全後方互換）
  - `react-renderer/code` サブパスを追加: `shiki` をブラウザで直接使いたい場合に `SyntaxHighlighter` を import できる（`createHighlighter` + React 19 `use()` + Suspense で非同期初期化を吸収）
