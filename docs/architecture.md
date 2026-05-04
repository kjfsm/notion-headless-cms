# アーキテクチャ設計背景

CLAUDE.md と `.claude/rules/` は**事実**を述べる。ここではその**なぜ**を記録する。新規実装やリファクタの判断基準として参照。

## 依存方向

```
Notion DB
  └─ @notion-headless-cms/notion-orm（ユーザーは直接 import しない・CLI 生成物経由で利用 / fetchBlockTree のみ公開 API として直接利用可）
       ├─ @notion-headless-cms/renderer（Markdown→HTML / SSR-only / 非 React 向け）
       ├─ @notion-headless-cms/react-renderer（BlockObjectResponse→React / shadcn/ui + Tailwind v4 / React アプリ向け）
       └─ @notion-headless-cms/core（CMS 統合・キャッシュ・フック・nodePreset）
            ├─ @notion-headless-cms/cache-r2（cloudflarePreset）
            ├─ @notion-headless-cms/cache-kv
            ├─ @notion-headless-cms/cache-next
            └─ @notion-headless-cms/adapter-next
```

### なぜこの形か

- `core` を Notion 固有知識から隔離することで、将来 `source-contentful` などへの差し替えを可能にする
- `renderer` を差し替え可能にしたかった（remark → marked / markdown-it）
- `react-renderer` は `renderer` (HTML) とは並列の出力経路。Markdown 中継せず Notion ブロックを直接 React に変換するため、rich_text annotations や mention 等の情報を失わずに描画できる。React アプリ向けに分離し、SSR-only / 非 React フレームワーク (Astro / Hono / Express) は `notion-embed` の HTML 出力を継続利用
- アダプタが「ランタイム固有の面倒」を引き受け、core はランタイム中立を保つ
- v0.3.0 で `adapter-node` / `adapter-cloudflare` を廃止して preset 方式に変えた理由は、ユーザーが `createCMS` 一本で書けるようにするため（フレームワーク連携 adapter と役割を分離）

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
