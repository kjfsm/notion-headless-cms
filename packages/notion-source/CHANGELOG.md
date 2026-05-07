# @notion-headless-cms/notion-source

## 0.1.2

### Patch Changes

- 30b576e: `cms.<collection>.list()` の戻り値型を CLI 生成の `XxxItem` interface と互換にする。

  - `PropertyDef` に optional な `options?: readonly string[]` を追加。型レベルで literal union を導出するためのメタ情報で、runtime では参照しない。
  - `notion-source` の型導出を `TSTypeForPropDef<P>` に変更し、`P["options"]` が存在する status カラムを literal union に narrow する。
  - CLI が status カラムの選択肢を `options: ["..."] as const` として `*Properties` に出力するよう変更。

  利用側は `nhc generate` を再実行すること。再生成後は CLI が出力する `XxxItem` interface（例: `FixedPage`）をそのまま `cms.fixedPages.list()` の戻り値型として使えるようになる。

- Updated dependencies [30b576e]
  - @notion-headless-cms/core@0.3.19
  - @notion-headless-cms/notion-orm@0.1.24

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
