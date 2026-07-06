---
title: CMS メソッド一覧
description: createCMS で得られる cms API のリファレンス
category: APIリファレンス
order: 1
---

# CMS API リファレンス

`@notion-headless-cms/cms` の `createCMS()` が返す `CMS<S>` が公開する API の一覧。
`@notion-headless-cms/cms` は他の workspace パッケージに依存しない独立パッケージで、
Notion アクセス・同期・ストレージ・HTTP 配信を 1 つにまとめて提供する（v2 の
`core`/`notion-source`/`cache` 相当を統合したもの。それらのパッケージは削除済み）。

## 全体像

```ts
import { createCMS, defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "d8221462-5ae9-8396-bdac-8731f4ef685a",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["下書き", "公開済み"] as const),
    publishedAt: prop.date(),
  },
  statusProperty: "status",
  published: ["公開済み"],
});

const schema = defineSchema({ posts });

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN! },
  // stores?: { index, blobs, versionedCache }
  // scheduler? / syncDelegate? / transforms? / routes? / imagesPath? / webhookSecret?
  // sync? / ogp? / realtime? / waitUntil? / logger? / logLevel?
});

// コレクション別
await cms.posts.find(slug);        // EntrySnapshot<Post> | null
await cms.posts.list(opts?);       // ListResult<IndexEntry<Post>>
await cms.posts.search(query, opts?); // ListResult<IndexEntry<Post>>（IndexStore が全文検索対応の場合）

// 同期制御
await cms.sync.kick();
await cms.sync.onWebhook();
await cms.sync.reconcile();
await cms.sync.getState();
await cms.sync.stats();

// HTTP / Cron
await cms.fetch(request);   // 画像プロキシ・webhook・realtime・preview・OGP を統合配信
await cms.scheduled();      // Cron Trigger から呼び、reconcile() を実行
```

## スキーマ定義

### `defineCollection(config)` / `defineSchema(collections)`

Notion データベース 1 つを 1 コレクションとして定義する。TypeScript ファーストで書き、
codegen ではなく直接編集して育てる運用（`nhc pull` は雛形を一度だけ生成する補助コマンド）。

```ts
interface CollectionConfig<P extends PropertyMap, StatusKey> {
  readonly dataSourceId: string; // Notion の data_source_id
  readonly slug?: keyof P; // 省略時は Notion page id でアドレスする
  readonly properties: P; // prop.* で定義したプロパティマップ
  readonly statusProperty?: StatusKey; // published/accessible を使うなら必須
  readonly published?: readonly string[]; // list() の既定絞り込み対象の値
  readonly accessible?: readonly string[]; // find() を許可する値（省略時は published と同じ）
}
```

`published`/`accessible` を指定するのに `statusProperty` を省略すると
`schema/status_property_required` を投げる（「設定が黙って無視される経路を作らない」設計）。

複数の Notion DB を 1 つの `schema` にまとめる場合は [`../recipes/multi-source.md`](../recipes/multi-source.md) を参照。

### `prop.*` — プロパティ型ビルダー

`title` / `richText` / `select` / `status` / `multiSelect` / `date` / `number` / `checkbox` /
`url` / `formula` / `rollup` / `relation` / `people` / `files` / `uniqueId` / `createdTime` /
`lastEditedBy` の 16 種に対応する。各ビルダーは末尾に実際の Notion プロパティ名を任意で受け取る
（省略時はスキーマキー自身が実名とみなされる）。

```ts
properties: {
  title: prop.title(),                 // 実プロパティ名 = "title"
  name: prop.title("名前"),             // 実プロパティ名は日本語
  author: prop.select(undefined, "著者"), // options を省略して notion 名だけ指定
  tags: prop.multiSelect(),
}
```

未対応のプロパティ型は黙ってスキップせず `UnsupportedValue`（`{ type: "unsupported", raw }`）
として型に残る。

## `EntrySystemMeta` — 自動フィールド

コレクションのプロパティに加えて、すべてのエントリに以下が自動で乗る（`InferEntry<C>`）。

- `id: string` — Notion ページ ID
- `slug: string` — `slug` を省略したコレクションでは Notion page id と同値
- `lastEditedTime: string` — Notion `page.last_edited_time`。version スタンプとして使われる

## コレクション別 API（`CollectionHandle<C>`）

### `find(slug)`

index で version/存在確認 → R2 から `EntrySnapshot` を読んで返す。**キャッシュヒット時、
このパスは Notion API を一切呼ばない**（読者リクエスト処理中は Notion API を呼ばないという
`cms` の設計原則）。`slug` を省略したコレクションでは `find(pageId)` で取得する。

```ts
const post = await cms.posts.find("hello-world");
if (post) {
  post.meta; // InferEntry<Post>（title/status/publishedAt... + id/slug/lastEditedTime）
  post.blocks; // readonly NormalizedBlock[]（画像 URL・内部リンクとも解決済み）
  post.images; // ハッシュ → 画像メタデータ（width/height/contentType）
  post.links; // 正規化 pageId → 内部リンク解決結果（href/title）
  post.version; // lastEditedTime と同値
}
```

戻り値: `Promise<EntrySnapshot<InferEntry<C>> | null>`。未マテリアライズ（同期がまだ 1 度も
そのエントリに到達していない）の場合は `null` を返す。`createCMS({ coldStart: true })` または
`coldStartFetch` を明示した場合のみ、1 回だけブロッキングで Notion から直接取得する
フォールバックが働く（既定は無効）。

### `list(opts?)`

公開済みアイテムの一覧を取得する（本文なし）。index を評価するだけで、
これも Notion API を呼ばない。

```ts
interface ListParams<P> {
  where?: WhereInput<P>; // プロパティ型ごとの演算子（例: { status: { equals: "公開済み" } }）
  sort?: readonly { by: keyof P; direction: "asc" | "desc" }[];
  cursor?: string;
  limit?: number;
}

const { items, nextCursor, hasMore, total } = await cms.posts.list({
  sort: [{ by: "publishedAt", direction: "desc" }],
  limit: 10,
});
```

`where` の演算子はプロパティ型から導出される（`title`/`richText`/`url` は
`equals`/`contains`/`startsWith`/`isEmpty`、`select`/`status` は `equals`/`in`、
`multiSelect` は `has`/`hasAny`/`hasAll`、`date`/`createdTime` は
`equals`/`before`/`after`/`onOrBefore`/`onOrAfter`、`number` は
`equals`/`gt`/`gte`/`lt`/`lte`、`checkbox` は `equals`）。`formula`/`rollup`/`relation`/
`people`/`files`/`uniqueId` は演算子を持たず、対応しない型を `where` に渡すとコンパイルエラーに
なる。

戻り値の各要素（`IndexEntry`）は `{ slug, version, listed, meta }` — プロパティ値は
`item.meta.*` に入る（`find()` の `entry.meta.*` と同じ形）。`total` は `where` 適用後・
ページング前の総件数（ページャ UI 用）。

### `search(query, opts?)`

`upsertEntry` に渡した `searchText`（本文平文）に対する全文検索。`find`/`list` と同様、
Notion API を呼ばずライブラリ内部の `IndexStore` だけで完結する（HTTP には露出しない）。
`where`/`sort`/`cursor`/`limit` も `list()` と同じ形で併用できる。

```ts
const { items, nextCursor, hasMore, total } = await cms.posts.search("notion cms", {
  where: { status: { equals: "公開済み" } },
  limit: 10,
});
```

`memoryIndexStore()` は `searchText` に対する単純な部分一致（大文字小文字を無視）で実装されて
いるが、`@notion-headless-cms/sql`（D1/SQLite/libSQL）は FTS5 の **trigram tokenizer** を使う
本格的な全文検索を提供する。trigram は 3 文字単位でインデックスするため、**3 文字未満のクエリは
トリグラムを 1 つも作れず 1 件も一致しない**点に注意（`sql` パッケージ利用時の既知の制約）。
スコアリングは既定で `bm25()` 昇順、`params.sort` を明示すればそちらが優先される。

## `createCMS(opts)` オプション

| オプション                                       | 役割                                                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`                                         | `defineSchema(collections)` の戻り値                                                                                                                                                                   |
| `stores.index`                                   | コレクション index 用 `IndexStore`。省略時は in-memory（`memoryIndexStore()`）。永続化・全文検索が要る場合は `@notion-headless-cms/sql` の `d1IndexStore`/`sqliteIndexStore`/`libsqlIndexStore` を渡す |
| `stores.blobs`                                   | entry 本体・画像用 `BlobStore`。省略時は in-memory（`memoryBlobStore()`）                                                                                                                              |
| `stores.versionedCache`                          | `find()` の結果を version キーでキャッシュする任意層（`edgeVersionedCache()` 等）                                                                                                                      |
| `notion.client` / `notion.token`                 | ローカルで同期する場合の Notion クライアント（`syncDelegate` 未指定時は必須）                                                                                                                          |
| `scheduler`                                      | ローカル同期のスケジューラ。省略時は `createNodeSyncScheduler()` にフォールバック                                                                                                                      |
| `syncDelegate`                                   | 同期制御を外部（Durable Object 等）に丸ごと委譲する差し替え口。指定時は `notion`/`scheduler` 不要                                                                                                      |
| `coldStartFetch` / `coldStart`                   | 未マテリアライズなエントリを 1 回だけブロッキング取得するフォールバック（既定無効）                                                                                                                    |
| `transforms`                                     | shiki/katex 等の事前レンダー拡張（同期時に blocks へ焼き込む）                                                                                                                                         |
| `routes`                                         | HTTP ハンドラのマウントパス（既定 `/api/cms`）                                                                                                                                                         |
| `imagesPath`                                     | 画像 URL を焼き込む prefix（既定 `/images`。`routes` と結合して配信される）                                                                                                                            |
| `webhookSecret`                                  | Notion webhook の `X-Notion-Signature` 検証シークレット                                                                                                                                                |
| `sync.chunkSize` / `chunkDelayMs` / `debounceMs` | 1 サイクルの処理量・チャンク間隔・webhook debounce                                                                                                                                                     |
| `sync.requestsPerSecond`                         | 全コレクション共有の Notion API レート上限（既定 3）                                                                                                                                                   |
| `sync.dailyWriteBudget` / `writeBudgetWarnRatio` | index write の日次ソフト上限と警告閾値（既定 1000 / 0.8）                                                                                                                                              |
| `ogp`                                            | OGP エンドポイントの設定。`false` で無効化                                                                                                                                                             |
| `realtime`                                       | 同期完了時に version 同梱で push する `RealtimeAdapter`                                                                                                                                                |
| `onVerificationToken`                            | webhook サブスク登録時の `verification_token` 受信コールバック                                                                                                                                         |
| `onRealtimeUpgrade` / `onPreview`                | WebSocket アップグレード・署名付きプレビューの委譲先                                                                                                                                                   |
| `waitUntil`                                      | レスポンス送信後もバックグラウンド処理を完走させるフック（Workers の `ctx.waitUntil`）                                                                                                                 |
| `logger` / `logLevel`                            | 同期・配信経路の構造化ログ出力先と下限レベル                                                                                                                                                           |

`createCMS()` が返す `CMS<S>` は、コレクションごとの `{ find, list, search }` ハンドルに加えて
`sync`（`kick`/`onWebhook`/`reconcile`/`getState`/`stats`）・`fetch(request)`・`scheduled()`
を持つ。`sync` / `fetch` / `scheduled` はコレクション名として予約されており、schema にこれらと
同名のコレクションを定義すると `schema/reserved_collection_name` を投げる。

## 同期制御（`cms.sync`）

| メソッド      | 説明                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `kick()`      | 1 チャンク（既定 2 entry・コレクション横断の総量）分だけ差分同期する。`getState().cursor` が `null` になるまで手動で回せば全件同期になる |
| `onWebhook()` | webhook 受信時に呼ぶ。debounce（既定 3 秒）してから `kick()` 相当を実行する                                                              |
| `reconcile()` | 全件突合し、Notion 側で削除されたページを検知して削除する。`{ removed: string[] }` を返す。Cron Trigger からの定期実行を想定             |
| `getState()`  | `{ cursor, lastSyncAt, lastReconcileAt, failures, writeBudget }` を返す                                                                  |
| `stats()`     | `{ lastSyncAt, lastReconcileAt, failureCount, recentFailures, writeBudget }` を返す（`nhc doctor` 等の観測用）                           |

Durable Object に同期を委譲する場合は `createSyncCoordinatorDO()` / `durableObjectSyncDelegate()`
（`@notion-headless-cms/cms/cloudflare`）を使う。詳細は
[`../recipes/cloudflare-workers.md`](../recipes/cloudflare-workers.md)。

## `cms.fetch(request)` のルート

`routes`（既定 `/api/cms`）以下に以下をマウントする。

| ルート                      | 説明                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET {routes}/images/:hash` | 画像プロキシ（同期時に R2 へ永続保存したバイナリを配信。1 年 immutable キャッシュ）                                         |
| `GET {routes}/realtime`     | WebSocket アップグレード（`onRealtimeUpgrade` 未設定なら 404）                                                              |
| `{routes}/preview/*`        | 署名付きプレビュー（`onPreview` 未設定なら 404。下書きも Notion 直読みで表示）                                              |
| `GET {routes}/ogp?url=...`  | bookmark/embed/link_preview の OGP メタデータ取得（`ogp: false` で無効化）                                                  |
| `POST {routes}/webhook`     | Notion webhook 受信。`verification_token` の echo・`X-Notion-Signature` 検証・`sync.onWebhook()` 呼び出しをまとめて処理する |

`GET {routes}/images/:hash` と `GET {routes}/ogp` 以外は POST 主体。`cms.fetch()` を
1 つマウントすれば画像配信・OGP・webhook・realtime・preview のすべてが賄える
（個別ルートの手動配線は不要）。

## エラーハンドリング

すべての内部エラーは `CMSError`（`<namespace>/<kind>` 形式の `code` を持つ）に統一される。

```ts
import { isCMSError, isCMSErrorInNamespace, matchCMSError } from "@notion-headless-cms/cms";

try {
  await cms.posts.find(slug);
} catch (err) {
  matchCMSError(err, {
    "sync/notion_query_failed": (e) => console.error("Notion 取得失敗:", e.message),
    _: (e) => {
      throw e;
    },
  });
}
```

- `isCMSError(err)` — `CMSError` かどうかの判定
- `isCMSErrorInNamespace(err, "sync/")` — 名前空間で分岐する時に使う
- `err.is(code)` / `err.inNamespace(ns)` — 上記の糖衣構文（インスタンスメソッド）
- `matchCMSError(err, handlers)` — コードごとにハンドラを割り当てて分岐（`_` はフォールバック）

`schema/` `store/` `sync/` `cli/` の各コードは `throw` される。`handler/*`
（`handler/signature_invalid` / `handler/ogp_url_forbidden` / `handler/ogp_fetch_failed`）は
`cms.fetch(request)` が返す JSON レスポンスボディの `code` フィールドとして現れる点に注意
（`throw` はされない）。組み込みコードの原因・対処の一覧は
[`../errors/index.md`](../errors/index.md) を参照。

## サブパスエクスポート

| サブパス                              | 内容                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@notion-headless-cms/cms`            | `createCMS`/`defineCollection`/`defineSchema`/`prop`/`CMSError` など全公開 API                                                                                                                  |
| `@notion-headless-cms/cms/html`       | `renderBlocksToHtml`/`renderBlockToHtml`/`renderRichText`（React 不要の HTML レンダラ）                                                                                                         |
| `@notion-headless-cms/cms/cloudflare` | `r2BlobStore`/`createSyncCoordinatorDO`/`durableObjectSyncDelegate`/`RealtimeHubDO`/`cloudflareStores` 等（Cloudflare Workers 向け。index 用の D1 実装は `@notion-headless-cms/sql/d1` を参照） |
| `@notion-headless-cms/cms/node`       | `fileIndexStore`/`fileBlobStore`（Node ランタイム専用、`node:fs` に依存）                                                                                                                       |
| `@notion-headless-cms/cms/testing`    | `runIndexStoreContract`/`runBlobStoreContract`（`vitest` に依存するテスト専用エントリ）                                                                                                         |
| `@notion-headless-cms/sql`            | `createSqlIndexStore`/`ensureSchema` 等の dialect 非依存コア（`./d1`/`./sqlite`/`./libsql` サブパスで各 Kysely dialect の `IndexStore` を提供。FTS5 全文検索対応）                              |

`.` エントリは Workers 等 `node:fs` の無いランタイムにもバンドルされるため、Node 専用 API
（`./node`）や `vitest` 依存（`./testing`）は分離されている。`sql` は Kysely・dialect ドライバ
（`kysely-d1`/`better-sqlite3`/`@libsql/kysely-libsql`）を追加で持つため `cms` 本体とは別パッケージに
分離されている（`cms` はゼロ依存原則）。

## 関連ドキュメント

- [レンダラの選び方](../choosing-a-renderer.md)
- [Cloudflare Workers + R2 + D1](../recipes/cloudflare-workers.md)
- [複数コレクション構成](../recipes/multi-source.md)
- [カスタムストア](../recipes/custom-cache.md)
- [テスト](../recipes/testing.md)
- [エラーコード一覧](../errors/index.md)
