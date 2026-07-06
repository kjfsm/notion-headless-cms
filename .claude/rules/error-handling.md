---
description: CMSError への統一とエラーコードの命名規則
paths:
  - "packages/**/src/**"
---

# エラー処理

## 基本方針

すべての内部エラーは `CMSError` に統一する。生の `Error` を throw しない。

- 発生源: `@notion-headless-cms/cms` の `CMSError`（`packages/cms/src/errors.ts`）
- `CMSError` は必ず `code`（名前空間付き）と `context.operation` を持つ

## 組み込みエラーコード

| コード                            | 発生場所                                                  |
| --------------------------------- | --------------------------------------------------------- |
| `schema/status_property_required` | `published`/`accessible` 指定時に `statusProperty` 未指定 |
| `schema/reserved_collection_name` | 予約済みコレクション名との衝突                            |
| `schema/notion_config_missing`    | `syncDelegate` 未指定時に `notion` 設定が無い             |
| `schema/scheduler_missing`        | `syncDelegate` 未指定時に `scheduler` が解決できない      |
| `store/rest_request_failed`       | REST 経由の KV/R2 書き込み失敗                            |
| `store/rest_env_missing`          | REST ストアに必要な env 変数が未設定                      |
| `handler/signature_invalid`       | webhook の HMAC 署名検証失敗                              |
| `handler/ogp_url_forbidden`       | OGP fetch の SSRF ガードに抵触                            |
| `handler/ogp_fetch_failed`        | OGP fetch 失敗                                            |
| `sync/notion_query_failed`        | Notion API からの取得失敗                                 |
| `sync/slug_missing`               | 必須の slug プロパティが取得できない                      |
| `sync/image_fetch_failed`         | 同期時の画像 fetch 失敗                                   |
| `sync/unknown_collection`         | 未定義コレクションへの参照                                |
| `cli/config_invalid`              | `nhc.config.ts` の内容不整合（`collections` 未定義など）  |
| `cli/schema_invalid`              | CLI で受け取ったスキーマ/マッピング不整合                 |
| `cli/init_failed`                 | `nhc init` の処理失敗                                     |
| `cli/notion_api_failed`           | CLI が Notion API を叩く際の失敗                          |
| `cli/env_file_not_found`          | `--env-file` で指定されたファイルが存在しない             |

## サードパーティ拡張

- `CMSErrorCode = BuiltInCMSErrorCode | (string & {})` なので任意の文字列コードを定義可能
- 名前空間を必ず付ける（例: `cache-redis/connection_failed`）

## 判定

- `isCMSError(err)`: CMSError かどうか
- `isCMSErrorInNamespace(err, "sync/")`: 名前空間で分岐する時はこちらを使う
- `err.is(code)`: 特定コードと一致するか（`isCMSError(err) && err.code === code` の糖衣構文）
- `err.inNamespace(ns)`: 名前空間で分岐する時の糖衣構文（`isCMSErrorInNamespace` 相当）
- `matchCMSError(err, handlers)`: コードごとにハンドラを分岐する時に使う

## 追加時の手順

1. 新コードの名前空間と kind を決める（`<namespace>/<kind>`）
2. `packages/cms/src/errors.ts` の `BuiltInCMSErrorCode` に追加、サードパーティならパッケージ内で定数化
3. `docs/ja/errors/index.md` や該当 README のエラー一覧に追記
