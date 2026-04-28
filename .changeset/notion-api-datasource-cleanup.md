---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/cli": patch
---

Notion Datasource API のページオブジェクトフィールドをサポートし、エラーハンドリングを強化

- core: `BaseContentItem` に `createdAt`, `isArchived`, `coverImageUrl`, `iconEmoji` を追加。`fetchListRaw`/`findRaw` で `isArchived:true` のアイテムを自動除外
- notion-orm: `mapper.ts` でヘルパー関数 (`extractPageTitle`, `extractCoverUrl`, `extractIconEmoji`) を追加し、新フィールドのマッピングをサポート。スラグが空の場合 `CMSError` をスロー
- notion-orm: `schema.ts` の `parseMapping` で新フィールドをセット
- notion-embed: OGP/oEmbed の HTTP エラーおよびネットワーク例外を `console.warn` で記録
- cli: 生成コードに新メタデータフィールドを追加、`DataSourceObjectResponse` インポートをメインエントリに変更して安定化
