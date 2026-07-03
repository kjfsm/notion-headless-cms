---
"@notion-headless-cms/cms": patch
---

`examples/cloudflare-react-router` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- `wrangler.toml` に `SyncCoordinatorDO` と `RealtimeHubDO`（`durable_objects.bindings` +
  `migrations`）を追加。Notion API への直列アクセスは `SyncCoordinatorDO` に一元化し
  （`createCMS({ syncDelegate: durableObjectSyncDelegate(...) })`）、更新通知は
  `RealtimeHubDO` 経由の WebSocket push（`createCMS({ realtime: durableObjectRealtime(...),
  onRealtimeUpgrade })`）に結線した。README が以前から説明していた DO リアルタイム機能を
  実装で追いつかせた形になる
- `post.notionBlocks()` + `buildPageLinkMap(cms)` を `denormalizeBlocks`/`toPageLinkMap`
  （`@notion-headless-cms/react-renderer/v3`）に置換
- `<NotionRevalidator poll>` を `useNotionRevalidate({ realtime })`
  （`@notion-headless-cms/react-renderer/router`）に置換。DO 有効時はポーリングを行わず
  push のみで revalidate する
- `cms.handler()` を `cms.fetch(request)` に統合
- v2 の `find(slug, { force })`（明示リロード時の強制再取得）は v3 の `find()` に相当
  オプションが無いため廃止。README の該当記述も削除した
- Node.js からの KV プリウォームスクリプト（`scripts/warm-kv.ts`）は削除。
  `SyncCoordinatorDO` が alarm 発火のたびに自動でチャンク同期を進めるため、
  REST 経由の外部プリウォームは不要になった（今すぐ進めたい場合は `POST /api/warm` を
  手動で叩く）
