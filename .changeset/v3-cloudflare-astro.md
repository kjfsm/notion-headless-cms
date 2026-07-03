---
"@notion-headless-cms/cms": patch
---

`examples/cloudflare-astro` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- KV/R2 は永続ストア（`kvDocStore`/`r2BlobStore`）のまま、同期スケジューラは
  `createNodeSyncScheduler()`（Astro の Cloudflare アダプタが DO クラスを
  export できる main エントリを提供しないため、DO 版は `cloudflare-hono`/
  `cloudflare-react-router` に譲り、このサンプルはシンプルな構成のまま維持）
- `render:{content:"html"}` + `post.html()` を `renderBlocksToHtml`
  （`@notion-headless-cms/cms/html`）に置換
