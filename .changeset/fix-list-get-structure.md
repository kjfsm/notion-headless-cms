---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/cli": patch
---

`updatedAt` を廃止し `lastEditedTime` に一本化。`list()` に `accessibleStatuses` フィルタを適用、デフォルトソート（`publishedAt` 降順）を実装。
