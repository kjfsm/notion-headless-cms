---
title: エラーコード一覧
description: CMSError の組み込みエラーコードと原因・例・対処
category: APIリファレンス
order: 99
---

# エラーコード一覧

`@notion-headless-cms/core` の `CMSError` は `code` フィールドに `<namespace>/<kind>` 形式の識別子を持つ。
本ドキュメントは 27 個の組み込みコードについて、**原因 / 典型例 / 対処** をまとめる。

```ts
import { isCMSError, matchCMSError } from "@notion-headless-cms/core";

try {
  await cms.posts.find(slug);
} catch (err) {
  if (isCMSError(err)) {
    console.error(err.format()); // message + nextSteps + docsUrl が整形される
  }
}
```

`err.format()` を呼ぶと `nextSteps` と `docsUrl` が自動で付与されたメッセージが得られる（組み込みコードは既定値あり）。
詳細な API は [`api/cms-methods.md#エラーハンドリング`](../api/cms-methods.md#エラーハンドリング) を参照。

---

## core/

### core-config_invalid

**原因**: `createClient` の必須オプション不足 / 構成不整合（token 未設定、`sources` 空、`slugField` 未指定 など）。

**例**:

```ts
// sources が空
createClient({ sources: {} });
// → CMSError(core/config_invalid): "createClient: sources に少なくとも 1 つのコレクションを指定してください。"
```

**対処**:

- `createClient({ sources: { notion: notionSource({ schema, token }) } })` の形を守る
- `nhc generate` で `schema` を生成してから import する
- token は `process.env.NOTION_TOKEN` か `env(...)` 経由でセットする

### core-schema_invalid

**原因**: CLI 生成物の schema 型と core 側の期待が一致していない。古い schema を import している。

**対処**: `nhc generate` を実行し直す。`generated/nhc.schema.ts` の `defineSchema` / `PropertyMap` が最新形式か確認。

### core-notion_orm_missing

**原因**: `@notion-headless-cms/notion-orm` の動的 import に失敗。インストール漏れ / バンドラ設定の問題。

**対処**:

- `pnpm add @notion-headless-cms/notion-orm`
- 利用ランタイムが ESM 動的 import をサポートしているか確認

### core-sort_unsupported_type

**原因**: `list({ sort: { by, dir } })` の `by` フィールドが string / number 以外。

**対処**: ソート対象を string / number に正規化するか、別フィールドを使う。

---

## webhook/

### webhook-signature_invalid

**原因**: Notion から受信した webhook の HMAC 署名と `webhookSecret` が一致しない。

**対処**:

- Notion 管理画面で発行された secret と `createNextHandler(cms, { webhookSecret })` が一致しているか確認
- プロキシ / WAF がリクエストボディを改変していないか確認

### webhook-payload_invalid

**原因**: Webhook ペイロードが期待した JSON 構造でない。

**対処**: リクエストボディが JSON かつ `DataSource.parseWebhook` の期待形式と一致しているか確認。

### webhook-unknown_collection

**原因**: Webhook が指す collection が `createClient` で登録されていない。

**対処**: `sources` または `collections` に collection 名を追加するか、Webhook URL の `?collection=` パラメータを正しいものに直す。

### webhook-not_implemented

**原因**: 対象 collection の `DataSource` に `parseWebhook` が実装されていない。

**対処**: `parseWebhook` を実装するか、Webhook を使わず `cms.invalidate()` で手動失効する運用に変える。

---

## handler/

### handler-unknown_collection

**原因**: `cms.handler()` のルート（`GET {basePath}/versions/:collection/:slug` または `GET|POST {basePath}/check/:collection/:slug`）が指す collection が `createCMS` の `collections` に登録されていない。

**対処**: ポーリング / チェック URL が登録済みのコレクション名を指しているか確認し、必要なら `collections` に追加する。

---

## source/

### source-fetch_items_failed

**原因**: `DataSource.list()` 失敗。主に Notion API トークン / 権限 / ネットワーク。

**典型例**:

- インテグレーションが DB に接続されていない
- token がリボーク済み
- Notion API の rate limit 超過

**対処**:

1. `NOTION_TOKEN` を再発行 / 確認
2. 対象 DB をインテグレーションに接続（Notion DB → … → Connections）
3. `rateLimiter.maxRetries` / `baseDelayMs` を調整

### source-fetch_item_failed

**原因**: `findByProp` / `find(slug)` で 1 件取得に失敗。

**対処**: slug プロパティが一意か、対象ページがインテグレーションに共有されているか確認。

### source-load_markdown_failed

**原因**: ブロック → Markdown 変換中に失敗。`notion-to-md` の例外 / 未対応ブロック / アーカイブページなど。

**対処**:

- ページがアーカイブされていないか確認
- 未対応ブロック (video / file 等) を含むなら fetch 戦略を `markdownFetcher()` に切り替える

### source-load_blocks_failed

**原因**: Notion ブロックツリー取得に失敗。

**対処**: ページが削除 / アーカイブされていないか、rate limit に当たっていないかを確認。

### source-blocks_unsupported

**原因**: `markdownFetcher()` 等、`loadNotionBlocks` を提供しない fetch 戦略を選んでいるのに `react-renderer` 経由でブロックツリーを要求した。

**対処**:

- react-renderer を使う場合は fetch 戦略を `fetchBlockTree()` に変更する
- もしくは markdown 経路の HTML レンダリングに切り替える

---

## cache/

### cache-io_failed

**原因**: document / image キャッシュの read / write 失敗。R2 / KV / メモリのいずれか。

**典型例**:

- `env.DOC_CACHE` (KV) / `env.IMG_BUCKET` (R2) の binding が未設定
- `wrangler.toml` の binding 名と createClient へ渡した env が不一致

**対処**:

- `wrangler.toml` を確認し binding 名を揃える
- 一時的な R2 / KV 障害なら次回 SWR で自己回復する

### cache-image_fetch_failed

**原因**: Notion の署名付き画像 URL の取得に失敗。

**対処**:

- Notion 画像 URL は約 1 時間で失効する。`fetchAndCacheImage` 経由で SHA256 ハッシュキャッシュに永続化する設計を守る
- Worker / Node のアウトバウンドネットワーク許可を確認

### cache-image_invalid_content_type

**原因**: 画像レスポンスの Content-Type が image/* でない。

**対処**: ブラウザで URL を直接開き image/* を返すかを確認。プロキシ / CDN が Content-Type を書き換えていないか確認。

---

## renderer/

### renderer-failed

**原因**: Markdown → HTML 変換時の例外。remark / rehype プラグインの組み合わせ問題が多い。

**対処**:

- 利用中の remark / rehype プラグインを 1 つずつ外して再現を切り分ける
- `markdownFetcher()` を使っている場合は renderer に `notionMarkdownRenderer` を指定する

---

## swr/

SWR バックグラウンド更新中の失敗。`onError` フック / logger に出るがリクエスト本体は失敗しない（古いキャッシュは返らないが、次回 read で再試行される）。

### swr-item_check_failed

**原因**: `check(slug, version)` の差分検出中に Notion API が失敗した。

**対処**: 通常は無視可。恒常的に発生する場合は `source-fetch_item_failed` と同じ要領で原因を切り分ける。

### swr-list_check_failed

**原因**: SWR バックグラウンドのリスト差分チェック失敗。

**対処**: rate limit が近いなら `rateLimiter.maxConcurrent` を絞る。

### swr-content_rebuild_failed

**原因**: SWR バックグラウンドの本文再生成失敗（renderer / loadMarkdown のいずれか）。

**対処**: `cms.posts.find(slug, { fresh: true })` で再現を確認し、必要なら renderer / fetch 戦略を見直す。

---

## cli/

### cli-config_invalid

**原因**: `nhc.config.ts` の `defineConfig()` 内容不整合。

**典型例**:

```ts
// collections が空
export default defineConfig({ notionToken: env("NOTION_TOKEN"), collections: {} });
// → CMSError(cli/config_invalid)
```

**対処**: `collections` に最低 1 件のエントリを追加し、`databaseId` または `dbName` を指定する。

### cli-config_load_failed

**原因**: 設定ファイルの動的評価 (`jiti`) が失敗。構文エラー / 拡張子付き import の欠落など。

**対処**: 該当ファイルを `tsc --noEmit` でエラーが出ないか確認。ESM では `import "./x.js"` のように拡張子を付ける。

### cli-schema_invalid

**原因**: Notion DB のプロパティ型が CLI 対応外。または schema 出力時の型不整合。

**対処**:

- 対応型: `title / richText / select / status / multiSelect / date / number / checkbox / url`
- 未対応プロパティをスキップするか、Notion 側で型を変える

### cli-generate_failed

**原因**: `nhc generate` 処理中の失敗（ファイル I/O / 内部例外）。

**対処**: `nhc generate --verbose` で詳細スタックを確認。出力先の書き込み権限を確認。

### cli-init_failed

**原因**: `nhc init` のテンプレ生成失敗。既存ファイル衝突 / 書き込み権限。

**対処**: `--force` を付与するか、別パスを指定する。親ディレクトリの書き込み権限を確認。

### cli-notion_api_failed

**原因**: CLI が Notion API を呼んだときの失敗（DB 解決 / DataSource 取得）。

**典型例**:

- `dbName: "ブログ記事DB"` で完全一致する DB が見つからない（インテグレーション未接続、名前の前後空白）
- token が無効

**対処**:

1. インテグレーションに DB が接続されているか確認
2. DB 名の完全一致 (前後空白 / 全角半角) を確認
3. `nhc generate --verbose` で Notion API レスポンスの status / code を確認

### cli-env_file_not_found

**原因**: `--env-file <path>` で指定したファイルが存在しない。

**対処**: パスを実ファイルに合わせる。相対パスはプロセスの cwd 基準で解決される。

---

## cloudflare/

### cloudflare-warm_env_missing

**原因**: `readRestKvEnv()`（KV プリウォーム用）が必要な環境変数を見つけられない。`CLOUDFLARE_ACCOUNT_ID` / `KV_NAMESPACE_ID` / `CLOUDFLARE_API_TOKEN` のいずれかが未設定。

**対処**: warm スクリプト実行時に 3 つの環境変数をすべて渡す（`.dev.vars` 経由でも可）。`readRestKvEnv(env)` に明示的なオブジェクトを渡して上書きすることもできる。

---

## サードパーティ拡張

`CMSErrorCode = BuiltInCMSErrorCode | (string & {})` のため、任意の文字列コードを定義できる。サードパーティアダプタは `<package-namespace>/<kind>` 形式（例: `cache-redis/connection_failed`）を使う。

サードパーティコードでも `CMSError` を直接 throw する際に `docsUrl` / `nextSteps` を渡せば `format()` の出力に反映される。
