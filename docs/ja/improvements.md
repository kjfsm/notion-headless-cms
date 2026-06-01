---
title: 改善ロードマップ
description: 性能・DX の改善案（実装済み / 提案）
category: ガイド
order: 2
---

# 改善ロードマップ

「どうなったらより良いライブラリになるか」を **動作速度** と **利用者の使いやすさ (DX)** の
観点で整理する。特に **Cloudflare Workers + React Router のユーザーが "なんとなく" で
使える** ことを重視する。各案は *課題 / 提案 / 影響範囲 / 想定工数 / リスク* で記述する。

> 使い勝手をコンセプトレベルから作り直す（クリーンスレート v2）提案は
> [`rfc/v2-usability-redesign.md`](./rfc/v2-usability-redesign.md) を参照。

## 実装済み

### 第 1 弾（ドキュメント整備）
- README に React Router を一級市民として追加（CF Workers + RR の最短コピペ手順）。
- クイックスタートのコンテンツ取得例を修正（`post.content` → `await post.html()` ほか）。
- `notionBlocks()` の無言失敗を解消（`undefined` 時に一度だけ警告）。
- ドキュメント drift 修正（`architecture.md` のパッケージ名、`examples/README.md`）。

### 第 2 弾（DX / 性能の実装）
- **`notionSource({ fetch })` は省略可と明確化**: notion-orm の既定が blocks 戦略のため、
  `fetch: blocksFetcher()` を渡さなくても `notionBlocks()` が使える。README / レシピを修正し、
  警告メッセージも markdown 戦略向けに正確化（D2 を「設定不要」という形で解決）。
- **`notion-source` の `parseWebhook` 実装**（P1）: `NotionCollection.parseWebhook` を追加。
  シークレット検証（`?secret=` / `X-Webhook-Secret` / `Authorization: Bearer`）＋ body の
  `slug` で対象を絞り、無ければコレクション全体を無効化。`notionSource` が `collectionName` を
  通して `InvalidateScope.collection` を埋める。
- **`nhc init --template <name>`**（D1）: `node` / `cloudflare-react-router` / `cloudflare-hono` /
  `next` を用意。ランタイムに合った `output` と次のステップ（依存・binding・example 導線）を出力。
- **KV プリウォームの公式ヘルパー**（P2）: `@notion-headless-cms/client/cloudflare` に `restKvCache()` と
  `readRestKvEnv()` を追加。`createClient({ cache: [restKvCache(readRestKvEnv())] })` →
  `cms.<collection>.cache.warm()` で Node から KV を事前充填できる。
- **`.claude/rules` / `CLAUDE.md` の旧パッケージ名 drift 修正**（renderer→markdown-html、
  adapter-next→next、cache-r2/kv/next→cache、source-notion→notion-source）。

---

### 第 3 弾（v2 コンセプト再設計）
- **単一エントリ `createCMS`（`@notion-headless-cms/client`）**: `createClient` + `notionSource`
  + preset の合成を 1 呼び出しに集約。メタパッケージ（node/cloudflare/next）を廃止し
  `./next` `./cloudflare` `./react` サブパスに統合（RFC: `rfc/v2-usability-redesign.md`）。
- **content モード `"html"` / `"react"`**: 取得戦略と renderer を内部結線し不整合フットガンを排除。
  アクセサ型も mode で分岐し `notionBlocks()` を `NotionBlock[]`（react モード・非 undefined）に型付け。
- **status 値の型安全**: `published` / `accessible` を schema の status options で型付け。
- **取得戦略と subrequest 制限の指針**（P4 を content モードの選び方として明文化、
  `recipes/cloudflare-workers.md`）。

## 提案（未実装）

### DX

#### D3. Remix 向け `./remix` エクスポート
- **課題**: 現状 `react-renderer/router` は React Router v7 のみ対応。Remix は再検証 API が異なる。
- **提案**: `@notion-headless-cms/react-renderer/remix` を追加し、共通ロジック
  (`src/internal/revalidate.ts`) を Remix の `useRevalidator` 差異に合わせて吸収する。
- **影響範囲**: `packages/react-renderer`。 **想定工数**: 中。 **リスク**: 低（追加エクスポート）。

#### D5. `nhc init --template` のフルファイル生成
- **課題**: 現状の `--template` は `nhc.config.ts` と次ステップ案内まで。ルート/ハンドラ等は
  example をコピーする運用。
- **提案**: `examples/*` を source of truth に、ルート・`wrangler.toml`・`workers/app.ts` まで
  生成する。テンプレ同期の仕組みが要る。 **想定工数**: 大。 **リスク**: 中。

### 性能

#### P3. 画像の resize / format 変換（CDN 連携）
- **課題**: `fetchAndCacheImage` は原寸保存。LCP/転送量の最適化余地。
- **提案**: 配信時の幅・フォーマット変換、または Cloudflare Images 連携。
- **影響範囲**: `packages/core/src/image.ts` + cache。 **想定工数**: 大。 **リスク**: 中。
- （P4「取得戦略と並列度の指針」は第 3 弾で content モードの選び方として明文化済み）
