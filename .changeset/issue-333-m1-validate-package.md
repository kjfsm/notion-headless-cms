---
"@notion-headless-cms/validate": patch
"@notion-headless-cms/cli": patch
---

M1: zod 検証パッケージ `@notion-headless-cms/validate` を新設 (Issue #333)

- 新規パッケージ `@notion-headless-cms/validate` を opt-in で公開
  - `validateCreateClientOptions(opts)` — `createClient({...})` の引数を実行時検証
  - `validateNotionSourceConfig(opts)` — `notionSource({...})` の引数を実行時検証
  - `validateCMSConfig(config)` — `nhc.config.ts` の `defineConfig()` 戻り値を検証
- いずれも失敗時は `CMSError(code: "core/schema_invalid")` を投げ、不正フィールド名と原因をまとめて表示する
- `packages/core` には zod の依存を追加しない (ゼロ依存ルールの維持)
- CLI の `loadConfig()` を zod 化し、`output` / `collections[*].databaseId|dbName` などの不足をフィールド単位で報告する
