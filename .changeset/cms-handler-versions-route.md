---
"@notion-headless-cms/core": patch
---

`cms.handler()` に versions ルート（`GET {basePath}/versions/:collection/:slug`）を追加。`peekVersion()`（KV メタのみ、Notion API 非呼び出し）を返し、`NotionRevalidator` の更新検知ポーリング先を画像プロキシ・Webhook と同じハンドラ 1 つに集約できる。キャッシュ未登録は `200` + `null`、未知コレクションは `404`（`version/unknown_collection`）。
