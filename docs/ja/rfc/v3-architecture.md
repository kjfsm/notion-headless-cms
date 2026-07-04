---
title: v3 RFC（型とインターフェース）
description: v3 ゼロベース再設計（#437）の公開型・内部境界の確定
category: RFC
order: 1
---

# v3 RFC: 型とインターフェース

親issue: [#437](https://github.com/kjfsm/notion-headless-cms/issues/437)（v3 ゼロベース再設計エピック）。
本 RFC は [#438](https://github.com/kjfsm/notion-headless-cms/issues/438)（S1）で確定した型・内部境界を記録する。
実体（I/O・ランタイム配線）は S2 以降で実装する。実装場所は `packages/cms`（公開パッケージ `@notion-headless-cms/cms`。S10 時点では `packages/v3` という private なステージングパッケージだったが、パッケージ統合イテレーションで昇格・改名した）。

## 利用者コード例

```ts
import { defineSchema, defineCollection, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["draft", "published"] as const),
    tags: prop.multiSelect(),
    publishedAt: prop.date(),
  },
  statusProperty: "status",
  published: ["published"],
  accessible: ["draft", "published"],
});

export const schema = defineSchema({ posts });

// loader（React Router / Next.js 等）
const post = await cms.posts.find(slug);
return { post }; // JSON.stringify 可能なプレーンデータのみ。関数を剥がす儀式は無い
```

## スキーマ定義（`defineSchema` / `defineCollection` / `prop`）

- `prop.*` ビルダーが全 Notion プロパティ型を網羅する: `title` / `richText` / `select` / `status` / `multiSelect` /
  `date` / `number` / `checkbox` / `url`（v2 の 9 種）に加え、`formula` / `rollup` / `relation` / `people` /
  `files` / `uniqueId` / `createdTime` / `lastEditedBy` を追加した
- 未対応のプロパティ型は将来 `UnsupportedValue`（`{ type: "unsupported", raw }`）として型に現れる（黙ってスキップしない）
- `status` プロパティの `options` は `as const` 配列で渡すことでリテラル型に補完される
- `published` / `accessible` を指定する場合は `statusProperty` の指定が必須。指定なしで両者を渡すと
  `defineCollection` が `CMSError("schema/status_property_required")` を投げる
  （v2 の `publishedStatuses` dead option の再発防止 — 「設定が黙って無視される経路を作らない」）

## `EntrySnapshot` / `CollectionIndex`

- `EntrySnapshot`: R2 に保存するエントリ本体。`meta`（プロパティ値）+ `blocks`（正規化 block tree）+
  `images`（hash → width/height/contentType）+ `links`（解決済み内部リンク）+ `version`（`last_edited_time`）
- `CollectionIndex`: KV に保存する軽量な一覧メタ。`IndexEntry` は `slug` / `version` / `listed` / 縮小版 `meta` のみ
- 両者とも `AssertJsonValue<T>` で JSON シリアライズ可能性を型テストとして固定する
  （`packages/cms/src/__tests__/json-value-assert.test.ts`）。関数・クラスインスタンスを含む型を
  `AssertJsonValue` に渡すとコンパイルエラーになる

## クエリ API の型

- `WhereInput<P>` はプロパティ型から演算子を導出する: `multiSelect` → `has`/`hasAny`/`hasAll`、
  `select`/`status` → `equals`/`in`、`date`/`createdTime` → `before`/`after`/`onOrBefore`/`onOrAfter`、
  `number` → `gt`/`gte`/`lt`/`lte`、text 系 → `contains`/`startsWith`
- `formula` / `rollup` / `relation` / `people` / `files` / `uniqueId` は S1 時点では演算子を持たない
  （`WhereInput` のキーから型レベルで除外される）。将来の拡張余地として残す
- 型に合わない演算子（例: `number` プロパティに `has`）はコンパイルエラーになる
  （`packages/cms/src/__tests__/query-operators.test.ts` で `@ts-expect-error` により固定）

## 内部境界インターフェース

| インターフェース | 役割 | Cloudflare 実装 | Node 実装 |
|---|---|---|---|
| `DocStore` | index の読み書き | KV | in-memory / file |
| `BlobStore` | entry 本体・画像の読み書き | R2 | in-memory / file |
| `SyncScheduler` | Notion アクセス直列化・遅延実行・永続状態 | Durable Object | in-process mutex + setTimeout |
| `RealtimeAdapter` | 同期完了の push 通知 | Durable Object (WebSocket) | no-op |
| `ImagePipeline` | 画像処理の拡張点（既定は寸法パースのみ） | 同一実装 | 同一実装 |

すべて構造型（`@cloudflare/workers-types` に実依存しない）。v2 の `KVNamespaceLike` / `R2BucketLike` パターンを継承する。

## エラー体系

`CMSError`（`<namespace>/<kind>` 二段式）を v2 から継承し、名前空間を新アーキテクチャの層に合わせて再編する:
`schema/` `query/` `store/` `sync/` `pipeline/` `handler/` `preview/` `render/` `cli/`。各サブissueの実装が進むごとに
コードを追加する（S1 時点は `schema/status_property_required` 等の最小セットのみ）。

## 公開面の設計（パッケージ統合イテレーションで実施済み）

`@notion-headless-cms/cms` を正式な公開パッケージ名とし、`.` / `./html` / `./cloudflare` / `./node` /
`./testing` のサブパスに収束させた。**`./react` は追加しない** — React 向けアダプタ（`denormalizeBlocks`/
`toPageLinkMap`）は独立パッケージ `packages/react-renderer` の `./v3` サブパスとして実装済みで、
依存の向きは `react-renderer → cms`（`workspace:*`）。`cms` パッケージ側に `./react` を追加すると
`react-renderer → cms → react-renderer` の循環依存になるため、当初の想定から意図的に外した。
レンダリング（S8）は既存 `packages/react-renderer`、CLI（S9）は既存 `packages/cli` に機能追加する形で進めた。
fixed versioning は採用していない（他パッケージも独立バージョニングで運用されており、fixed group に
入れる相手が実質存在しないため）。

## 実装状況（S1〜S9 完了時点）

| サブissue | 内容 | 実装場所 |
|---|---|---|
| [#438](https://github.com/kjfsm/notion-headless-cms/issues/438) S1 | 型とインターフェース確定 | `packages/cms/src/types/`, `errors.ts`, `store.ts` 系 |
| [#439](https://github.com/kjfsm/notion-headless-cms/issues/439) S2 | コンテンツパイプライン純関数化 | `packages/cms/src/pipeline/` |
| [#440](https://github.com/kjfsm/notion-headless-cms/issues/440) S3 | ストレージ層 | `packages/cms/src/store/` |
| [#441](https://github.com/kjfsm/notion-headless-cms/issues/441) S4 | SyncCoordinator DO | `packages/cms/src/sync/` |
| [#442](https://github.com/kjfsm/notion-headless-cms/issues/442) S5 | 読者向けクエリ API | `packages/cms/src/query/` |
| [#443](https://github.com/kjfsm/notion-headless-cms/issues/443) S6 | HTTP ハンドラ統合 | `packages/cms/src/http/` |
| [#444](https://github.com/kjfsm/notion-headless-cms/issues/444) S7 | プレビューと編集者即時性 | `packages/cms/src/preview/` |
| [#445](https://github.com/kjfsm/notion-headless-cms/issues/445) S8 | レンダリング統合 | `packages/cms/src/render/`, `packages/react-renderer/src/v3.ts` |
| [#446](https://github.com/kjfsm/notion-headless-cms/issues/446) S9 | CLI 刷新 | `packages/cli/src/v3/` |
| [#447](https://github.com/kjfsm/notion-headless-cms/issues/447) S10 | E2E・移行検証・ドキュメント・リリース準備 | 本ドキュメント + `docs/ja/rfc/v3-status.md` |

型テスト・契約テスト・ユニットテストは各サブissueのコミットに含まれ、`pnpm build && pnpm typecheck && pnpm test`
がモノレポ全体（既存 v2 パッケージ含む）で green であることを都度確認しながら積み上げた。
未完了の項目・実サイト検証の状況は [`v3-status.md`](./v3-status.md) を参照。

## 不足機能の追加設計（数式・シンタックスハイライト・高度なHTML・マルチソース）

S1〜S10 の基盤が用意した契約（`TransformStage`・`render/html.ts`・`SyncCoordinatorDeps`）に対する
実装を追加した。詳細な既知の制約・エラーコード一覧は [`v3-status.md`](./v3-status.md) を参照。

### createCMS ファクトリ

`packages/cms/src/cms/create-cms.ts` の `createCMS()` が利用者向けの唯一のエントリになる。

```ts
const cms = createCMS({
  schema,
  notion: { client } /* または { token } */,
  stores: { docs, blobs, versionedCache? },
  scheduler,
  transforms: [createShikiTransform(), createKatexTransform()], // オプトイン
  routes: "/api/cms",
  webhookSecret,
  ogp: { allowUrl? } /* false で無効化 */,
});

cms.posts.find(slug);            // EntrySnapshot<InferEntry<Posts>> | null
cms.posts.list({ where, sort }); // 型付き where/sort
cms.sync.kick();                 // 初回同期・CLI からの手動 kick
cms.fetch(request);              // images/webhook/ogp/realtime/preview を一括処理
cms.scheduled();                 // Cron Trigger からの定期リコンサイル
```

schema の全コレクション分の `CollectionDriver`（後述）を生成し、`createMultiSourceDeps` →
`SyncCoordinatorCore` → `createFetchHandler` まで一括結線する。コレクション名が
`sync`/`fetch`/`scheduled`/`stats` と衝突する場合は `CMSError("schema/reserved_collection_name")`
を投げる。

### マルチソース同期（Notion ドライバ + 合成レイヤ）

- `packages/cms/src/sync/notion-driver.ts` の `createCollectionDriver()` が 1 コレクション分の
  `SyncCoordinatorDeps` 実装（`listChanged`/`listAllSlugs`/`listIndexedSlugs`/`syncEntry`/
  `removeEntry`）を提供する。`listChanged` は `dataSources.query` を `last_edited_time` **降順**で
  クエリし、ページの `last_edited_time` が KV index の `version` と一致した時点で打ち切る
  （永続 watermark 不要 = 差分検知のための追加 KV 書き込みがゼロ）
- `listChanged` で取得した `PageObjectResponse` は同一チャンク内だけ有効な in-memory キャッシュに
  保持し、直後の `syncEntry` が追加の Notion 呼び出し無しで使う（coordinator は同一 `runChunk()`
  内で `listChanged` 直後に `syncEntry` を呼ぶため安全）
- `packages/cms/src/sync/multi-source.ts` の `createMultiSourceDeps()` が複数 `CollectionDriver` を
  単一の `SyncCoordinatorDeps` へ合成する。**`sync/coordinator.ts` は無改修**:
  - slug は `"{collection}:{slug}"` で名前空間化する
  - カーソルは `{ c: 現在のコレクション, nc: Notion カーソル }` を JSON 化して多重化する。
    現在のコレクションが尽きたら同一呼び出し内で次のコレクションへ遷移する
    （chunked sync の `limit` はコレクション横断の総量）
  - 設計判断: DO は Alarm を 1 つしか持てず `SyncScheduler.schedule` は「既存予約を置き換える」
    契約のため、コレクションごとに独立したコーディネータを立てると予約を潰し合う。単一
    コーディネータ + 合成 deps ならレートリミッタ（3req/s）も全コレクションで厳密に共有できる
- `packages/cms/src/sync/page-index.ts` の `buildPageIndex()` がスキーマ全体の index シャードから
  内部リンク解決用の `PageIndex` を読み取り専用で構築する（`kind === "title"` のプロパティを
  各コレクションのスキーマから検出して `title` を埋める）

### シンタックスハイライト・数式（TransformStage 実装）

既定は **ページアクセス時のクライアント側レンダリング**（Worker の CPU 10ms/invocation を
消費しない）。`packages/react-renderer` の `Code.tsx`/`Equation.tsx`/`InlineEquation.tsx` が
水和後に shiki/katex を動的 import する。

オプトインで同期時の事前レンダーを使いたい場合は `packages/cms/src/transforms/{shiki,katex}.ts`
の `createShikiTransform()`/`createKatexTransform()` を `createCMS({ transforms })` に渡す。
`NormalizedBlock.data.__cachedHtml`（block/inline 双方）に焼き込み、react-renderer 側のコンポーネントは
`__cachedHtml` があれば最優先で使う 3 段フォールバック構成になっている:
`__cachedHtml` → クライアント動的 import → 素の `<pre>`/テキスト。

shiki/katex は `packages/cms` の optional peerDependency + 動的 import（未インストール・失敗時は
blocks を素通し）。既存の公開パッケージ `notion-shiki`/`notion-katex` は private な `packages/cms`
に依存できないため、実装は `packages/cms` 内に自己完結させた。

### 高度な HTML レンダラ（`render/html.ts` / `render/embeds.ts`）

v2 `block-html` 相当のブロック網羅（table/column/synced/child/link_to_page/bookmark/embed/
link_preview/video/audio/file/pdf/breadcrumb/table_of_contents）を追加した。

OGP リンクカード（bookmark/embed/link_preview）は **同期時に fetch しない**。
`render/embeds.ts` の `renderOgpShell()` は `data-nhc-ogp-url` 属性つきのシェル（ホスト名 + URL の
シンプルなリンクカード）のみを返す。実際の OGP メタデータ取得はページアクセス時に
`packages/cms/src/http/ogp.ts` の `createOgpHandler()`（`GET {routes}/ogp?url=...`）が行う:

- SSRF ガード: http/https + 標準ポートのみ、localhost・プライベート/リンクローカル IP 帯を拒否。
  redirect は最大 3 hop まで各 hop で再検証しながら追跡する
- レスポンス本文はストリームから `maxBodyBytes` で打ち切って読む（全量バッファしない）
- キャッシュは構造型 `OgpCache`（既定は呼ばない = KV は使わない。読者経路の KV 書き込み予算
  1,000/日を守るため）。`cache-control: public, max-age=` で edge cache に乗せる
- React 側は `react-renderer` の `useOgp()` フックが `NotionRenderer` の `ogpEndpoint` prop 経由で
  同エンドポイントをクライアントから叩き、`block.ogp`（同期時付与）が無い場合のみ hydration する

embed の iframe 直埋め込みは YouTube（動画 ID を URL から抽出するのみ、fetch 不要）と
`allowedEmbedHosts` allowlist に一致するホストに限定する。allowlist に無いホストは iframe を
生成せず OGP シェルにフォールバックする（v2 の `rehype-sanitize-embeds` 相当のポリシーを
「そもそも許可されていない iframe を生成しない」形で実現）。
