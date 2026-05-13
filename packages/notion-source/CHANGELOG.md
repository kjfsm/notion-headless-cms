# @notion-headless-cms/notion-source

## 0.1.6

### Patch Changes

- Updated dependencies [7f2668a]
  - @notion-headless-cms/core@0.3.23
  - @notion-headless-cms/notion-orm@0.1.28

## 0.1.5

### Patch Changes

- 700ca69: 完全刷新: nodePreset・メタパッケージ・パッケージ rename・CMSError 拡張・cloudflarePreset ctx 必須化

  ## 破壊的変更

  ### @notion-headless-cms/core

  - `createClient` のサンプルコードを `sources` + `nodePreset()` 形式に刷新
  - `ContentConfig.imageProxyBase` を削除（`CreateClientOptions.imageProxyBase` を使うこと）
  - 公開 export から `CollectionDef` / `CollectionsConfig` / `InferCollectionItem` / `CollectionClientImpl` / `collectionKey` / `CMSAdapter` / `MergeSourceCollections` を削除（`@notion-headless-cms/core/source-author` サブパスから import すること）
  - `CMSError` に `nextSteps?: readonly string[]` / `docsUrl?: string` / `format()` を追加

  ### @notion-headless-cms/cache

  - `cloudflarePreset` の `ctx` が必須になった（省略すると SWR 背景更新が Works ランタイムに打ち切られる）
  - テスト用途には `cloudflarePreset.forTest({ env })` を提供

  ### @notion-headless-cms/notion-source

  - `CMSAdapter` / `CollectionDef` の import 元を `@notion-headless-cms/core/source-author` に変更

  ## 新機能

  ### @notion-headless-cms/core

  - `nodePreset(opts?)` を追加。`...nodePreset()` を `createClient` にスプレッドするだけで Node.js の標準構成（memoryCache + SWR 5 分）が有効になる
  - `@notion-headless-cms/core/source-author` サブパスを追加。データソースアダプター実装者向けの型を分離
  - `@notion-headless-cms/core/preset/node` サブパスを追加

  ## パッケージ rename (旧パッケージは廃止)

  - `@notion-headless-cms/notion-embed` → `@notion-headless-cms/block-html`
  - `@notion-headless-cms/renderer` → `@notion-headless-cms/markdown-html`
  - `@notion-headless-cms/adapter-next` → `@notion-headless-cms/next` に統合

  ## 新規メタパッケージ

  - `@notion-headless-cms/node`: Node.js 向け (core + notion-source + markdown-html + nodePreset)
  - `@notion-headless-cms/cloudflare`: Cloudflare Workers 向け (core + notion-source + cache/cloudflare + block-html)
  - `@notion-headless-cms/next`: Next.js 向け (core + notion-source + markdown-html + createNextHandler)

- Updated dependencies [700ca69]
  - @notion-headless-cms/core@0.3.22
  - @notion-headless-cms/markdown-html@1.0.1
  - @notion-headless-cms/notion-orm@0.1.27

## 0.1.4

### Patch Changes

- Updated dependencies [64057f4]
  - @notion-headless-cms/core@0.3.21
  - @notion-headless-cms/notion-orm@0.1.26

## 0.1.3

### Patch Changes

- Updated dependencies [52a9f0d]
- Updated dependencies [52a9f0d]
  - @notion-headless-cms/core@0.3.20
  - @notion-headless-cms/notion-orm@0.1.25

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
