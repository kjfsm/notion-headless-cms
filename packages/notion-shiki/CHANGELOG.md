# @notion-headless-cms/notion-shiki

## 3.0.0

### Major Changes

- v3 ゼロベース再設計（epic #437）を機に、モノレポ全パッケージのバージョン番号を
  `3.0.0` に統一する。この changeset 単体では各パッケージのコードに変更は無い
  （他の changeset で実際の変更が入るパッケージ以外は純粋なバージョン整列）。
  今回のみの一括整列であり、以降は各パッケージ独立のバージョニングに戻す
  （`.changeset/config.json` の `fixed`/`linked` は変更しない）。

### Patch Changes

- Updated dependencies
  - @notion-headless-cms/notion-orm@1.0.0

## 1.0.14

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.13

## 1.0.13

### Patch Changes

- f4451f3: コードブロック・callout を shadcn ドキュメント風に寄せる。

  - `notion-shiki`: シンタックスハイライトを `@shikijs/rehype` から `rehype-pretty-code`
    へ移行し、既定をライト/ダークのデュアルテーマ化。表示前にサーバーで code ブロックを
    事前ハイライトして `block.code.__cachedHtml` に埋める `highlightCodeBlocks()` を追加
    （`content: "react"` 経路向け。`resolveBlockImageUrls` と同じ前処理パターン）。
  - `react-renderer`: `Code` を shadcn docs 風の枠（ヘッダー: ファイル名 + 言語ラベル +
    コピーボタン、本体: 行番号付きハイライト、長いコードは折りたたみ）へ刷新。公式の
    `copy-button` / `callout` / `code-collapsible-wrapper` を移植し、Notion の callout
    ブロックを公式 `Callout` でラップ。`theme.css` にデュアルテーマ切替・行番号の CSS と
    `--surface` / `--code` トークンを追加。

## 1.0.12

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.12

## 1.0.11

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.11

## 1.0.10

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.10

## 1.0.9

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.9

## 1.0.8

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.8

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

## 0.1.6

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [bb22f7d]
  - @notion-headless-cms/notion-orm@0.1.32

## 0.1.5

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.31

## 0.1.4

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
