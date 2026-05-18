---
"@notion-headless-cms/notion-orm": minor
"@notion-headless-cms/fetch-markdown": minor
"@notion-headless-cms/react-renderer": minor
"@notion-headless-cms/fetch-blocks": major
"@notion-headless-cms/notion-katex": major
"@notion-headless-cms/notion-shiki": major
"@notion-headless-cms/notion-source": major
"@notion-headless-cms/node": major
"@notion-headless-cms/next": major
"@notion-headless-cms/cloudflare": major
---

fetch 戦略両対応の `ContentExtension` インターフェースを導入し、enrichers を廃止。

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
