# @notion-headless-cms/validate

## 0.1.16

### Patch Changes

- Updated dependencies [0dbc727]
  - @notion-headless-cms/core@0.5.14

## 0.1.15

### Patch Changes

- Updated dependencies [a3b567f]
  - @notion-headless-cms/core@0.5.13

## 0.1.14

### Patch Changes

- Updated dependencies [bd05d42]
  - @notion-headless-cms/core@0.5.12

## 0.1.13

### Patch Changes

- Updated dependencies [5dab6df]
  - @notion-headless-cms/core@0.5.11

## 0.1.12

### Patch Changes

- Updated dependencies [127f482]
  - @notion-headless-cms/core@0.5.10

## 0.1.11

### Patch Changes

- Updated dependencies [8b11e1c]
  - @notion-headless-cms/core@0.5.9

## 0.1.10

### Patch Changes

- Updated dependencies [4303b7b]
  - @notion-headless-cms/core@0.5.8

## 0.1.9

### Patch Changes

- Updated dependencies [4d81ddb]
  - @notion-headless-cms/core@0.5.7

## 0.1.8

### Patch Changes

- Updated dependencies [7097371]
  - @notion-headless-cms/core@0.5.6

## 0.1.7

### Patch Changes

- Updated dependencies [29040ac]
  - @notion-headless-cms/core@0.5.5

## 0.1.6

### Patch Changes

- 919ec7c: 要素（データ）コレクション `kind: "data"` を追加

  URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

  - ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
  - 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
  - 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
  - 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4

## 0.1.5

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3

## 0.1.4

### Patch Changes

- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2

## 0.1.3

### Patch Changes

- Updated dependencies [86585a7]
  - @notion-headless-cms/core@0.5.1

## 0.1.2

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0

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
