# @notion-headless-cms/adapter-node

## 0.1.2

### Patch Changes

- Updated dependencies [25c018d]
  - @notion-headless-cms/core@0.1.0
  - @notion-headless-cms/source-notion@0.2.0

## 0.1.1

### Patch Changes

- 33c8bda: `adapter-node` パッケージを新規追加し、`adapter-cloudflare` で `defineSchema()` を直接渡せるよう拡張した。

  ## adapter-node（新規）

  - `createNodeCMS<T>(opts?)` ファクトリー関数を追加
  - `process.env.NOTION_TOKEN` / `NOTION_DATA_SOURCE_ID` を自動読み取り
  - `schema` オプションに `defineSchema()` の戻り値（`NotionSchema<T>`）または `SchemaConfig<T>` を受け付ける
  - `cache.document / image` に `"memory"` を指定するとインメモリキャッシュを自動注入
  - `createCloudflareCMS()` と対称的なインターフェースで Node.js 環境向けのセットアップが簡潔になった

  ## adapter-cloudflare

  - `CreateCloudflareCMSOptions.schema` の型を `SchemaConfig<T> | NotionSchema<T>` に拡張
  - `defineSchema()` の戻り値を `schema` に直接渡せるようになった（これまでは `publishedStatuses` のみ渡せた）
  - `NotionSchema<T>` を渡した場合、カスタムフィールドマッピング（`mapItem`）が自動的に有効になる
  - 既存の `SchemaConfig<T>` を渡す使い方は後方互換を維持

- Updated dependencies [52f002f]
- Updated dependencies [aada8c0]
  - @notion-headless-cms/source-notion@0.1.1
  - @notion-headless-cms/core@0.0.7
