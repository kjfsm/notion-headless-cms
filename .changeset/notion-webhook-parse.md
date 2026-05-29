---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-source": patch
---

`notion-source` の Webhook 対応を実装。`NotionCollection.parseWebhook` を追加し、`cms.handler({ webhookSecret })` 経由で Notion Webhook によるキャッシュ無効化が機能するようにした。シークレットは `?secret=` クエリ / `X-Webhook-Secret` ヘッダ / `Authorization: Bearer` のいずれかで検証し、body の `slug` で対象を絞れる（無ければコレクション全体を無効化）。`notionSource()` が各コレクションに `collectionName` を渡して `InvalidateScope.collection` を埋める。
