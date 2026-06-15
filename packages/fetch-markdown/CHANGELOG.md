# @notion-headless-cms/fetch-markdown

## 0.0.8

### Patch Changes

- Updated dependencies [919ec7c]
  - @notion-headless-cms/notion-orm@0.2.3

## 0.0.7

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/notion-orm@0.2.2

## 0.0.6

### Patch Changes

- @notion-headless-cms/notion-orm@0.2.1

## 0.0.5

### Patch Changes

- Updated dependencies [61acb13]
  - @notion-headless-cms/notion-orm@0.2.0

## 0.0.4

### Patch Changes

- Updated dependencies [3aa3f1e]
- Updated dependencies [6478628]
- Updated dependencies [2d6b5b8]
- Updated dependencies [bb22f7d]
  - @notion-headless-cms/markdown-html@1.0.3
  - @notion-headless-cms/notion-orm@0.1.32

## 0.0.3

### Patch Changes

- @notion-headless-cms/notion-orm@0.1.31

## 0.0.2

### Patch Changes

- 6a1ee58: fix

## 0.0.1

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

- 359bc6f: `</table>` や `<unknown/>` 直後の見出しが `<h2>` に変換されない問題を修正

  CommonMark の HTML ブロックルール（Type 6/7）により、`</table>` や `<unknown .../>` の
  直後に空行なしで `## ` が続くと見出しではなく HTML ブロックの中身として扱われていた。
  `preprocess.ts` で `</table>` の後と `<unknown .../>` の前後に空行を挿入することで解消。

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
