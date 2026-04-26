---
"@notion-headless-cms/cli": patch
---

generate: HTTP キャッシュ無効化と非 ASCII プロパティ名の厳密エラー化

- Notion API 呼び出しに `cache: "no-store"` を付与し、generate が常に最新のスキーマ情報を取得するようにした
- TypeScript 識別子に変換できない非 ASCII プロパティ名（例: 日本語）を `columnMappings` 未指定のまま渡した場合、`property_N` に黙認する挙動を廃止し `CMSError (cli/schema_invalid)` を throw するように変更した

**移行**: 日本語等の非 ASCII プロパティ名がある場合は `nhc.config.ts` で `columnMappings` を指定してください。
