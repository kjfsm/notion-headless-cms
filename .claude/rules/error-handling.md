---
description: CMSError への統一とエラーコードの命名規則
paths:
  - "packages/**/src/**"
---

# エラー処理

## 基本方針

すべての内部エラーは `CMSError` に統一する。生の `Error` を throw しない。

- 発生源: `@notion-headless-cms/core` の `CMSError`（`packages/core/src/errors.ts`）
- 利用側は `@notion-headless-cms/core/errors` サブパスからも `import` 可
- `CMSError` は必ず `code`（名前空間付き）と `context.operation` を持つ

## 組み込みエラーコード

| コード | 発生場所 |
|---|---|
| `core/config_invalid` | 設定不備（token 未設定など） |
| `core/schema_invalid` | schema/mapping の型不整合 |
| `core/notion_orm_missing` | `@notion-headless-cms/notion-orm` の動的ロード失敗 |
| `source/fetch_items_failed` | DataSource の `list()` 失敗 |
| `source/fetch_item_failed` | `findBySlug()` 失敗 |
| `source/load_markdown_failed` | `loadMarkdown()` 失敗 |
| `cache/io_failed` | document/image キャッシュ I/O 失敗 |
| `cache/image_fetch_failed` | Notion 画像取得の HTTP 失敗 |
| `renderer/failed` | renderer の変換失敗 |
| `cli/config_invalid` | `nhc.config.ts` の内容不整合（`defineConfig` 未 export など） |
| `cli/config_load_failed` | 設定ファイルの読み込み/評価失敗 |
| `cli/schema_invalid` | CLI で受け取ったスキーマ/マッピング不整合 |
| `cli/generate_failed` | `nhc generate` の処理失敗 |
| `cli/init_failed` | `nhc init` の処理失敗 |
| `cli/notion_api_failed` | CLI が Notion API を叩く際の失敗 |
| `cli/env_file_not_found` | `--env-file` で指定されたファイルが存在しない |

## サードパーティ拡張

- `CMSErrorCode = BuiltInCMSErrorCode | (string & {})` なので任意の文字列コードを定義可能
- 名前空間を必ず付ける（例: `cache-redis/connection_failed`）

## 判定

- `isCMSError(err)`: CMSError かどうか
- `isCMSErrorInNamespace(err, "source/")`: 名前空間で分岐する時はこちらを使う

## 追加時の手順

1. 新コードの名前空間と kind を決める（`<namespace>/<kind>`）
2. コアなら `BuiltInCMSErrorCode` に追加、サードパーティならパッケージ内で定数化
3. `docs/api/cms-methods.md` や該当 README のエラー一覧に追記
