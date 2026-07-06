---
title: 改善ロードマップ
description: 性能・DX の改善案（実装済み / 提案）
category: ガイド
order: 2
---

# 改善ロードマップ

「どうなったらより良いライブラリになるか」を **動作速度** と **利用者の使いやすさ (DX)** の
観点で整理する。特に **Cloudflare Workers + React Router のユーザーが "なんとなく" で
使える** ことを重視する。各案は _課題 / 提案 / 影響範囲 / 想定工数 / リスク_ で記述する。

> 使い勝手をコンセプトレベルから作り直す（クリーンスレート v2）提案の経緯は
> [`history/rfc-v2-usability-redesign.md`](./history/rfc-v2-usability-redesign.md) を参照
> （歴史的記録。v2 系パッケージは削除済みで、現行の唯一のアーキテクチャは `@notion-headless-cms/cms`）。

## 実装済み

> 以下は実装当時（v2 期を含む）のパッケージ名・API 名で記録した履歴。`core`/`client`/
> `notion-source`/`notion-orm` 等の v2 系パッケージは全て削除済みで、現行の唯一の
> アーキテクチャは `@notion-headless-cms/cms`（+ `react-renderer`/`cli`）。現行アーキテクチャでの
> 対応状況は各項目末尾の注記を参照。

### 第 1 弾（ドキュメント整備）

- README に React Router を一級市民として追加（CF Workers + RR の最短コピペ手順）。
- クイックスタートのコンテンツ取得例を修正（`post.content` → `await post.html()` ほか）。
- `notionBlocks()` の無言失敗を解消（`undefined` 時に一度だけ警告）。
- ドキュメント drift 修正（`architecture.md` のパッケージ名、`examples/README.md`）。

### 第 2 弾（DX / 性能の実装）

- **`notionSource({ fetch })` は省略可と明確化**: notion-orm の既定が blocks 戦略のため、
  `fetch: blocksFetcher()` を渡さなくても `notionBlocks()` が使える。README / レシピを修正し、
  警告メッセージも markdown 戦略向けに正確化（D2 を「設定不要」という形で解決）。
  _（v2 時点の記録。`notion-source`/`notion-orm` は削除済みで、この API 自体はもう存在しない）_
- **`notion-source` の `parseWebhook` 実装**（P1）: `NotionCollection.parseWebhook` を追加。
  シークレット検証（`?secret=` / `X-Webhook-Secret` / `Authorization: Bearer`）＋ body の
  `slug` で対象を絞り、無ければコレクション全体を無効化。`notionSource` が `collectionName` を
  通して `InvalidateScope.collection` を埋める。
  _（v2 時点の記録。v3 では `cms` の `http/webhook.ts` が HMAC 署名検証（`handler/signature_invalid`）
  を担い、Notion webhook → 非同期同期という設計に置き換わっている）_
- **`nhc init --template <name>`**（D1）: `node` / `cloudflare-react-router` / `cloudflare-hono` /
  `next` を用意。ランタイムに合った `output` と次のステップ（依存・binding・example 導線）を出力。
  _（v2 時点の記録。v3 の `nhc init` はランタイム別 `--template` を廃止し、常に Cloudflare
  Workers 向けのフル構成一式（`wrangler.toml`・`src/schema.ts`・Hono マウントコード）を生成する
  形に置き換わった。詳細: 本ドキュメント下部の「D5. `nhc init --template` のフルファイル生成」参照）_
- **KV プリウォームの公式ヘルパー**（P2）: `@notion-headless-cms/client/cloudflare` に `restKvCache()` と
  `readRestKvEnv()` を追加。`createClient({ cache: [restKvCache(readRestKvEnv())] })` →
  `cms.<collection>.cache.warm()` で Node から KV を事前充填できる。
  _（v2 時点の記録。`client` は削除済みで、同種の REST 経由 KV/R2 アクセスは `cms` の
  `store/rest.ts`（`restKvNamespace`/`restR2Bucket`/`readRestEnv`）に引き継がれている）_
- **`.claude/rules` / `CLAUDE.md` の旧パッケージ名 drift 修正**（renderer→markdown-html、
  adapter-next→next、cache-r2/kv/next→cache、source-notion→notion-source）。
  _（v2 期の内部命名整理。該当パッケージは全て削除済み）_

---

### 第 3 弾（v2 コンセプト再設計）

- **単一エントリ `createCMS`（`@notion-headless-cms/client`）**: `createClient` + `notionSource`
  - preset の合成を 1 呼び出しに集約。メタパッケージ（node/cloudflare/next）を廃止し
    `./next` `./cloudflare` `./react` サブパスに統合（RFC: `history/rfc-v2-usability-redesign.md`）。
    _（v2 時点の記録。`client` は削除済み。「単一エントリ `createCMS`」という設計思想は
    `@notion-headless-cms/cms` の `createCMS` にそのまま引き継がれ、現行の唯一の入口になっている）_
- **content モード `"html"` / `"react"`**: 取得戦略と renderer を内部結線し不整合フットガンを排除。
  アクセサ型も mode で分岐し `notionBlocks()` を `NotionBlock[]`（react モード・非 undefined）に型付け。
  _（v2 時点の記録。v3 は本文を `EntrySnapshot.blocks` としてプレーンに返し、`html`/`react-renderer`
  のどちらで描画するかは呼び出し側が任意に選ぶ設計に変わったため、「content モード」という
  概念自体が無くなった）_
- **status 値の型安全**: `published` / `accessible` を schema の status options で型付け。
  _（v3 でも `defineCollection` の `published`/`accessible` が `statusProperty` の status options
  で型付けされる設計を踏襲している）_
- **取得戦略と subrequest 制限の指針**（P4 を content モードの選び方として明文化、
  `recipes/cloudflare-workers.md`）。_（v2 時点の記録）_

### 第 4 弾（react-renderer 拡張ポイント）

- **単一 Context 化**（#217）: `useNotionContext()` で prop drilling を解消。
- **URL 変換フック**（#218）: `resolveImageUrl` / `resolvePageUrl` / `resolvePageTitle` を第一級 API 化。
- **Image / Link の DOM 差替スロット**（#219）: `next/image` / `next/link` を注入可能に。
- **レスポンシブ画像**: `imageSizes` で proxy URL に `?w=` を付けた `srcSet` を自動生成。

### 第 5 弾（内部リンク解決）

- **Notion 内部リンクの slug 自動解決**（D6 / #356）: core に `buildPageIndex` /
  `createPageLinkResolver` / `normalizePageId` を追加。`cms` のコレクションを走査して
  pageId → {collection, slug, title} の逆引きインデックスを作り、`resolvePageUrl` /
  `resolvePageTitle` を生成する。react-renderer の page / database mention をフック対応にし、
  解決できればリンク化・できなければ従来表示へフォールバック。サーバで
  `const r = await createPageLinkResolver(cms)` を作り `<NotionRenderer {...r} />` で spread する。
  _（v2 時点の記録。API 名称は変わったが同種の内部リンク解決は v3 にも引き継がれている:
  `@notion-headless-cms/cms` の `sync/page-index.ts`（`buildPageIndex`）が同期時に
  pageId → {collection, slug} の逆引きインデックスを作り、`react-renderer` の
  `toPageLinkMap(entry.links)` がその結果を消費側に渡す形に置き換わった。URL 規約への
  マッピングはアプリ側の責務になった点が v2 との違い）_

## 提案（未実装）

### DX

#### D3. Remix 向け `./remix` エクスポート

- **課題**: 現状 `react-renderer/router` は React Router v7 のみ対応。Remix は再検証 API が異なる。
- **提案**: `@notion-headless-cms/react-renderer/remix` を追加し、共通ロジック
  (`src/internal/revalidate.ts`) を Remix の `useRevalidator` 差異に合わせて吸収する。
- **影響範囲**: `packages/react-renderer`。 **想定工数**: 中。 **リスク**: 低（追加エクスポート）。

#### D5. `nhc init --template` のフルファイル生成 → **解決済み**

- **課題（v2 時点）**: 当時の `--template` は `nhc.config.ts` と次ステップ案内まで。ルート/ハンドラ等は
  example をコピーする運用だった。
- **現状**: v3 の `nhc init` はランタイム別 `--template` の選択肢自体を廃止し、常に
  `nhc.config.ts`・`wrangler.toml`・`src/schema.ts`・Hono マウントコード一式
  （`src/lib/do.ts`・`src/lib/cms.ts`・`src/index.ts`）を生成する単一のフルスタック雛形に
  統一された（`examples/cloudflare-hono` と同じ配線。既存ファイルは上書きしない）。
  この提案が意図した「ルート・binding・エントリまで生成する」というゴールは実現済みのため、
  未実装の提案としては解消している。詳細は [CLI ツール](./cli.md) の `nhc init` の節を参照。

### 性能

#### P3. 画像の resize / format 変換（CDN 連携）

- **課題**: 同期時に画像を原寸保存する設計（`sync/notion-driver.ts` の画像解決処理）のため、
  LCP/転送量の最適化余地が残っている。
- **提案**: 配信時の幅・フォーマット変換、または Cloudflare Images 連携。
- **影響範囲**: `packages/cms/src/pipeline/resolve-images.ts` + `store/`。 **想定工数**: 大。 **リスク**: 中。
- （P4「取得戦略と並列度の指針」は第 3 弾で content モードの選び方として明文化済み。ただし
  この明文化自体は v2 の content モード概念に基づくもので、v3 では前提が変わっている点に注意）
