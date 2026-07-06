---
description: packages/cms の設計方針（マテリアライズドレプリカ・sync 委譲・公開ポリシー）
paths:
  - "packages/cms/**"
---

# cms パッケージ

`@notion-headless-cms/cms` は Notion アクセス・同期・ストレージ・HTTP 配信を 1 パッケージにまとめて提供する、
このリポジトリの唯一の現行アーキテクチャ（他の workspace パッケージへの依存を持たない独立パッケージ）。

## 北極星

**読者リクエスト処理中は Notion API を一切呼ばない**（`query/find.ts` `query/list.ts` の実装コメント参照）。
`find()`/`list()` は KV（index）/R2（entry 本体・画像）を読むだけで完結し、Notion との同期はリクエスト経路の外側で行う。

## `createCMS(opts)` の主なオプション（`cms/create-cms.ts`）

| オプション | 役割 |
|---|---|
| `schema` | `defineSchema(collections)` の戻り値 |
| `stores.docs` / `stores.blobs` | index 用 `DocStore` / entry 本体・画像用 `BlobStore`（`store/` 参照）。**省略時は in-memory（`memoryDocStore()`/`memoryBlobStore()`）にフォールバック**するため KV/R2 無しでも動く |
| `stores.versionedCache` | `find()` の結果を version キーでキャッシュする任意層 |
| `notion.client` / `notion.token` | ローカルで同期する場合の Notion クライアント（`syncDelegate` 未指定時は必須） |
| `scheduler` | ローカル同期のスケジューラ。**省略時は `createNodeSyncScheduler()` にフォールバック**（`syncDelegate` 指定時は不要） |
| `syncDelegate` | 同期制御を外部（DO 等）に丸ごと委譲する差し替え口。指定時は `notion`/`scheduler` 不要 |
| `transforms` | shiki/katex 等の事前レンダー拡張（同期時に blocks へ焼き込む） |
| `routes` / `imagesPath` | HTTP ハンドラのマウントパス（既定 `/api/cms`）と画像配信パス（既定 `/images`） |
| `webhookSecret` | Notion webhook の `X-Notion-Signature` 検証シークレット |
| `ogp` | OGP エンドポイントの設定。`false` で無効化 |
| `realtime` | 同期完了時に version 同梱で push する `RealtimeAdapter` |
| `logger` / `logLevel` | 同期・配信経路の構造化ログ |

`createCMS` の戻り値はコレクションごとの `{ find, list }` ハンドルに加え、`sync`（`kick`/`onWebhook`/`reconcile`/`getState`/`stats`）・`fetch(request)`・`scheduled()` を持つ。

## スキーマ定義と公開ポリシー

- `defineCollection({ dataSourceId, slug?, properties, statusProperty?, published?, accessible? })` / `defineSchema(collections)` で TypeScript ファーストにスキーマを書く（codegen ではなく直接編集して育てる運用）
- `slug` を省略したコレクション（設定値・選択肢リスト等）は Notion の page id でアドレスされる
- `published`/`accessible` は `statusProperty`（status 型プロパティ）の値集合。`published` は `list()` に載るか、`accessible` は `find()` を許すかを独立に決める。`accessible` 省略時は `published` にフォールバックする（`preview/publication-policy.ts` の `decidePublication`）
- `published`/`accessible` を指定するなら `statusProperty` の指定が必須（設定が黙って無視される経路を作らない設計）

## モジュール構成

| ディレクトリ | 役割 |
|---|---|
| `sync/` | 同期本体。`coordinator.ts`(`SyncCoordinatorCore`：差分取得・chunk 処理・削除検知)、`notion-driver.ts`(コレクション単位の Notion 取得+パイプライン実行)、`multi-source.ts`(コレクション横断の合成)、`rate-limiter.ts`/`retry.ts`(Notion API のレート制御)、`node-scheduler.ts`/`durable-object-scheduler.ts`(スケジューラ実装)、`sync-coordinator-do.ts`(DO ファクトリ + `durableObjectSyncDelegate`)、`realtime-hub-do.ts`(WebSocket hub DO)、`page-index.ts`/`fetch-block-tree.ts`(ページ一覧・ブロック取得) |
| `pipeline/` | 同期時に実行する変換。`blocks.ts`/`images.ts`/`links.ts`/`properties.ts`(Notion 生データ→`EntrySnapshot`)、`resolve-images.ts`(画像 fetch→永続化)、`transform-stage.ts`(shiki/katex 等の拡張ステージ契約) |
| `query/` | 読み取り API。`find.ts`/`list.ts`(KV/R2 参照のみ)、`where.ts`(フィルタ・ソート評価)、`stats.ts`(同期統計) |
| `http/` | `handler.ts`(images/webhook/realtime/preview/ogp を 1 つの `routes` から導出する統合 fetch ハンドラ)、`webhook.ts`(HMAC 署名検証)、`ogp.ts`(OGP fetch ハンドラ、SSRF ガード付き)、`scheduled.ts`(Cron Trigger から reconcile を kick) |
| `preview/` | `handler.ts`(署名付きプレビュー URL ハンドラ。下書きも Notion 直読みで表示)、`publication-policy.ts`(`published`/`accessible` 判定)、`signature.ts`(署名生成・検証) |
| `store/` | `entry-store.ts`/`index-store.ts`(R2/KV への読み書き抽象)、`memory.ts`/`node-file.ts`/`cloudflare.ts`/`rest.ts`(ランタイム別実装)、`versioned-cache.ts`(version キーの `find()` キャッシュ層)、`contract.ts`(実装共通のテスト契約) |
| `render/` | React を使わない利用者向け HTML レンダラ（`./html` サブパスで公開） |
| `transforms/` | `katex.ts`/`shiki.ts`(事前レンダー拡張の実装)、`walk.ts`(blocks 走査ユーティリティ) |

## サブパスエクスポート

`.`（本体）/ `./html` / `./cloudflare` / `./node` / `./testing`。各サブパスの詳細は `.claude/rules/cloudflare.md` の「`@notion-headless-cms/cms/cloudflare`」節を参照。

## 参考

`/home/user/euphoric-band-site` の CLAUDE.md は本パッケージを本番で消費する実例（Cloudflare Workers + Durable Objects + KV/R2 による完全マテリアライズド配信）。
