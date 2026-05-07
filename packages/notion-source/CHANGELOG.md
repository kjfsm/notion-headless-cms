# @notion-headless-cms/notion-source

## 0.1.1

### Patch Changes

- efd3c2f: module augmentation で拡張可能な sources API を追加（#227）

  - `@notion-headless-cms/core`: `CMSAdapter` / `CMSSources` / `MergeSourceCollections` を公開。`createClient({ sources: ... })` を新設し、`createCMS` / `CreateCMSOptions` を `createClient` / `CreateClientOptions` にリネーム（破壊的変更）
  - `@notion-headless-cms/notion-source`: 新規パッケージ。`notionSource({ schema, token, publishOptions })` がコレクションを構築する。`declare module` で `sources.notion` キーが解禁される
  - `@notion-headless-cms/cli`: 生成ファイルを `nhc.schema.ts` に変更（DB 構造のみ）。旧 `createCMS` ラッパー / `NhcConfig` / `Nhc` 型の生成を廃止し、`export const schema` を出力する（破壊的変更）

- Updated dependencies [6a24bdc]
- Updated dependencies [efd3c2f]
  - @notion-headless-cms/notion-orm@0.1.23
  - @notion-headless-cms/core@0.3.18
