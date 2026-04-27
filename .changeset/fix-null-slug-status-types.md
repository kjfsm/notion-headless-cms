---
"@notion-headless-cms/cli": patch
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
---

`BaseContentItem.status` と `publishedAt` を `string | null` 許容に変更し、`nhc generate` が `slugField` を `string`（null 非許容）で生成するよう修正

- `BaseContentItem.status` を `string | null | undefined` に変更（Notion の select 型が null を返す場合があるため）
- `BaseContentItem.publishedAt` を `string | null | undefined` に変更（同上）
- `codegen.ts`: `slugField` に指定されたフィールドの型を `string | null` ではなく `string` で生成（slug なしのアイテムは CMS からアクセスされないため）
- `collection.ts` / `notion-adapter.ts`: `status` の null ガードを `!= null`（null/undefined の両方を弾く）に修正
