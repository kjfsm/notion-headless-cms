# @notion-headless-cms/client

## 0.3.7

### Patch Changes

- Updated dependencies [29040ac]
  - @notion-headless-cms/core@0.5.5
  - @notion-headless-cms/notion-source@0.2.6
  - @notion-headless-cms/cache@0.1.5
  - @notion-headless-cms/fetch-blocks@0.0.12
  - @notion-headless-cms/fetch-markdown@0.0.9

## 0.3.6

### Patch Changes

- 919ec7c: 要素（データ）コレクション `kind: "data"` を追加

  URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

  - ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
  - 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
  - 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
  - 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4
  - @notion-headless-cms/notion-source@0.2.5
  - @notion-headless-cms/cache@0.1.4
  - @notion-headless-cms/fetch-blocks@0.0.11
  - @notion-headless-cms/fetch-markdown@0.0.8

## 0.3.5

### Patch Changes

- 31e7f99: `createCMS` の `notion.onVerificationToken` コールバックを追加。webhook サブスク登録時に Notion が送る `verification_token` を受け取れるようにする。

## 0.3.4

### Patch Changes

- d713b6c: `createCMS` の `notion.onVerificationToken` コールバックを追加。webhook サブスク登録時に Notion が送る `verification_token` を受け取れるようにする。

## 0.3.3

### Patch Changes

- Updated dependencies [6e92cd2]
  - @notion-headless-cms/react-renderer@0.1.17
  - @notion-headless-cms/fetch-blocks@0.0.10

## 0.3.2

### Patch Changes

- 85a7cb6: Notion 公式 webhook（integration の Webhooks）受信によるキャッシュの自動ウォームを追加。`createCMS({ notion: { webhookSecret } })`（= `CreateClientOptions.notionWebhookSecret`）を設定すると、`cms.handler()` が `POST {basePath}/notion-webhook` を自動マウントし、`verification_token` 応答・`X-Notion-Signature` の HMAC-SHA256 署名検証・`entity.id`（page）→ slug 逆引きを行って、更新されたページだけをミラー再生成する。初回アクセスのコールドスタート遅延を「ページ更新時」に解消できる。

  あわせて公開 API を追加:

  - `cms.warmByPageId(pageId)` — Notion ページ ID を全コレクション横断で解決し単件ウォームする
  - `cms.<collection>.cache.prime(slug)` — 既存 `warm()` の単件版（1 件だけ取得して meta/content を作り直す）
  - `DataSource.findById?(pageId)` — notion-orm が `pages.retrieve` + parent data source 一致チェックで実装（他 DB のページ混入を防ぐ）

  `core` のゼロ依存は維持（HMAC はグローバル `crypto.subtle` を使用し import しない）。webhook の応答送信後もウォームを完走させるため、設定済みの `waitUntil` をバックグラウンド実行に利用する。

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3
  - @notion-headless-cms/cache@0.1.3
  - @notion-headless-cms/notion-source@0.2.4
  - @notion-headless-cms/fetch-blocks@0.0.9
  - @notion-headless-cms/fetch-markdown@0.0.7

## 0.3.1

### Patch Changes

- 5c6d7e6: `createCMS()` の引数をデータの流れ「取得 → 表現 → 永続化」に沿って 3 グループへ再編（破壊的変更）。`schema` / `token` / `collections` を `notion`、`content` / `ogp` を `render`、キャッシュ配線を `cache` に集約する。旧 `runtime` フィールドは廃止し、`cache` は `document` / `image` の役割別にアダプタ（`kvCache` / `r2Cache` / `memoryCache` / `nextCache`）を明示する形にした（`env` を丸ごと渡す不透明さを解消）。あわせて `client/cloudflare` から `kvCache` / `r2Cache`、`client/next` から `nextCache` を re-export し、explicit なキャッシュ構成を利用側から組み立てやすくする。（`imageProxyBase` は別途 `/api/cms/images` 固定化済みのため createCMS のオプションには含めない。）

## 0.3.0

### Minor Changes

- a2016b5: `createCMS` の `imageProxyBase` オプションを廃止し、`/api/cms/images` に固定する。`cms.handler()` の既定ルート（`{basePath}/images` = `/api/cms/images`）と常に一致するため、`api.cms.$.ts` に `cms.handler()` を 1 枚マウントすれば画像配信もまとめて賄える（cacheImage の書き込み先と handler の配信先がズレる設定ミスを排除）。

  破壊的変更: これまで `createCMS({ imageProxyBase })` を指定していた場合は型エラーになる。低レベルに調整したい場合は `createClient({ imageProxyBase })`（既定 `/api/images`）を使う。既定値も `/api/images` → `/api/cms/images` に変わるため、画像配信ルートは `/api/cms` 配下（`cms.handler()`）へ寄せること。

### Patch Changes

- Updated dependencies [a2016b5]
- Updated dependencies [d0c8f31]
- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2
  - @notion-headless-cms/react-renderer@0.1.16
  - @notion-headless-cms/cache@0.1.2
  - @notion-headless-cms/notion-source@0.2.3
  - @notion-headless-cms/fetch-blocks@0.0.8
  - @notion-headless-cms/fetch-markdown@0.0.6

## 0.2.3

### Patch Changes

- ef2c39c: createCMS に `ogp` オプションを追加し、`content: "react"` で OGP リンクプレビューを既定オンにする

  bookmark / link_preview / embed ブロックの OGP メタデータをサーバー側で取得してブロックに付与する（取得結果は既存のドキュメントキャッシュに同梱されるため追加のキャッシュ設定は不要）。OG 画像は既定で元 URL のまま流し、ブラウザが直接読み込む（R2 等への永続キャッシュなし）。`ogp: false` で無効化でき、`ogp: { enabled: true, imageCache }` を渡せば OG 画像の R2 永続化も選べる。`fetch-blocks` は利用側が型付きで設定を渡せるよう `FetchBlockTreeOgpOptions` を re-export する。

- Updated dependencies [ef2c39c]
  - @notion-headless-cms/fetch-blocks@0.0.7

## 0.2.2

### Patch Changes

- Updated dependencies [79be671]
  - @notion-headless-cms/react-renderer@0.1.15
  - @notion-headless-cms/fetch-blocks@0.0.6

## 0.2.1

### Patch Changes

- 86585a7: Notion 内部リンクの slug 自動解決を追加（#356 / D6）。

  - core に `buildPageLinkMap` / `buildPageIndex` / `normalizePageId` を追加。`cms` のコレクションを走査して `正規化pageId → { href, title }` のプレーンマップを構築する（ゼロ依存・純関数）。URL 既定は `/${collection}/${slug}`、`url` オプションで上書き可。`@notion-headless-cms/client` からも re-export。
  - react-renderer に `pageLinks` プロップを追加。`link_to_page` / page・database mention / `child_page` を `pageLinks` で自サイト URL に解決し、無ければ従来フォールバック。**プレーンオブジェクトのため React Router の loader 戻り値や RSC 境界を越えられる**（関数プロップ `resolvePageUrl` は越えられないため、内部リンクは `pageLinks` を推奨）。
  - `ResolvePageUrlFn` の戻り値を `string | undefined` に緩和（後方互換）。`resolvePageUrl` / `resolvePageTitle` 関数プロップはカスタムルーティング用の escape hatch として存続。

- Updated dependencies [86585a7]
  - @notion-headless-cms/core@0.5.1
  - @notion-headless-cms/react-renderer@0.1.14
  - @notion-headless-cms/cache@0.1.1
  - @notion-headless-cms/notion-source@0.2.2
  - @notion-headless-cms/fetch-blocks@0.0.5
  - @notion-headless-cms/fetch-markdown@0.0.5

## 0.2.0

### Minor Changes

- 2ba1214: **メジャーアップデート（破壊的変更）**: 使い勝手をコンセプトから再設計し、単一エントリ `@notion-headless-cms/client` に集約した（RFC: `docs/ja/rfc/v2-usability-redesign.md`）。

  - **単一エントリ `createCMS`**: `createClient` + `notionSource` + preset の 3 合成を 1 呼び出しに集約。`schema`(構造) と `token`/`content`/`collections`/`runtime`(振る舞い) を分離
  - **content モード**: `"html"` / `"react"` の単一決定で取得戦略と renderer を内部結線し、不整合フットガンを排除。アイテム本文アクセサ型も mode で分岐（`notionBlocks()` の `undefined` を型で排除）
  - **status 値の型安全**: `published` / `accessible` を schema の status options から literal union で型付け
  - **サブパス集約**: `./next`（`createNextHandler` / `nextPreset`）、`./cloudflare`（`cloudflarePreset` / `restKvCache`）、`./react`（`Renderer` / `NotionRevalidator`）
  - **単一インストール**: `@notionhq/client` / `zod` / `notion-to-md` を依存に取り込み `pnpm add @notion-headless-cms/client` だけで動く
  - **メタパッケージ廃止（破壊的）**: `@notion-headless-cms/node` / `@notion-headless-cms/cloudflare` / `@notion-headless-cms/next` を削除。`@notion-headless-cms/client` (+ サブパス) へ移行する
  - **CLI**: `nhc init` テンプレートを `createCMS` ベースに更新。公開ステータスは config から外し `createCMS({ collections })` 側へ

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [6478628]
- Updated dependencies [2d6b5b8]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0
  - @notion-headless-cms/cache@0.1.0
  - @notion-headless-cms/notion-source@0.2.1
  - @notion-headless-cms/react-renderer@0.1.13
  - @notion-headless-cms/fetch-blocks@0.0.4
  - @notion-headless-cms/fetch-markdown@0.0.4
