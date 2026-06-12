---
"@notion-headless-cms/core": patch
---

`cms.handler()` に更新検知系の 2 ルートを追加し、画像プロキシ・Webhook と同じハンドラ 1 つに集約できるようにする。

- `GET {basePath}/versions/:collection/:slug` — `peekVersion()`（KV メタのみ、Notion API 非呼び出し）。未登録は `200` + `null`
- `GET|POST {basePath}/check/:collection/:slug?v={version}` — `check()`（Notion を実照会し差分があればキャッシュ更新）。`{ stale }` を返す。アイテム未存在は `404`

未知コレクションはいずれも `404`（`handler/unknown_collection`）。`NotionRevalidator` のポーリング先を専用ルート自前実装なしで賄える。
