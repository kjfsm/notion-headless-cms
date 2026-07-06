---
title: EmDash から学ぶ改善調査
description: EmDash CMS との比較と、nhc に流用可能なアイデアの評価
category: ガイド
order: 6
---

# EmDash から学ぶ改善調査

[EmDash CMS](https://emdashcms.com/)（[emdash-cms/emdash](https://github.com/emdash-cms/emdash)）を
参考に、nhc に真似できる設計・改善点を洗い出した調査記録。**流用候補はトレードオフ付きで列挙**し、
実装対象は本ドキュメントで比較してから個別に決める。

> このドキュメントは「何を学び、何を採らないか」を記録する調査資料。改善提案の実装ロードマップは
> [`improvements.md`](./improvements.md)、他ヘッドレス CMS 一般との比較は [`comparison.md`](./comparison.md) を参照。

## 0. 最重要の前提: EmDash は Notion ベースではない

`emdash-cms/emdash` は **Notion を一切使わない**。package.json の自己説明は
"Agent-portable reimplementation of WordPress on Astro"。つまり **Astro ネイティブの WordPress 代替**で、
コンテンツソースは自前 SQL DB + 自前管理画面（React / TipTap）。作者は Matt Kane、MIT、beta。

→ 「丸ごと真似る」は成立しない。**設計思想の個別アイデア単位**で流用可否を判定する。

## 1. 根本的な設計の違い

| 軸               | nhc                             | EmDash                                |
| ---------------- | ------------------------------- | ------------------------------------- |
| 真実の源         | Notion                          | 自前 SQL DB（`ec_*` 実テーブル）      |
| 編集 UI          | Notion 自体                     | 自前 admin（React / TipTap）          |
| ストレージ       | KV（index）+ R2（entry / 画像） | D1 / SQLite / libSQL / PG（Kysely）   |
| ページアクセス時 | KV/R2 参照（外部 API 0）        | ローカル / エッジ SQL 引き            |
| 反映             | webhook 同期 → KV/R2 更新       | 編集 = 即 DB 反映（Live Collections） |
| 型安全           | TS-first `defineSchema`         | DB-first → `emdash types` 生成        |
| ランタイム       | CF Workers + DO（中立核）       | Astro integration + CF                |

**共通思想**: 「配信時に外部を叩かずローカルストアを引く」。nhc は Notion、EmDash は WordPress DB を
それぞれ排して同じ結論に到達している。

## 2. nhc が既に持っている（EmDash と同等以上・新規作業不要）

EmDash の「真似したく見える部分」の多くは、nhc が既に別の形で達成している。

- 読み取り経路で外部 API を呼ばない（KV/R2 マテリアライズ、`query/find.ts`・`query/list.ts`）
  = EmDash のローカル SQL 引きと同思想
- content / presentation 分離（`NormalizedBlock` → `./html` / `react-renderer` の二経路）
  = EmDash の Portable Text 相当
- 未知ブロックの安全フォールバック（`react-renderer` の `Unsupported.tsx`、HTML は子要素描画）
  = EmDash の read-only プレースホルダ相当
- 型安全スキーマ（`defineSchema` / `InferEntry` / 17 種 PropDef / `AssertJsonValue` によるシリアライズ保証）
- 3 層の鮮度保証（webhook `debounceMs` + realtime WebSocket push + mount/visibility revalidate）
- content-addressed 画像永続化（Notion 署名 URL 失効対策、SHA256、`pipeline/images.ts`）

## 3. EmDash から流用価値のある候補

### 候補 A: D1 / SQLite + FTS5 のクエリバックエンド ★本命

- **現状の穴**: `store/index-store.ts` の `listEntries` は **コレクション全件を KV の 1 キー（JSON 配列）に持ち、
  Worker メモリで filter / sort / paginate**（`query/where.ts`）。→ KV 値 25MB 上限・毎回全ロード・
  DB pushdown 無し・**本文の全文検索が無い**。
- **EmDash の学び**: index を SQL に持ち WHERE / ORDER / LIMIT を DB へ押し下げ、**FTS5 で本文全文検索**。
- **収め方**: `IndexStore` は既に構造型で差し替え可能。`d1IndexStore` を追加実装（既定の KV マニフェストは温存）。
  同期時に `IndexEntry` を行 + FTS 仮想テーブルへ書き込み。読み取りは D1 クエリなので
  「読者リクエストで Notion を呼ばない」北極星は維持される。
- **効果**: 全文検索 / 大規模コレクションのスケール / ソート・ページネーションの効率化。
- **コスト・リスク**: 大。D1 バインディング前提の新経路、同期側の書き込み二重化、スキーマ移行。
  → **オプトインの追加バックエンド**として設計すれば既存利用者に非破壊。

### 候補 B: Astro Live Content Collections アダプタ

- **現状**: `examples/cloudflare-astro` は生 `cms.posts.list()` / `find()` を呼ぶだけで、Astro の `LiveLoader`
  （リクエスト毎のランタイム fetch）を使っていない。
- **EmDash の学び**: `getEmDashCollection("posts")` = Astro `getLiveCollection()`。nhc はまさにランタイム配信型で相性が良い。
- **収め方**: `cms/astro` サブパスに `notionLiveLoader(cms)` を追加。ユーザーは `astro.config` で live collection を定義し
  `getLiveCollection("posts")` で取得する。既存 `find` / `list` の薄いラッパ。
- **効果**: Astro ユーザーが標準イディオムで「デプロイ不要・即時反映」を書ける。DX 向上。
- **コスト・リスク**: 中（追加サブパス・非破壊）。Astro Live Collections が実験的 API な点に注意。

### 候補 C: 画像配信の最適化（R2 直配信 + 幅バリアント）

- **現状**: `http/handler.ts` が Worker で `BlobStore` から読んで返すプロキシ = 画像 1 枚ごとに Worker CPU / リクエストを消費。
  原寸保存（既存ロードマップ [P3](./improvements.md) が未実装）。
- **EmDash の学び**: 署名 URL 直アップロード / S3 API 抽象でストレージ非依存。nhc 側の対応領域は「配信」。
- **収め方**: R2 public bucket / R2 カスタムドメイン / 署名 URL で Worker を画像経路から外す。加えて
  Cloudflare Images または同期時 variant 生成で `?w=` に対応（`react-renderer` の `imageSizes` srcSet と接続）。
- **効果**: Worker 負荷減 / LCP・転送量最適化。既存 P3 の具体化。
- **コスト・リスク**: 中〜大。配信 URL 規約の変更・キャッシュ整合。

## 4. 流用しない（nhc の思想と逆 / 不適用）

- **DB-first スキーマ + 型生成**: nhc は TS-first を意図的に選択（[`architecture.md`](./architecture.md)）。
  `nhc pull` の introspect が健全な中間解。
- **管理画面（manifest 駆動 UI）**: nhc は Notion が管理画面。作る必要なし（nhc の存在意義そのもの）。
- **サンドボックスプラグイン（Cloudflare Worker Loaders）**: プラグイン機構が無くオーバーキル。
- **ImportSource pluggable**: ソースは常に Notion。将来マルチソース化するなら再検討。
- **（参考・低優先）エージェントファースト（MCP + skill）**: 「Notion コンテンツを操作する MCP」は将来の DX 候補。

## 5. 推奨する次の一手

候補 A が最も本質的（全文検索 + スケールは現状の明確な穴）だがコストが大きい。低リスク・DX 即効の
**B で足場**を作り、**A を本命**として設計、**C は既存 P3 に接続**、という順が現実的。
実装対象が確定したら候補ごとに個別プランを作成する。

## 関連ドキュメント

- [`architecture.md`](./architecture.md) — 設計思想と「なぜ Notion を叩かないか」
- [`improvements.md`](./improvements.md) — 改善ロードマップ（P3 画像最適化など）
- [`comparison.md`](./comparison.md) — 他ヘッドレス CMS 一般との比較

## 出典

- nhc 側: `query/find.ts`・`query/list.ts`・`store/index-store.ts`（全件マニフェスト方式）・
  `query/where.ts`（in-memory 評価）・`http/handler.ts`（画像プロキシ）・
  `examples/cloudflare-astro/src/lib/data.ts`（生 list / find 消費）を直接確認。
- EmDash 側: GitHub raw 経由で README・package.json・docs の architecture / internals を一次確認
  （公式サイトはプロキシ制限で未取得のため GitHub raw で代替）。
