---
title: v3 実装状況・移行ガイド・既知のギャップ
description: v3 ゼロベース再設計（#437）S10 時点の状況記録
category: RFC
order: 2
---

# v3 実装状況・移行ガイド・既知のギャップ

親issue: [#437](https://github.com/kjfsm/notion-headless-cms/issues/437)。本ドキュメントは
[#447](https://github.com/kjfsm/notion-headless-cms/issues/447)（S10）時点での状況を記録する。

## 完了している内容

S1〜S9（[#438](https://github.com/kjfsm/notion-headless-cms/issues/438)〜
[#446](https://github.com/kjfsm/notion-headless-cms/issues/446)）はすべて実装済みで、
`pnpm build && pnpm typecheck && pnpm test` がモノレポ全体（既存 v2 の 14 パッケージ + 新規
`packages/cms` + `packages/cli` の v3 コマンド + `packages/react-renderer` の v3 アダプタ）で green。
詳細は [`v3-architecture.md`](./v3-architecture.md) の実装状況表を参照。

## v2 → v3 移行例

v2 で摩擦だった「関数を剥がす儀式」がどう変わるかの対比。

### Before（v2）

```tsx
// loader
const post = await cms.posts.find(slug);
if (!post) throw new Response("Not Found", { status: 404 });
const blocks = await post.notionBlocks(); // 関数を剥がす
const pageLinks = await buildPageLinkMap(cms); // 毎 loader で手動呼び出し
const resolvedBlocks = await resolveBlockImageUrls(blocks, cms.cacheImage); // 同上
return { post, resolvedBlocks, pageLinks };

// コンポーネント
<NotionRenderer blocks={resolvedBlocks} pageLinks={pageLinks} />;
```

### After（v3）

```tsx
// loader — find() の戻り値は完全にプレーンな JSON。剥がす儀式は無い
const post = await cms.posts.find(slug);
if (!post) throw new Response("Not Found", { status: 404 });
return { post };

// コンポーネント — react-renderer の v3 アダプタで既存コンポーネントをそのまま再利用
import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/v3";

<NotionRenderer blocks={denormalizeBlocks(post.blocks)} pageLinks={toPageLinkMap(post.links)} />;
```

画像 URL・内部リンクは同期時（`resolveImageUrls` / `resolvePageLinks`、S2/S8）に解決済みのため、
`resolveBlockImageUrls` / `buildPageLinkMap` の手動呼び出しは不要になる。

## 不足機能の追加実装（数式・シンタックスハイライト・高度なHTML・マルチソース）

S1〜S10 の基盤の上に、以下 4 機能を追加した。

### 数式・シンタックスハイライト

- 既定は**ページアクセス時のクライアント側レンダリング**。`packages/react-renderer` の
  `Code.tsx`（shiki）・`Equation.tsx`/`InlineEquation.tsx`（katex、既存）が水和後に動的 import
  してレンダリングする。Worker の CPU 10ms/invocation 予算を消費しない
- オプトインで同期時に事前レンダーしたい場合は `packages/cms/src/transforms/{shiki,katex}.ts` の
  `createShikiTransform()` / `createKatexTransform()` を `createCMS({ transforms: [...] })` に渡す。
  `NormalizedBlock.data.__cachedHtml`（equation は inline も含む）に焼き込み、上記コンポーネントが
  それを最優先で使う。shiki/katex は動的 import + optional peerDependency（未インストール時は素通し）

### 高度な HTML（`packages/cms/src/render/html.ts` / `render/embeds.ts`）

- v2 `block-html` 相当のブロック網羅（table/column/synced/child/link_to_page/bookmark/embed/
  link_preview/video/audio/file/pdf/breadcrumb/table_of_contents）を追加
- **OGP 取得は同期時ではなくページアクセス時**。`render/embeds.ts` の `renderOgpShell()` は
  fetch せず `data-nhc-ogp-url` 属性つきのシェルのみ返す。実際の取得は
  `packages/cms/src/http/ogp.ts` の `createOgpHandler()`（`GET {routes}/ogp?url=...`）が担う
  （SSRF ガード・redirect 追跡・タイムアウト・本文サイズ上限・edge cache 用 `cache-control`）。
  React 側は `react-renderer` の `useOgp()` フックが同エンドポイントをクライアントから叩く
- embed の iframe 直埋め込みは YouTube（動画 ID 抽出のみ、fetch 不要）と `allowedEmbedHosts`
  allowlist に限定。それ以外は OGP シェルにフォールバックする

### マルチソース（複数コレクションの束ね）

- `packages/cms/src/sync/notion-driver.ts` の `createCollectionDriver()` が 1 コレクション分の
  Notion 同期（差分クエリ・block tree 取得・画像・transforms・プロパティ変換・内部リンク解決）を実装
- `packages/cms/src/sync/multi-source.ts` の `createMultiSourceDeps()` が複数 `CollectionDriver` を
  `SyncCoordinatorDeps`（`sync/coordinator.ts`、無改修）へ合成する。slug は `"{collection}:{slug}"`
  で名前空間化し、カーソルは `{ c: コレクション, nc: Notion カーソル }` を JSON 化して多重化する。
  単一コーディネータ + 合成 deps を採用（DO の Alarm は 1 つしか持てず、レートリミッタも
  全コレクションで厳密に共有する必要があるため）
- `packages/cms/src/sync/page-index.ts` の `buildPageIndex()` がスキーマ全体の index シャードから
  内部リンク解決用の `PageIndex` を読み取り専用で構築する（KV 書き込みゼロ）
- `packages/cms/src/cms/create-cms.ts` の `createCMS()` が schema の全コレクション分の driver・
  合成 deps・`SyncCoordinatorCore`・HTTP ハンドラ（webhook/images/ogp）・scheduled ハンドラを
  一括結線する利用者向けファクトリ

## エラーコード一覧（v3 時点）

| コード | 発生条件 |
|---|---|
| `schema/status_property_required` | `published`/`accessible` を指定したが `statusProperty` が未指定、または `statusProperty` が status 型でない |
| `schema/reserved_collection_name` | コレクション名が `sync`/`fetch`/`scheduled`/`stats` と衝突している（`createCMS`） |
| `schema/notion_config_missing` | `createCMS` の `notion.client` / `notion.token` のどちらも指定されていない |
| `store/rest_request_failed` | REST 経由の KV/R2 アクセス（warm コマンド用）が失敗 |
| `store/rest_env_missing` | warm に必要な環境変数（`CLOUDFLARE_ACCOUNT_ID` 等）が未設定 |
| `handler/signature_invalid` | webhook の HMAC 署名検証失敗（`createFetchHandler` の HTTP レスポンスコード） |
| `handler/ogp_url_forbidden` | OGP エンドポイントへの URL が SSRF ガード（プロトコル/ポート/プライベート IP 帯）に弾かれた |
| `handler/ogp_fetch_failed` | OGP エンドポイントの上流 fetch が失敗・タイムアウト・非 2xx |
| `sync/notion_query_failed` | Notion API 呼び出し（`dataSources.query`/`pages.retrieve`）が失敗、または対応ページが見つからない |
| `sync/slug_missing` | slug に使うプロパティ値が空で、代替の page id も解決できない |

各サブissueの実装が進むごとにコードを追加していく方針（`packages/cms/src/errors.ts` の
`BuiltInCMSErrorCode` を参照）。

## 既知のギャップ（この環境で完了できなかった項目）

以下は #447 の完了条件に含まれるが、この作業環境の制約により実施できていない。実際にリリースする前に
必ず対応すること。

1. **euphoric-band-site への実サイト移行検証** — 移行対象リポジトリがこの環境から参照できないため未実施。
   実際の移行時は本ドキュメントの移行例を起点に、loader の簡素化・WebSocket 手動配線の消滅・
   読者リクエスト中の Notion API 呼び出しゼロを実測で確認すること
2. **Cloudflare 無料プラン実環境での動作実測** — 実際の Workers/KV/R2/Durable Object へのデプロイが
   必要なため未実施。KV 書き込み回数/日・Alarm あたり subrequest 数・読者リクエストのレイテンシは
   実デプロイ後に記録すること（`nhc doctor` の diagnostics がこの記録の材料になる）。
   オプトインの shiki/katex TransformStage を使う場合は、コードブロック数の多いページで
   CPU 10ms/invocation を超過しないかも合わせて実測すること（既定のクライアント側レンダリングには
   このリスクは無い）
3. **examples の v3 刷新 + Playwright E2E** — 対応中。`examples/cloudflare-*` を含む7つを
   v3 API へ順次書き直している（進行状況は本ドキュメント末尾「パッケージ統合・examples刷新の進捗」参照）
4. **パッケージ統合の実施**（14 パッケージ → 1 パッケージ + サブパス + CLI、changesets fixed group 化、
   旧パッケージの deprecate 方針）— 対応済み。`packages/cms` を公開パッケージ `@notion-headless-cms/cms`
   へ改名・昇格した（exports: `.`/`./html`/`./cloudflare`/`./node`/`./testing`）。fixed group 化は
   不要と判断（各パッケージが独立バージョニングで運用されており、fixed group に入れる相手が
   実質存在しないため）。旧14パッケージは削除せず、examples 移行完了後に deprecated 表記を追加する方針
5. **CI への型テスト・契約テスト・miniflare E2E の統合** — `pnpm verify:ci` は `packages/cms` を含む
   モノレポ全体の build/typecheck/test を既に実行するが、`@cloudflare/vitest-pool-workers` を使った
   miniflare 実行環境（実 DO/KV/R2 挙動の検証）はこのリポジトリに未導入。追加する場合は
   `packages/cache` 同様、構造型フェイクによる単体テストとの役割分担を設計すること
6. **降順クエリ + version 一致打ち切りの理論的な取りこぼし** — `notion-driver.ts` の `listChanged`
   はページネーション中の編集や時計スキューを厳密には扱わない。webhook の再 kick と定期
   reconcile（削除検知のみ）で実運用上は回収されるが、reconcile 自体に「取りこぼした変更の
   再同期キュー投入」機能は無い。次イテレーションで reconcile を拡張するか検討すること
7. **`nhc doctor`/`nhc sync` の CLI 結線は未実施** — `nhc pull`/`nhc check` は
   `nhc.config.ts` の `v3` セクションから結線したが、doctor/sync はデプロイ先 Worker への
   到達性（binding 疎通・kick 経路）が絡むため、`packages/cms/src/http/index.ts` や
   `packages/cli/src/v3/{doctor,sync-command}.ts` の純ロジックのみ用意し CLI コマンド化は
   見送った
8. **`EntrySnapshot<Meta extends JsonValue>` の generic instantiation 制約** —
   `types/json-value.ts` に既知の制約として記載されている通り、index signature を持たない
   具体的なオブジェクト型を `EntrySnapshot<ConcreteType>` として直接インスタンス化しようとすると
   型チェックに失敗する。`createCMS` の `CollectionHandle<C>` はこれを避けるため
   `Omit<EntrySnapshot, "meta"> & { meta: InferEntry<C> }` という交差型で回避している
   （`packages/cms/src/cms/create-cms.ts` の `CollectionEntrySnapshot<C>` 参照）。将来
   `EntrySnapshot` の generic 境界を見直す場合はこの回避策も合わせて整理すること
9. **`IndexEntry.meta` は「縮小版」ではなく全プロパティを格納する簡略化** — RFC の設計時点では
   「where/sort に必要な最小限のメタのみ」を想定していたが、事前にどのプロパティが使われるか
   判別できないため `notion-driver.ts` は `EntrySnapshot.meta` と同じ内容をそのまま
   `IndexEntry.meta` にも格納している。KV のサイズ予算が問題になった場合は projection の
   導入を検討すること

## 次にやること

`packages/cms` への改名・統合（ギャップ4）は完了した。残るギャップ1・2・5〜9は実際の
Cloudflare アカウント・対象サイトへのアクセスが前提のため、examples 刷新（ギャップ3、進行中）の
完了後に着手することを推奨する。
