---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/cli": patch
---

`@notionhq/client` 公式ヘルパー（`collectPaginatedAPI` / `isFullPage` / `isFullBlock` / `isFullUser` / `isNotionClientError` / `APIErrorCode` / `ClientErrorCode`）への置き換えで、自作のページネーション・エラー判定・full/partial 判定を削減し、Notion API 仕様変更への追従性を高めた。挙動互換。
