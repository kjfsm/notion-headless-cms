---
title: アーキテクチャ設計背景
description: なぜこの構成にしたかの設計記録
category: ガイド
order: 1
---

# アーキテクチャ設計背景

CLAUDE.md と `.claude/rules/` は**事実**を述べる。ここではその**なぜ**を記録する。新規実装やリファクタの判断基準として参照。

## 依存方向

```
Notion DB
  └─ @notion-headless-cms/notion-orm（ユーザーは直接 import しない・notion-source 経由で利用）
       ├─ @notion-headless-cms/fetch-blocks   （BlockObjectResponse ツリー取得 + React Renderer）
       ├─ @notion-headless-cms/fetch-markdown （Notion Markdown API で本文取得 / サブリクエスト節約）
       ├─ @notion-headless-cms/markdown-html  （Markdown→HTML / SSR-only / 非 React 向け）
       ├─ @notion-headless-cms/react-renderer （BlockObjectResponse→React / shadcn/ui + Tailwind v4）
       ├─ @notion-headless-cms/notion-source  （CMSAdapter 実装 / createCMS が内部で組み込む）
       └─ @notion-headless-cms/core           （CMS 統合・キャッシュ・フック・nodePreset）
            └─ @notion-headless-cms/cache      （memory + サブパス /cloudflare（KV+R2, kvCache / r2Cache）/next）

利用側の単一エントリ（これ 1 つ + サブパスで揃う）:
  @notion-headless-cms/client            = createCMS（core + notion-source + fetch-* + preset を集約）
  @notion-headless-cms/client/cloudflare = kvCache / r2Cache / restKvCache
  @notion-headless-cms/client/next       = createNextHandler / nextPreset
  @notion-headless-cms/client/react      = Renderer / NotionRevalidator
```

### なぜこの形か

- `core` を Notion 固有知識から隔離することで、将来 `source-contentful` などへの差し替えを可能にする
- `markdown-html`（Markdown→HTML レンダラ）を差し替え可能にしたかった（remark → marked / markdown-it）
- `react-renderer` は `renderer` (HTML) とは並列の出力経路。Markdown 中継せず Notion ブロックを直接 React に変換するため、rich_text annotations や mention 等の情報を失わずに描画できる。React アプリ向けに分離し、SSR-only / 非 React フレームワーク (Astro / Hono / Express) は `notion-embed` の HTML 出力を継続利用
- アダプタが「ランタイム固有の面倒」を引き受け、core はランタイム中立を保つ
- ランタイム差分（Node / Cloudflare）を `nodePreset` / `cloudflarePreset` という preset に閉じ込めているのは、ユーザーが `createClient` 一本で書けるようにするため（フレームワーク連携グルーとは役割を分離する）
- 空の `CMSSources` インターフェースと `notion-source` パッケージを分離しているのは、生成物に Notion 固有のラッパー実装を埋め込まずに済ませるため。`declare module` でアダプターパッケージが `sources.<key>` を宣言マージできるので、Fastify プラグインのように `import` するだけで型が拡張される。生成物はスキーマだけを持ち、ランタイム設定は `createCMS` / `createClient` 側で組み立てる
- ランタイム選択・取得戦略・renderer の組み合わせを `@notion-headless-cms/client` の `createCMS` + サブパスの 1 か所に集約しているのは、二重定義と不整合フットガンを無くすため（RFC: `rfc/v2-usability-redesign.md`）。`createClient` / `notionSource` / preset は client が re-export する escape hatch として残す

## SWR（Stale-While-Revalidate）

### 戦略

| 条件 | 挙動 |
|---|---|
| TTL 設定あり + 期限切れ | ブロッキングフェッチ（stale を返さない） |
| TTL 設定あり + 期限内 | キャッシュ即時返却 + バックグラウンド差分チェック |
| TTL 設定なし（永続） | キャッシュ即時返却 + バックグラウンドで毎回差分チェック |
| キャッシュなし | ブロッキングフェッチ |

### バックグラウンド差分チェック

- アイテム: `source.getLastModified(item)` を `cached.notionUpdatedAt` と比較
  - 変更あり → 再レンダリング + キャッシュ更新
  - 変更なし + TTL あり → `cachedAt` をリセット（次回の期限切れを先送り）
- リスト: `source.getListVersion(items)` で比較
  - 変更あり → 新しいリストでキャッシュ更新
  - 変更なし + TTL あり → `cachedAt` をリセット

### なぜ TTL 切れをブロッキングにしたか

- TTL を「許容できる陳腐化の上限」として使いたいユーザー要件に対応
- TTL 未設定なら KV/R2 を永続キャッシュとして扱い、差分があれば裏で追従
- 毎回差分チェックを行うことで TTL なしでも Notion 更新が次のリクエストに反映される

### Webhook で即時反映

- `$handler` に webhook エンドポイントを登録し、Notion 変更通知を受信
- `revalidate()` でキャッシュ全体または特定スラッグを即時無効化
- webhook で更新を即時反映する構成では push が主経路になるため、バックグラウンド差分チェックの
  間隔 `swr.recheckWindowMs`（既定 30 秒＝webhook なし基準）は長め（例: 5 分）にして
  Notion API 消費を抑えてよい。フォアグラウンドは常にキャッシュ即返しのため体感速度には影響しない

## Notion 更新検知

`last_edited_time` は `BaseContentItem.lastEditedTime` として `core` で公開され、
schema で直接マッピング可能なメタデータフィールドである。
CLI が Notion DB を introspect する際は `status` 型と同様に自動検出されるが、
`PropertyDef.type` として定義不要（システム自動セット）。

判定に使う理由:

- Notion API に変更通知 API は無い（v5 時点）
- `last_edited_time` は ISO-8601 で単調増加（マイクロ秒まで）
- キャッシュメタデータに保存した時刻と比較するだけで差分検知できる

## 画像プロキシ

### 問題

Notion 画像 URL は**期限付き**（署名 URL）。1 時間で失効するため、ユーザーの HTML に直貼りできない。

### 解決

1. `fetchAndCacheImage()` で画像 bytes を取得
2. SHA256 ハッシュをキーにストレージ保存
3. HTML 内の `src` を `/{imageProxyBase}/{hash}` に書き換え
4. プロキシエンドポイントがストレージから返す

### イミュータブル前提

ハッシュキーなので同じ画像は 1 回だけ fetch される。Notion が同じ画像を再アップしてもハッシュが変われば別物として扱われる。

## キャッシュ抽象

### DocumentCacheAdapter / ImageCacheAdapter

- document: HTML + メタデータ（`last_edited_time` など）
- image: bytes のみ + content-type

分けた理由:

- document は TTL と検知が重要（renderer が重いので）
- image はほぼイミュータブルで TTL 不要
- ストレージ特性が違う（document は KV 的 / image は Blob 的）

### 構造型 `R2BucketLike`

`@cloudflare/workers-types` を実依存に入れない理由:

- `@notion-headless-cms/cache`（`/cloudflare` サブパス）を Node.js テストで動かせる
- 将来 `R2Bucket` が変わっても、必要な最小メソッドのみ互換を保てば良い
- ユーザーは `R2Bucket` をそのまま渡せる（構造的サブタイプ）

## エラー名前空間

`<namespace>/<kind>` の二段名前空間にした理由:

- 利用側が `isCMSErrorInNamespace(err, "source/")` で広く捕捉できる
- 原因の層（source / cache / renderer / core）が即わかる
- サードパーティ拡張でも `cache-redis/connection_failed` のように被らない
- エラーコードの string enum は強すぎるため `string & {}` でリテラル補完だけ残す

## packages/cms（v3）

「何ができるか」は `.claude/rules/cms.md` に事実として書く。ここでは v2 とは独立したこの
アーキテクチャが**なぜ**こう設計されているかを記録する。

### なぜ読者リクエスト処理中に Notion API を一切呼ばないのか

Cloudflare Workers（特に無料プラン）は 1 リクエストあたりの subrequest 数・CPU 時間に厳しい
上限がある。v2 の SWR 方式のようにアクセス時に Notion と突合する設計では、この予算がリクエスト
ごとの Notion API 呼び出し有無に左右され、予測が難しい。v3 は同期を完全に読者リクエストの外へ
追い出し、`find()`/`list()` を KV/R2 の参照だけに限定することで、読者 Worker のリクエスト処理に
「固定でハードな」subrequest/CPU 予算を持たせられるようにしている。

### なぜ同期を Durable Object（`syncDelegate`）に委譲できるようにしたのか

読者用 Worker は isolate ごとに複数走る。各 isolate が独立に Notion 同期を試みると、Notion の
レート制限（3 req/sec）を isolate 数だけ奪い合うレースになり、429 が増えるだけで得るものがない。
`syncDelegate`（`durableObjectSyncDelegate`）を使うと、Notion への直列アクセスを単一の Durable
Object インスタンスに一元化でき、レート制限をアプリ全体で 1 箇所のリミッタ（`rate-limiter.ts`）
だけで守れる。読者側 Worker は同期そのものには関与せず、KV/R2 の読み取りに専念できる。

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
  Worker が、本番 DO の同期済み KV/R2 を読むだけの構成で使う）

### なぜ画像・内部リンク・プロパティの変換を読み取り時ではなく同期時に行うのか

Notion 画像 URL の解決・内部リンクの href 生成・プロパティの正規化はどれも「重い」か「外部
呼び出しを伴う」処理になり得る。これらを読み取り時に行うと、v3 の北極星（読み取り経路を
外部呼び出しゼロに保つ）が崩れる。そこで `pipeline/`（`images.ts`/`links.ts`/`properties.ts`/
`resolve-images.ts`）がすべて同期時に実行され、`find()`/`list()` は変換済みのプレーンな
`EntrySnapshot`/`IndexEntry`（JSON）を返すだけになる。

### なぜ webhook 駆動の同期に加えて realtime push（WebSocket hub）があるのか

Notion の webhook 通知は配送保証が無く、遅延・欠落があり得る。webhook だけに頼ると、
編集内容が反映されるまでの時間に不確実性が残る。`realtime.ts`（`publishVersionUpdate`）は
同期完了時に version 同梱でクライアントへ即時 push することで、KV への伝播を待たずに
「新しい version がある」ことを知らせる。同時に、push 自体も取りこぼされ得る（購読していない
タイミングでの更新など）ため、マウント時・タブ復帰時の revalidate という別経路も併用する。
webhook 駆動同期・realtime push・mount/visibility revalidate の 3 つは互いの弱点を補い合う、
独立した鮮度保証のレイヤーとして設計されている。

## 今後の拡張ポイント

- `source-*` プラグイン化（`@notion-headless-cms/source-contentful` 等）
- `notion-source` の `parseWebhook` 実装（Webhook 即時無効化の有効化。core の `cms.handler({ webhookSecret })` 側は実装済み）
- `DocumentCacheAdapter<T>` ジェネリクスで任意メタデータ対応
- 画像変換（resize / format 変換）の CDN 統合

> 改善ロードマップの全体像は [`docs/ja/improvements.md`](./improvements.md) を参照。
