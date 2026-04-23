---
name: architecture-deepdive
description: SWR キャッシュ戦略、Notion 更新検知、画像プロキシ、キャッシュ抽象、エラー名前空間の設計背景を説明する。新規実装やリファクタ時に参照
---

# architecture-deepdive — 設計背景の解説

CLAUDE.md / rules からは事実のみを参照し、**なぜそうなっているか**はここに書く。

## 依存方向

`source-notion` が**真下**、`renderer` と `core` が**中間**、`adapter-*` と `cache-*` が**末端**。これは:

- `core` が Notion 固有の知識を持たないため、将来 `source-contentful` などに差し替え可能
- `renderer` を差し替え可能にしたかった（remark → marked / markdown-it）
- アダプタが「ランタイム固有の面倒」を引き受け、core はランタイム中立を保つ

## SWR（Stale-While-Revalidate）

### 戦略

1. キャッシュがあればそれを即返す（`stale` であっても）
2. `stale` なら**裏で**非同期フェッチ → HTML 生成 → キャッシュ書き戻し
3. 次回のアクセスは新しいキャッシュヒット

### なぜ SWR か

- Workers のリクエストレイテンシを最小化するため
- Notion API のレート制限（3 req/sec）を迂回
- 訪問者には即応、変更は裏で追従

### TTL と検知の関係

- `ttlMs` は SWR の「stale 判定」の閾値
- それとは別に `last_edited_time` 比較で能動的な更新検知も可能（`checkItem` / `checkList`）
- Webhook で `revalidate` を呼べば即時反映

## Notion 更新検知

`last_edited_time` だけで判定する理由:

- Notion API に変更通知 API は無い（v5 時点）
- `last_edited_time` は ISO-8601 で単調増加（マイクロ秒まで）
- キャッシュメタデータに保存した時刻と比較するだけで差分検知できる

## 画像プロキシ

### 問題

Notion 画像 URL は**期限付き**（署名 URL）。1 時間で失効するため、ユーザーの HTML に直貼りできない。

### 解決

1. `fetchAndCacheImage()` で画像 bytes を取得
2. SHA256 ハッシュをキーにストレージ保存
3. HTML 内の `src` は `/{imageProxyBase}/{hash}` に書き換え
4. プロキシエンドポイントがストレージから返す

### イミュータブル前提

ハッシュキーなので同じ画像は 1 回だけ fetch される。Notion が同じ画像を再アップしてもハッシュが変われば別物として扱われる。

## キャッシュ抽象

### DocumentCacheAdapter / ImageCacheAdapter

- document: HTML + メタデータ（`last_edited_time` など）
- image: bytes のみ + content-type

これらを分けた理由:

- document は TTL と検知が重要（renderer が重いので）
- image はほぼイミュータブルで TTL 不要
- ストレージ特性が違う（document は KV 的 / image は Blob 的）

### 構造型 R2BucketLike

`@cloudflare/workers-types` を実依存に入れない設計理由:

- cache-r2 を Node.js テストで動かせる
- 将来 `R2Bucket` が変わっても、必要な最小メソッドのみ互換を保てば良い
- ユーザーは `R2Bucket` をそのまま渡せる（構造的サブタイプ）

## エラー名前空間

`<namespace>/<kind>` の二段名前空間にした理由:

- 利用側が `isCMSErrorInNamespace(err, "source/")` で広く捕捉できる
- 原因の層（source / cache / renderer / core）が即わかる
- サードパーティ拡張でも `cache-redis/connection_failed` のように被らない
- エラーコードの string enum は強すぎるため `string & {}` でリテラル補完だけ残す

## 今後の拡張ポイント

- `source-*` プラグイン化（`@notion-headless-cms/source-contentful` 等）
- `DocumentCacheAdapter<T>` ジェネリクスで任意メタデータ対応
- Webhook 受信の統一ルートハンドラ（現状は adapter-next のみ）
- 画像変換（resize / format 変換）の CDN 統合
