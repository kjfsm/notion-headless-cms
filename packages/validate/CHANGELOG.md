# @notion-headless-cms/validate

## 0.1.1

### Patch Changes

- d414823: M1: zod 検証パッケージ `@notion-headless-cms/validate` を新設 (Issue #333)

  - 新規パッケージ `@notion-headless-cms/validate` を opt-in で公開
    - `validateCreateClientOptions(opts)` — `createClient({...})` の引数を実行時検証
    - `validateNotionSourceConfig(opts)` — `notionSource({...})` の引数を実行時検証
    - `validateCMSConfig(config)` — `nhc.config.ts` の `defineConfig()` 戻り値を検証
  - いずれも失敗時は `CMSError(code: "core/schema_invalid")` を投げ、不正フィールド名と原因をまとめて表示する
  - `packages/core` には zod の依存を追加しない (ゼロ依存ルールの維持)
  - CLI の `loadConfig()` を zod 化し、`output` / `collections[*].databaseId|dbName` などの不足をフィールド単位で報告する

- e2c8bee: M4: deprecated 削除と publishOptions のフォールバック規則明文化 (Issue #333)

  ## Breaking

  - `notionSource({ blocks, ogp })` を削除した (v0.3.25 で `@deprecated` 化されていた)
  - カスタムブロックハンドラと OGP 取得は `fetch: blocksFetcher({ blocks, ogp })` に統一
  - `createCms()` (node / next / cloudflare) からも `blocks` / `ogp` を削除し、`fetch` に集約
  - `@notion-headless-cms/validate` の `validateNotionSourceConfig` も `blocks` / `ogp` の許可をやめた

  ## 移行ガイド

  ```diff
  - notionSource({
  -   schema,
  -   token,
  -   blocks: embed.blocks,
  -   ogp: { enabled: true },
  - })
  + notionSource({
  +   schema,
  +   token,
  +   fetch: blocksFetcher({ blocks: embed.blocks, ogp: { enabled: true } }),
  + })
  ```

  `@notion-headless-cms/fetch-blocks` を依存に追加すること。

  ## docs

  - `packages/notion-source/README.md` に `publishedStatuses` / `accessibleStatuses` のフォールバック規則を追記
    - `accessibleStatuses` 未指定時は閲覧チェックが行われない
    - `publishedStatuses` 未指定時は `list()` が全件返す
    - `publishedStatuses` は `accessibleStatuses` の部分集合となるよう運用するのを推奨

- Updated dependencies [c55a06a]
- Updated dependencies [8e73f8e]
- Updated dependencies [64b7d32]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0
