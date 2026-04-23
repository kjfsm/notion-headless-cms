---
"@notion-headless-cms/adapter-node": minor
"@notion-headless-cms/adapter-cloudflare": minor
---

`notionAdapter` が `dbName` オプションを受け付けるようになりました。`dataSourceId` の代わりに `dbName` を渡すと、初回アクセス時に `client.search` で解決されます（結果はインスタンス内にキャッシュ）。

`createNodeCMS` / `createCloudflareCMS` も `DB_NAME`（Node は `NOTION_DB_NAME` も可）環境変数をフォールバックとして読むようになり、`NOTION_DATA_SOURCE_ID` が未設定でも DB 名だけで動かせます。
