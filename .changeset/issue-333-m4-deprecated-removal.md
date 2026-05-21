---
"@notion-headless-cms/notion-source": minor
"@notion-headless-cms/cloudflare": minor
"@notion-headless-cms/node": minor
"@notion-headless-cms/next": minor
"@notion-headless-cms/validate": patch
---

M4: deprecated 削除と publishOptions のフォールバック規則明文化 (Issue #333)

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
