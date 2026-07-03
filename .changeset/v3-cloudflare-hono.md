---
"@notion-headless-cms/cms": patch
---

`examples/cloudflare-hono` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- `wrangler.toml` に `SyncCoordinatorDO`（`durable_objects.bindings` + `migrations`）を追加。
  Notion API への直列アクセスを DO に一元化し、読者用の stateless Worker は KV/R2 の
  読み取りのみ行う（`createCMS({ syncDelegate: durableObjectSyncDelegate(...) })`）
- `render:{content:"html"}` + `post.html()` を `renderBlocksToHtml`（`@notion-headless-cms/cms/html`）
  に置換
- 動作確認・初回コールドスタート用に `POST /api/sync/kick`（`cms.sync.kick()` を手動発火する
  メンテナンスエンドポイント）を追加
