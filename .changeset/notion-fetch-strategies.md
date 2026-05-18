---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/fetch-blocks": patch
"@notion-headless-cms/fetch-markdown": patch
---

Notion コンテンツ取得戦略を差し替え可能化 — Cloudflare Workers Free プランの 50 subrequest 上限対策

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
