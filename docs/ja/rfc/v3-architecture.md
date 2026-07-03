---
title: v3 RFC（型とインターフェース）
description: v3 ゼロベース再設計（#437）の公開型・内部境界の確定
category: RFC
order: 1
---

# v3 RFC: 型とインターフェース

親issue: [#437](https://github.com/kjfsm/notion-headless-cms/issues/437)（v3 ゼロベース再設計エピック）。
本 RFC は [#438](https://github.com/kjfsm/notion-headless-cms/issues/438)（S1）で確定した型・内部境界を記録する。
実体（I/O・ランタイム配線）は S2 以降で実装する。作業場所は `packages/v3`（S10 でパッケージ統合するまでのステージング）。

## 利用者コード例

```ts
import { defineSchema, defineCollection, prop } from "@notion-headless-cms/v3";

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
  （`packages/v3/src/__tests__/json-value-assert.test.ts`）。関数・クラスインスタンスを含む型を
  `AssertJsonValue` に渡すとコンパイルエラーになる

## クエリ API の型

- `WhereInput<P>` はプロパティ型から演算子を導出する: `multiSelect` → `has`/`hasAny`/`hasAll`、
  `select`/`status` → `equals`/`in`、`date`/`createdTime` → `before`/`after`/`onOrBefore`/`onOrAfter`、
  `number` → `gt`/`gte`/`lt`/`lte`、text 系 → `contains`/`startsWith`
- `formula` / `rollup` / `relation` / `people` / `files` / `uniqueId` は S1 時点では演算子を持たない
  （`WhereInput` のキーから型レベルで除外される）。将来の拡張余地として残す
- 型に合わない演算子（例: `number` プロパティに `has`）はコンパイルエラーになる
  （`packages/v3/src/__tests__/query-operators.test.ts` で `@ts-expect-error` により固定）

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

## 公開面の設計（S10 で実施）

最終的に `@notion-headless-cms/v3` を正式な公開パッケージ名（サブパス構成含む）にリネームし、
`.` / `./react` / `./html` / `./cloudflare` / `./testing` のサブパス + 別パッケージの CLI に収束させる
（fixed versioning）。S1〜S9 の開発中は `packages/v3` に型・純関数・ストレージ・DO・ハンドラを積み上げ、
レンダリング（S8）は既存 `packages/react-renderer`、CLI（S9）は既存 `packages/cli` に機能追加する形で進める。

## 実装状況（S1〜S9 完了時点）

| サブissue | 内容 | 実装場所 |
|---|---|---|
| [#438](https://github.com/kjfsm/notion-headless-cms/issues/438) S1 | 型とインターフェース確定 | `packages/v3/src/types/`, `errors.ts`, `store.ts` 系 |
| [#439](https://github.com/kjfsm/notion-headless-cms/issues/439) S2 | コンテンツパイプライン純関数化 | `packages/v3/src/pipeline/` |
| [#440](https://github.com/kjfsm/notion-headless-cms/issues/440) S3 | ストレージ層 | `packages/v3/src/store/` |
| [#441](https://github.com/kjfsm/notion-headless-cms/issues/441) S4 | SyncCoordinator DO | `packages/v3/src/sync/` |
| [#442](https://github.com/kjfsm/notion-headless-cms/issues/442) S5 | 読者向けクエリ API | `packages/v3/src/query/` |
| [#443](https://github.com/kjfsm/notion-headless-cms/issues/443) S6 | HTTP ハンドラ統合 | `packages/v3/src/http/` |
| [#444](https://github.com/kjfsm/notion-headless-cms/issues/444) S7 | プレビューと編集者即時性 | `packages/v3/src/preview/` |
| [#445](https://github.com/kjfsm/notion-headless-cms/issues/445) S8 | レンダリング統合 | `packages/v3/src/render/`, `packages/react-renderer/src/v3.ts` |
| [#446](https://github.com/kjfsm/notion-headless-cms/issues/446) S9 | CLI 刷新 | `packages/cli/src/v3/` |
| [#447](https://github.com/kjfsm/notion-headless-cms/issues/447) S10 | E2E・移行検証・ドキュメント・リリース準備 | 本ドキュメント + `docs/ja/rfc/v3-status.md` |

型テスト・契約テスト・ユニットテストは各サブissueのコミットに含まれ、`pnpm build && pnpm typecheck && pnpm test`
がモノレポ全体（既存 v2 パッケージ含む）で green であることを都度確認しながら積み上げた。
未完了の項目・実サイト検証の状況は [`v3-status.md`](./v3-status.md) を参照。
