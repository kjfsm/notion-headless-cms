---
"@notion-headless-cms/cms": patch
---

`examples/cloudflare-react-router` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- Durable Object は使わず、`createNodeSyncScheduler()` + `ensureSynced()`（`cms.sync.kick()`
  を cursor が尽きるまでループする、`examples/cloudflare-astro` と同じパターン）で同期する。
  KV（`DOC_CACHE`）/R2（`IMG_BUCKET`）は引き続き永続ストアとして使う
- `post.notionBlocks()` + `buildPageLinkMap(cms)` を `denormalizeBlocks`/`toPageLinkMap`
  （`@notion-headless-cms/react-renderer/v3`）に置換
- `<NotionRevalidator poll>` を引数なしの `useNotionRevalidate()`
  （`@notion-headless-cms/react-renderer/router`、mount / 再フォーカス時に直接 revalidate）
  に置換。WebSocket によるリアルタイム push は行わない
- `cms.handler()` を `cms.fetch(request)` に統合
- v2 の `find(slug, { force })`（明示リロード時の強制再取得）は v3 の `find()` に相当
  オプションが無いため廃止。README の該当記述も削除した
- Node.js からの KV プリウォームスクリプト（`scripts/warm-kv.ts`）は削除。
  `/api/warm` を叩くと `ensureSynced()` でその場の isolate の同期を完了させる
