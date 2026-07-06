---
title: アーキテクチャ設計背景
description: なぜこの構成にしたかの設計記録
category: ガイド
order: 1
---

# アーキテクチャ設計背景

CLAUDE.md と `.claude/rules/` は**事実**を述べる。ここではその**なぜ**を記録する。新規実装やリファクタの判断基準として参照。

## packages/cms

「何ができるか」は `.claude/rules/cms.md` に事実として書く。ここではこのアーキテクチャが**なぜ**こう設計されているかを記録する。

### 依存方向

```
Notion API
  └─ @notion-headless-cms/cms（Notion アクセス・同期・ストレージ・HTTP 配信を1パッケージに統合。ゼロ依存）
       ├─ @notion-headless-cms/react-renderer（BlockObjectResponse→React、shadcn/ui + Tailwind v4）
       ├─ @notion-headless-cms/cli（nhc pull/check/doctor/sync/init）
       └─ @notion-headless-cms/sql（D1/SQLite/libSQL 向け IndexStore 実装。Kysely + FTS5 全文検索）
```

#### なぜこの形か

- `cms` 自体をゼロ依存にしているのは、CLI からも Cloudflare Workers からも同じ核を使い回すため。React・Notion SDK・Cloudflare のいずれかの型に実依存させると、どちらか一方でしか動かせない核になってしまう。`@notionhq/client` 等はすべて peerDependencies に留め、利用側が選んで入れる
- HTML 出力（`cms` の `./html` サブパス、`render/`）と React 出力（`react-renderer`）を並列の出力経路として分けているのは、Markdown 等の中間形式を経由せず Notion ブロックを直接それぞれの出力へ変換したいため。中間形式を挟むと rich_text の annotations や mention 等の情報を落とさずに描画するのが難しくなる
- 設定を `createCMS(opts)` 1 か所（schema・stores・notion・scheduler・syncDelegate・routes 等）に集約しているのは、二重定義と不整合フットガンを無くすため。「利用側の設定入口を 1 つに集約する」という方針自体は、それ以前の設計見直し（RFC）に遡る。経緯は履歴として [`docs/ja/history/rfc-v2-usability-redesign.md`](./history/rfc-v2-usability-redesign.md) に残る

### なぜ読者リクエスト処理中に Notion API を一切呼ばないのか

Cloudflare Workers（特に無料プラン）は 1 リクエストあたりの subrequest 数・CPU 時間に厳しい
上限がある。アクセスの都度 Notion API と突合して鮮度を確認する設計だと、この予算がリクエスト
ごとの Notion API 呼び出し有無に左右され、予測が難しい。そこで同期を完全に読者リクエストの外へ
追い出し、`find()`/`list()` を D1/R2 の参照だけに限定することで、読者 Worker のリクエスト処理に
「固定でハードな」subrequest/CPU 予算を持たせられるようにしている。

### なぜ同期を Durable Object（`syncDelegate`）に委譲できるようにしたのか

読者用 Worker は isolate ごとに複数走る。各 isolate が独立に Notion 同期を試みると、Notion の
レート制限（3 req/sec）を isolate 数だけ奪い合うレースになり、429 が増えるだけで得るものがない。
`syncDelegate`（`durableObjectSyncDelegate`）を使うと、Notion への直列アクセスを単一の Durable
Object インスタンスに一元化でき、レート制限をアプリ全体で 1 箇所のリミッタ（`rate-limiter.ts`）
だけで守れる。読者側 Worker は同期そのものには関与せず、D1/R2 の読み取りに専念できる。

同じ理由で、webhook 通知そのものも 1 件届くたびに同期するのではなく `debounceMs`（既定
3000ms）でまとめる。編集中は 1 ページに対して短時間に複数の webhook が届くことがあり、都度
同期すると Notion API 消費が跳ね上がる。`SyncScheduler.schedule` は「既存の予約があれば置き換
える」契約を持つため、連続イベントは自然に 1 回の同期へ収束する（`sync/coordinator.ts`）。

### Cloudflare 配線の合成プリミティブ（明示的・DI 可能）

consumer の定型配線を薄くするヘルパーを `@notion-headless-cms/cms/cloudflare` に用意している。
いずれも env を覗いて自動検出はせず、実依存（namespace / cache / request）を引数で明示的に受け取る
（構造型なので `@cloudflare/workers-types` に実依存せず、テストで差し替え可能）。

- `durableObjectSyncDelegate({ namespace })`: `{ stub }` に加え namespace を受け、内部で
  `idFromName("global")` から stub を解決する（stub 取得の定型を 1 行に）
- `forwardRealtimeUpgrade({ namespace, request })`: `cms.fetch()` が処理しない WebSocket 購読
  リクエスト（`/api/cms/realtime`）を `RealtimeHubDO` へ転送する（publish 側と `name` を揃える）
- `edgeVersionedCache(cache)`: `createVersionedCacheLayer({ cache })` の糖衣
- `readerReadOnly()`: 同期しない読み取り専用の `CMSSyncDelegate`（DO を持たないプレビュー/読者専用
  Worker が、本番 DO の同期済み D1/R2 を読むだけの構成で使う）

### なぜ `IndexStore`/`BlobStore` を構造型インターフェースにしているのか

`store/cloudflare-types.ts` の `R2BucketLike` は `@cloudflare/workers-types` を実依存に入れない
構造型として定義している。理由:

- `@notion-headless-cms/cms` の本体（`/cloudflare` サブパス以外）を Node.js のテストで動かせる
- 将来 `R2Bucket` の型が変わっても、必要な最小メソッドだけ互換を保てば良い
- 利用側は Workers の `env.XXX`（実 `R2Bucket`）をそのまま渡せる（構造的サブタイプ）

`store/cloudflare.ts` の `r2BlobStore()` がこの構造型を、`store/types.ts` の `BlobStore`（R2
想定・entry 本体と画像バイナリ用）というランタイム中立の抽象へ橋渡しする。index 側
（`find`/`list`/`search` が読む集合）は `store/index-store.ts` の `IndexStore` インタフェースで
抽象化しており、`cms` 自体はゼロ依存原則のため SQL 実装を持たない。KV の点キー get/put では
`where`/`sort`/全文検索といった構造化クエリを表現できないため、永続化・スケール・全文検索が
要る場合は D1/SQLite/libSQL 向けの Kysely 実装（`@notion-headless-cms/sql`）を `IndexStore` として
渡す設計にしている。`BlobStore` を分けているのは TTL の違いではなく（cms は同期済みの複製を
そのまま永続化するだけで、SWR のようなキャッシュ失効の概念を持たない）、index の構造化クエリと
R2 のバイナリ get/head/put という**ストレージ特性の違い**に対応するため。

### なぜ画像・内部リンク・プロパティの変換を読み取り時ではなく同期時に行うのか

Notion 画像 URL の解決・内部リンクの href 生成・プロパティの正規化はどれも「重い」か「外部
呼び出しを伴う」処理になり得る。これらを読み取り時に行うと、読み取り経路を外部呼び出しゼロに
保つという北極星が崩れる。そこで `pipeline/`（`images.ts`/`links.ts`/`properties.ts`/
`resolve-images.ts`）がすべて同期時に実行され、`find()`/`list()` は変換済みのプレーンな
`EntrySnapshot`/`IndexEntry`（JSON）を返すだけになる。

画像はその中でも特に同期時実行が必須な理由がある。Notion の画像 URL は署名付きで**期限が
切れる**（およそ 1 時間）ため、そのまま焼き込むと表示のたびに失効した URL を掴むことになる。
`pipeline/images.ts` の `extractImageRefs()` が block tree から file 参照（image/video/audio/
file/pdf）を集め、`imageCacheKeySource()` で Notion 署名付きホストの再署名クエリを正規化した
うえで SHA256 ハッシュを算出する。同期エンジンがこのハッシュをキーに実 fetch した bytes を
`BlobStore` へ `image/{hash}` として永続化し、`resolve-images.ts` の `resolveImageUrls()` が
block data 内の URL を `{imagesPath}/{hash}` へ書き換える。ハッシュキーは content-addressed
なので同じ画像は 1 回しか fetch されず、Notion 側で再アップロードされても bytes が同じなら
ハッシュも同じで重複保存されない（別画像なら別ハッシュになるため上書き事故もない）。配信は
`http/handler.ts` が同じ `BlobStore` から読むだけのプロキシに徹する。あわせて
`parseImageDimensions()` が先頭バイトから width/height を読み取り、`_dimensions` として block
data に埋め込む（react-renderer 等が CLS ゼロ化に使う）。

### なぜ差分同期に `last_edited_time` を使うのか

Notion API には変更通知 API が無く、「何が変わったか」を能動的に教えてくれる購読の仕組みは
無い。`last_edited_time` は ISO-8601 で単調増加するため、`listChanged`（`sync/notion-driver.ts`）
は `last_edited_time` 降順でクエリし、保存済み index の `version`（= 直近の `last_edited_time`）
と一致した時点で差分終了とみなす、という単純な比較だけで差分検知できる。この値はそのまま
index の `version` として保存され、`find()` の versioned cache キー（`store/versioned-cache.ts`）
にもそのまま使い回される。

### なぜ webhook 駆動の同期に加えて realtime push（WebSocket hub）があるのか

Notion の webhook 通知は配送保証が無く、遅延・欠落があり得る。webhook だけに頼ると、
編集内容が反映されるまでの時間に不確実性が残る。`realtime.ts`（`publishVersionUpdate`）は
同期完了時に version 同梱でクライアントへ即時 push することで、index への伝播を待たずに
「新しい version がある」ことを知らせる。同時に、push 自体も取りこぼされ得る（購読していない
タイミングでの更新など）ため、マウント時・タブ復帰時の revalidate という別経路も併用する。
webhook 駆動同期・realtime push・mount/visibility revalidate の 3 つは互いの弱点を補い合う、
独立した鮮度保証のレイヤーとして設計されている。

### エラー名前空間

`<namespace>/<kind>` の二段名前空間にした理由（`errors.ts`）:

- 利用側が `isCMSErrorInNamespace(err, "sync/")` で広く捕捉できる
- 原因の層（schema 定義 / store 読み書き / HTTP handler / 同期処理 / CLI）が即わかる
- サードパーティ拡張でも `cache-redis/connection_failed` のように名前空間を分ければ被らない
- エラーコードの string enum は強すぎるため `CMSErrorCode = BuiltInCMSErrorCode | (string & {})`
  でリテラル補完だけ残す（`matchCMSError`/`err.is`/`err.inNamespace` はこの上に薄く乗る糖衣）

現在の組み込み名前空間は `schema`/`store`/`handler`/`sync`/`cli` の 5 つ。コード一覧は
`.claude/rules/error-handling.md` または `docs/ja/errors/index.md` を参照。

## 今後の拡張ポイント

- 画像の resize / format 変換（CDN 連携）: `parseImageDimensions()` は現状 width/height の
  読み取りのみを行い、variant 生成は行っていない（`pipeline/images.ts` 参照）

> 改善ロードマップの全体像は [`docs/ja/improvements.md`](./improvements.md) を参照。
