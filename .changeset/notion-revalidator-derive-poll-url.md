---
"@notion-headless-cms/react-renderer": patch
---

`NotionRevalidator` の `poll` で URL 手書きを不要にする。`poll.url` を省略でき、`collection` と `slug`（または `item`）から `cms.handler()` の versions ルート URL（`${basePath}/versions/${collection}/${slug}`、basePath 既定 `/api/cms`）を自動導出する。`version` も `item.lastEditedTime` から導出されるため、最小形は `poll={{ collection: "posts", item }}` で済む。

従来の `poll={{ url, version }}` も引き続き有効（後方互換）。`basePath` で別マウント先も指定できる。
