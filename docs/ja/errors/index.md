---
title: エラーコード一覧
description: CMSError の組み込みエラーコードと原因・対処
category: APIリファレンス
order: 99
---

# エラーコード一覧

`@notion-headless-cms/cms` の `CMSError` は `code` フィールドに `<namespace>/<kind>` 形式の識別子を持つ。
本ドキュメントは現行アーキテクチャ（`packages/cms`）の組み込みエラーコード（`schema/` `store/` `handler/` `sync/` `cli/`、計 18 個）について、**原因 / 対処** をまとめる。

```ts
import { isCMSError, isCMSErrorInNamespace, matchCMSError } from "@notion-headless-cms/cms";

try {
  await cms.posts.find(slug);
} catch (err) {
  if (isCMSError(err)) {
    console.error(err.code, err.message, err.context);
  }
}
```

- `isCMSError(err)` — `CMSError` かどうかの判定
- `isCMSErrorInNamespace(err, "sync/")` — 名前空間で分岐したいとき
- `err.is(code)` / `err.inNamespace(ns)` — 上記の糖衣構文（インスタンスメソッド）
- `matchCMSError(err, handlers)` — コードごとにハンドラを割り当てて分岐

`context.operation` には発生箇所の処理名が、コレクション/スラッグに紐づくエラーには `context.collection` / `context.slug` も入る。

> `handler/*` の 3 コードは `cms.fetch(request)`（webhook / OGP エンドポイント）が返す JSON レスポンスボディの `code` フィールドとして現れる（`throw` される `CMSError` ではない）。それ以外（`schema/` `store/` `sync/` `cli/`）は `CMSError` として `throw` される。

---

## schema/

`defineCollection`/`defineSchema` や `createCMS` の呼び出し時、スキーマ・設定の不整合を検知して投げられる。

### schema/status_property_required

**原因**: `defineCollection({ published, accessible })` を指定したのに `statusProperty` を省略した。または `statusProperty` に指定したプロパティが `status` 型ではない。

**対処**: `statusProperty` に Notion 側の status プロパティのキーを指定する。`published`/`accessible` が不要なら両方とも省略する（設定が黙って無視される経路を作らない設計のため、必須化されている）。

### schema/reserved_collection_name

**原因**: コレクション名が `createCMS` の戻り値のトップレベル API 名（`sync` / `fetch` / `scheduled`）と衝突している。または `":"` を含む（`multi-source.ts` の namespaced slug が `collection:slug` 形式で合成するため、コレクション名に `":"` があると衝突しうる）。

**対処**: コレクション名を別名にリネームする。

### schema/notion_config_missing

**原因**: `syncDelegate` を指定していないのに `notion.client` / `notion.token` のどちらも指定していない（ローカルで同期エンジンを組み立てるにはどちらか必須）。

**対処**: `notion: { token: process.env.NOTION_TOKEN }`（または `notion.client`）を渡すか、Durable Object 等に同期を委譲する `syncDelegate` を指定する。

### schema/scheduler_missing

**原因**: `syncDelegate` 未指定時にローカル同期用の `scheduler` が解決できない場合に投げられる予約コード。現バージョンでは `scheduler` 省略時に `createNodeSyncScheduler()` へ自動フォールバックするため通常は発生しない。

**対処**: 独自の `scheduler` 実装を渡している場合はその実装を確認する。

---

## store/

R2 への REST 経由アクセス（`nhc sync` の warm 経路など、`@notion-headless-cms/cms/cloudflare` の `restR2Bucket`）で発生する。

### store/rest_request_failed

**原因**: Cloudflare REST API 経由の R2 の GET/PUT/DELETE/LIST リクエストが失敗（認証エラー・レート制限・ネットワーク等）。

**対処**: `accountId` / `apiToken` / `bucketName`（R2）が正しいか、トークンに該当リソースへの権限があるかを確認する。

### store/rest_env_missing

**原因**: REST 経由アクセスに必要な環境変数が未設定。`readRestEnv()` が期待するのは `CLOUDFLARE_ACCOUNT_ID` / `R2_BUCKET_NAME` / `CLOUDFLARE_API_TOKEN` の 3 つ。

**対処**: 上記 3 変数を設定するか、`readRestEnv(env)` に明示的なオブジェクトを渡す。

---

## handler/

`cms.fetch(request)`（webhook / OGP エンドポイント）が返す JSON レスポンスの `code` として現れる。

### handler/signature_invalid

**原因**: Notion から受信した webhook の `X-Notion-Signature` と `createCMS({ webhookSecret })` の値が一致しない（HTTP 401）。

**対処**: Notion 側で発行された webhook secret と `webhookSecret` が一致しているか確認する。プロキシ / WAF がリクエストボディを改変していないかも確認する。

### handler/ogp_url_forbidden

**原因**: OGP エンドポイント（`GET {routes}/ogp?url=...`）への `url` パラメータが未指定・不正な URL・SSRF ガード（内部アドレス等の許可されない宛先）に抵触（HTTP 400）。

**対処**: 外部公開 URL のみを渡す。プライベート IP・localhost 等は仕様上ブロックされる。

### handler/ogp_fetch_failed

**原因**: OGP 対象 URL への fetch 自体が失敗、またはレスポンスが失敗ステータス（HTTP 502）。

**対処**: 対象 URL がネットワークから到達可能か、レスポンスを返しているかを確認する。

---

## sync/

Notion 同期処理（`SyncCoordinatorCore` / `notion-driver.ts`）中に投げられる。

### sync/notion_query_failed

**原因**: Notion API 呼び出し失敗。差分クエリ（`dataSources.query`）の失敗、または slug に対応する Notion ページが見つからない場合など。

**対処**: `NOTION_TOKEN` の有効性・対象 DB がインテグレーションに接続されているかを確認する。Notion API のレートリミット（〜3 req/s）に当たっている場合は `sync.requestsPerSecond` や retry 設定を見直す。

### sync/slug_missing

**原因**: `slug` を持つコレクション（`defineCollection({ slug: "..." })`）なのに、対象ページの slug プロパティが空。

**対処**: Notion 側で該当ページの slug プロパティに値を設定する。`slug` を省略した設定値コレクションであれば発生しない（page id をキーにするため）。

### sync/image_fetch_failed

**原因**: 同期時のブロック内画像 fetch がリトライ上限まで失敗した（Notion の署名付き画像 URL は短時間で失効するため、取得タイミングによっては再試行が必要）。

**対処**: 一時的な失敗であれば次回同期で自己回復する。恒常的に発生する場合はネットワーク到達性・retry 設定を確認する。

### sync/unknown_collection

**原因**: webhook 等が指す collection 名が `schema` の `collections` に登録されていない。

**対処**: `defineSchema` にコレクションを追加するか、参照元（webhook URL の `?collection=` パラメータ等）を正しいコレクション名に直す。

---

## cli/

`nhc` サブコマンド（`init` / `pull` / `check` / `doctor` / `sync`）が throw する。

### cli/config_invalid

**原因**: `nhc.config.ts` の `defineConfig()` の内容不整合（`collections` が空、`dbName`/`databaseId` のどちらも未指定など）。

**対処**: `collections` に最低 1 件のエントリを追加し、`dbName` または `databaseId` を指定する。

### cli/schema_invalid

**原因**: `schemaModule`（`nhc check` が読むユーザー定義スキーマ）とマッピングの不整合。または Notion DB のプロパティ型が CLI 対応外。

**対処**: `schemaModule` の `defineCollection` が実 Notion DB のプロパティと一致しているか確認し、必要なら `fieldMappings` を追加する。

### cli/init_failed

**原因**: `nhc init` のテンプレート生成失敗（既存ファイルとの衝突・書き込み権限不足など）。

**対処**: `--force` を付けて既存ファイルを上書きするか、別の出力先パスを指定する。親ディレクトリの書き込み権限を確認する。

### cli/notion_api_failed

**原因**: CLI が Notion API を呼んだときの失敗（DB 解決・introspect・drift 検証）。典型例は `dbName` に完全一致する DB が見つからない（インテグレーション未接続・前後の空白違い）、または token が無効。

**対処**:

1. インテグレーションに対象 DB が接続されているか確認する（DB の「接続先」設定）
2. `dbName` の完全一致（前後空白・全角半角）を確認する
3. `--verbose` を付けて Notion API レスポンスの status / code を確認する

### cli/env_file_not_found

**原因**: `--env-file <path>` で指定したファイルが存在しない。

**対処**: パスを実ファイルに合わせる。相対パスはプロセスの cwd 基準で解決される。

---

## サードパーティ拡張

`CMSErrorCode = BuiltInCMSErrorCode | (string & {})` のため、任意の文字列コードを定義できる。サードパーティアダプタは `<package-namespace>/<kind>` 形式（例: `cache-redis/connection_failed`）を使う。

## 追加時の手順

新しい組み込みエラーコードを追加する場合は `packages/cms/src/errors.ts` の `BuiltInCMSErrorCode` に追加し、本ドキュメントにも追記する（`.claude/rules/error-handling.md` 参照）。
