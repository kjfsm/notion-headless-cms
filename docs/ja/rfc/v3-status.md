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
`packages/v3` + `packages/cli` の v3 コマンド + `packages/react-renderer` の v3 アダプタ）で green。
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

## エラーコード一覧（v3 時点）

| コード | 発生条件 |
|---|---|
| `schema/status_property_required` | `published`/`accessible` を指定したが `statusProperty` が未指定、または `statusProperty` が status 型でない |
| `store/rest_request_failed` | REST 経由の KV/R2 アクセス（warm コマンド用）が失敗 |
| `store/rest_env_missing` | warm に必要な環境変数（`CLOUDFLARE_ACCOUNT_ID` 等）が未設定 |
| `handler/signature_invalid` | webhook の HMAC 署名検証失敗（`createFetchHandler` の HTTP レスポンスコード） |

各サブissueの実装が進むごとにコードを追加していく方針（`packages/v3/src/errors.ts` の
`BuiltInCMSErrorCode` を参照）。

## 既知のギャップ（この環境で完了できなかった項目）

以下は #447 の完了条件に含まれるが、この作業環境の制約により実施できていない。実際にリリースする前に
必ず対応すること。

1. **euphoric-band-site への実サイト移行検証** — 移行対象リポジトリがこの環境から参照できないため未実施。
   実際の移行時は本ドキュメントの移行例を起点に、loader の簡素化・WebSocket 手動配線の消滅・
   読者リクエスト中の Notion API 呼び出しゼロを実測で確認すること
2. **Cloudflare 無料プラン実環境での動作実測** — 実際の Workers/KV/R2/Durable Object へのデプロイが
   必要なため未実施。KV 書き込み回数/日・Alarm あたり subrequest 数・読者リクエストのレイテンシは
   実デプロイ後に記録すること（`nhc doctor` の diagnostics がこの記録の材料になる）
3. **examples の v3 刷新 + Playwright E2E** — 既存 `examples/cloudflare-*` は v2 API のままで、
   v3 API での書き直しと E2E 追加は未着手
4. **パッケージ統合の実施**（14 パッケージ → 1 パッケージ + サブパス + CLI、changesets fixed group 化、
   旧パッケージの deprecate 方針）— ユーザーからの指示により本イテレーションではスコープ外
   （`packages/v3` はステージング用の `private: true` パッケージのまま）
5. **CI への型テスト・契約テスト・miniflare E2E の統合** — `pnpm verify:ci` は `packages/v3` を含む
   モノレポ全体の build/typecheck/test を既に実行するが、`@cloudflare/vitest-pool-workers` を使った
   miniflare 実行環境（実 DO/KV/R2 挙動の検証）はこのリポジトリに未導入。追加する場合は
   `packages/cache` 同様、構造型フェイクによる単体テストとの役割分担を設計すること

## 次にやること

上記ギャップは実際の Cloudflare アカウント・対象サイトへのアクセスが前提のため、次のイテレーションで
（1）`packages/v3` を正式な公開パッケージへ改名・統合し、（2）examples を作り直し、（3）実サイトで
検証、の順で進めることを推奨する。
