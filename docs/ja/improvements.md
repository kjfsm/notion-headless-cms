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

> このドキュメントは提案の置き場。実装済みになったら「実装済み」へ移す。

## 実装済み（このドキュメント整備と同時）

- **README に React Router を一級市民として追加**（CF Workers + RR の最短コピペ手順）。
- **クイックスタートのコンテンツ取得例を修正**（`post.content` → `await post.html()` ほか）。
- **`notionBlocks()` の無言失敗を解消**: フェッチャ未設定で `undefined` を返したとき、
  `notionSource({ fetch: blocksFetcher() })` を促す警告を一度だけ出す（`packages/core/src/collection.ts`）。
- **ドキュメント drift 修正**（`architecture.md` のパッケージ名、`examples/README.md` の一覧と環境変数）。

---

## DX（なんとなく使える）

### D1. `nhc init --template <name>` でフルスタック雛形を生成
- **課題**: 現状は `examples/*` をフォルダコピーして使う運用。どの example を選び何を削るかの判断が要る。
- **提案**: `nhc init --template cloudflare-react-router|cloudflare-hono|next` で、動く最小構成
  （`app/lib/cms.ts` / ルート / `wrangler.toml` / `nhc.config.ts`）を生成する。
- **影響範囲**: `packages/cli`。テンプレートは `examples/*` を source of truth にして同期。
- **想定工数**: 中。 **リスク**: 低（新規コマンド、既存挙動非破壊）。

### D2. `notionSource` の `fetch` 既定値を `blocksFetcher()` に
- **課題**: React 利用者は毎回 `fetch: blocksFetcher()` を書く必要があり、忘れると `notionBlocks()` が `undefined`。
- **提案**: 既定フェッチャを `blocksFetcher()` にする（明示指定で上書き可）。HTML だけ使う場合も害は小さい。
- **影響範囲**: `packages/notion-source`。 **想定工数**: 小。
- **リスク**: 中（既定挙動の変更。サブリクエスト増の可能性があるため minor bump + 移行ノート必須）。

### D3. Remix 向け `./remix` エクスポート
- **課題**: 現状 `react-renderer/router` は React Router v7 のみ対応。Remix は再検証 API が異なる。
- **提案**: `@notion-headless-cms/react-renderer/remix` を追加し、内部の共通ロジック
  (`src/internal/revalidate.ts`) を Remix の `useRevalidator` 差異に合わせて吸収する。
- **影響範囲**: `packages/react-renderer`。 **想定工数**: 中。 **リスク**: 低（追加エクスポート）。

### D4. `Env` 型と `wrangler types` の連携手順を整備
- **課題**: `worker-configuration.d.ts` 生成後、`Env` の手組みが必要で取っ掛かりにくい。
- **提案**: レシピ/テンプレに `cf-typegen` 前提の `Env` 例と型の流れを明記（一部は本 PR で着手）。
- **影響範囲**: ドキュメントのみ。 **想定工数**: 小。 **リスク**: なし。

---

## 性能（動作速度）

### P1. `notion-source` の `parseWebhook` 実装
- **課題**: core の `DataSource` interface に `parseWebhook` があり `cms.handler({ webhookSecret })`
  も実装済みだが、`notion-source` 側が未実装のため Notion Webhook による即時無効化が機能しない
  （`packages/core/src/types/data-source.ts` 参照）。
- **提案**: Notion の自動化/Webhook ペイロードを解析し `{ collection, slug? }` を返す実装を追加。
  push 型無効化で、クライアントのポーリング負荷とバックグラウンド差分チェックの頻度を削減できる。
- **影響範囲**: `packages/notion-source`（+ core ハンドラのテスト）。 **想定工数**: 中。 **リスク**: 中。

### P2. KV プリウォームの公式ヘルパー化
- **課題**: 各 example が `scripts/warm-kv.ts` を個別実装。Workers Free のサブリクエスト上限で
  初回アクセスがタイムアウトしうる。
- **提案**: REST 経由で KV を事前充填する公式ユーティリティ（`@notion-headless-cms/cloudflare` の
  `rest-kv` を土台に）を提供し、`nhc warm` 等から叩けるようにする。
- **影響範囲**: `packages/cloudflare` / `packages/cli`。 **想定工数**: 中。 **リスク**: 低。

### P3. 画像の resize / format 変換（CDN 連携）
- **課題**: `fetchAndCacheImage` は原寸をそのまま保存。LCP/転送量の最適化余地がある。
- **提案**: 配信時に幅・フォーマット（webp/avif）を変換するオプション、または Cloudflare Images 連携。
- **影響範囲**: `packages/core/src/image.ts` + cache。 **想定工数**: 大。 **リスク**: 中。

### P4. `blocksFetcher` の並列度とサブリクエスト上限のチューニング指針
- **課題**: 既定 `concurrency: 3`。CF Free のサブリクエスト上限と相性問題が起きうる。
- **提案**: 環境別の推奨値と、`markdownFetcher`（1 リクエスト取得）との使い分けを表で明文化。
  必要なら環境検出で既定値を自動調整。
- **影響範囲**: ドキュメント中心（+ `fetch-blocks` の既定値検討）。 **想定工数**: 小〜中。 **リスク**: 低。

---

## ドキュメント follow-up（別 PR）

- `.claude/rules/package-boundaries.md` / `.claude/rules/cloudflare.md` の旧パッケージ名
  （`renderer` / `adapter-next` / `cache-r2` / `cache-kv`）の drift 修正。
  CLAUDE.md ルール #5 により `.claude-next/` 経由で実施する。
