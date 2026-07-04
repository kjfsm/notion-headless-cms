# @notion-headless-cms/cli

## 3.0.0

### Patch Changes

- 2a37266: v3 ゼロベース再設計（#437）の基盤を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

  - `react-renderer`: `./v3` サブパスを追加。`denormalizeBlocks` が v3 の正規化 block（`NormalizedBlock`）を既存の `BlockObjectResponse` 形状へ復元するため、既存のブロックコンポーネント約30種を無改修のまま再利用できる。`toPageLinkMap` で `EntrySnapshot.links` を既存の `pageLinks` プロップ形式に変換する。`Image` コンポーネントは任意の `_dimensions`（v3 パイプラインが焼き込む width/height）があれば付与する CLS 対応を追加（無ければ従来どおり）
  - `cli`: `packages/cli/src/v3/` に pull（スキーマ雛形生成）・check（drift 検証）・doctor（診断）・sync（手動 kick）・init（wrangler 設定雛形）のロジックを追加。既存の `generate`/`init` コマンドとは独立

  `packages/v3` 自体は非公開（`private: true`）のステージングパッケージで、公開パッケージへの統合は別途行う。

- d030538: v3（#437）に不足していた数式・シンタックスハイライト・高度なHTML・マルチソースの実装を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

  - `react-renderer`: `Code.tsx` にクライアント遅延 shiki ハイライトを追加（`__cachedHtml` が無い場合、水和後に動的 import してハイライトする。既定はページアクセス時のレンダリングで Worker の CPU 予算を消費しない）。`InlineEquation`/`RichText` が同期時に事前組版された数式 `__cachedHtml` を受け取れるようにした。`Bookmark`/`LinkPreview` に `useOgp` フックを追加し、`block.ogp` が無い場合に `NotionRenderer` の `ogpEndpoint` 経由でページアクセス時に OGP メタデータを取得できるようにした
  - `cli`: `nhc.config.ts` に `v3` セクションを追加し、`nhc pull`（Notion DB introspect → `defineCollection` 雛形生成、既存ファイルは上書きしない）と `nhc check`（TS スキーマと実 DB の drift 検証、CI 向け）を新設した

  `packages/v3` 側の主な追加（非公開のため changeset 対象外）:
  - `transforms/{shiki,katex}.ts`: 同期時の事前レンダー用 TransformStage（オプトイン）
  - `render/{html,embeds}.ts` 拡張: table/column/synced/child/bookmark/embed/link_preview/video/audio/file/pdf 等の HTML 出力、OGP はシェルのみ返しページアクセス時に取得する設計
  - `http/ogp.ts`: OGP エンドポイント（SSRF ガード・redirect 追跡・edge cache 対応）
  - `sync/{notion-driver,multi-source,page-index}.ts`: 複数コレクション（複数 data_source_id）を単一の同期エンジンで束ねるマルチソース実装
  - `cms/create-cms.ts`: schema からドライバ・同期・HTTP ハンドラを一括結線する `createCMS()` ファクトリ

- 88bf886: `packages/v3`（非公開ステージングパッケージ）を正式な公開パッケージ `@notion-headless-cms/cms` へ昇格した（パッケージ統合、#437 S10 の積み残し）。

  - `@notion-headless-cms/cms`: `packages/v3` から改名・公開。exports を `.` / `./html`（HTML 文字列レンダラ）/ `./cloudflare`（`kvDocStore`/`r2BlobStore`）/ `./node`（`fileDocStore`/`fileBlobStore`）/ `./testing`（契約テストユーティリティ）に再編し、`publint`/`attw`/`release:local` を追加した。初回公開のためこの changeset ではバージョンを管理しない（`package.json` の `0.1.0` がそのまま初版になる）
  - `react-renderer`/`cli`: `@notion-headless-cms/v3` への依存を `@notion-headless-cms/cms` に更新（パッケージ名変更に追随するのみ、挙動に変更なし）

  `packages/v3/src/render/index.ts` は `./html` サブパス新設に伴い到達不能になったため削除した。RFC（`docs/ja/rfc/v3-architecture.md`）記載の `./react` サブパスは追加しない — 該当機能は `react-renderer` の既存 `./v3` サブパスで提供済みで、`cms` 側に追加すると循環依存になるため。

- c89d8c0: スキーマのプロパティキーと実際の Notion プロパティ名が食い違う場合に値が取得できなかった不具合を修正した。

  - `@notion-headless-cms/cms`: `prop.*()` ビルダーが末尾引数で実際の Notion プロパティ名を受け取れるようになった（例: `prop.title("名前")`）。`mapProperties()`・`notion-driver.ts` の `slugOf()`/`statusOf()` がこの別名で `raw` プロパティを解決するよう修正
  - `@notion-headless-cms/cli`: `nhc.config.ts` の `v3.collections[].fieldMappings` を追加。`nhc pull` が明示マッピングまたは自動フォールバック識別子に対して `notion` 別名を生成コードへ埋め込むようになり、`nhc check` も同じ解決順で drift を照合する

- a4110f4: `nhc pull`/`nhc check`（v3）で日本語などの非 ASCII のみのプロパティ名が識別子生成時に
  すべて `unnamed` へ潰れて衝突していたバグを修正した。

  - プロパティ種別ベースの識別子（`unnamedTitle`/`unnamedStatus` 等）+ 連番へフォールバックし、
    同名衝突を避けるようにした（`packages/cli/src/v3/identifier.ts` に新設）
  - `nhc pull` が生成するコードには、フォールバックした場合のみ元のプロパティ名を
    JSDoc コメントとして残すようにした
  - `nhc pull`/`nhc check` で重複していた識別子変換ロジックを共通化した

- f607b31: v3ゼロベース再設計（#437）のコードレビューで検出した問題を修正。

  - `react-renderer`: README に `./v3` サブパス（`denormalizeBlocks`/`toPageLinkMap`）の使い方セクションを追加
  - `cli`: README に `nhc pull`/`nhc check`（v3 スキーマ drift 検証）のセクションを追加

  `packages/v3`（非公開）側の修正（video ブロックの `sanitizeHref` 適用漏れ、`multi-source.ts` の生 `Error` throw を `CMSError` 化、`listEntries` の `limit` 負数サニタイズ、REST ストアの契約テスト追加等）は非公開パッケージのため changeset 対象外。

- Updated dependencies [569ce76]
- Updated dependencies [aab824b]
- Updated dependencies [427641c]
- Updated dependencies [a5c23f3]
- Updated dependencies [c89d8c0]
- Updated dependencies [3b29159]
- Updated dependencies [1b24228]
- Updated dependencies
  - @notion-headless-cms/cms@0.1.1
  - @notion-headless-cms/core@1.0.0
  - @notion-headless-cms/validate@1.0.0

## 2.0.16

### Patch Changes

- Updated dependencies [0dbc727]
  - @notion-headless-cms/core@0.5.14
  - @notion-headless-cms/validate@0.1.16

## 2.0.15

### Patch Changes

- 1e3db3b: コード生成のフォールバックフィールド型を BaseContentItem と一致させる

  `status` と `publishedAt` のフォールバック型が `string` だったが、`BaseContentItem` は `string | null` を許容するため型不整合が生じていた。また `isInTrash` が生成インターフェースに含まれていなかった。

## 2.0.14

### Patch Changes

- Updated dependencies [a3b567f]
  - @notion-headless-cms/core@0.5.13
  - @notion-headless-cms/validate@0.1.15

## 2.0.13

### Patch Changes

- Updated dependencies [bd05d42]
  - @notion-headless-cms/core@0.5.12
  - @notion-headless-cms/validate@0.1.14

## 2.0.12

### Patch Changes

- Updated dependencies [5dab6df]
  - @notion-headless-cms/core@0.5.11
  - @notion-headless-cms/validate@0.1.13

## 2.0.11

### Patch Changes

- Updated dependencies [127f482]
  - @notion-headless-cms/core@0.5.10
  - @notion-headless-cms/validate@0.1.12

## 2.0.10

### Patch Changes

- Updated dependencies [8b11e1c]
  - @notion-headless-cms/core@0.5.9
  - @notion-headless-cms/validate@0.1.11

## 2.0.9

### Patch Changes

- Updated dependencies [4303b7b]
  - @notion-headless-cms/core@0.5.8
  - @notion-headless-cms/validate@0.1.10

## 2.0.8

### Patch Changes

- Updated dependencies [4d81ddb]
  - @notion-headless-cms/core@0.5.7
  - @notion-headless-cms/validate@0.1.9

## 2.0.7

### Patch Changes

- 7097371: `cms.<collection>.dbName` を DB 名を埋め込んだプロパティから、実行時に Notion API で取得する非同期メソッド `getDbName(): Promise<string | undefined>` に変更（破壊的変更）。

  - `nhc generate` は schema に `dbName` を埋め込まなくなった。`cms.<collection>.getDbName()` は初回呼び出しで `data_source` を retrieve して表示名を解決し、以降はキャッシュした値を返す。
  - 手書き schema で `dbName` を明示した場合はその値を返し、API を叩かない。
  - `DataSource` インターフェースに任意メソッド `getDbName?(): Promise<string | undefined>` を追加。core はこれに委譲し、未実装なら `undefined` を返す。
  - `CollectionDef.dbName` を廃止（DB 名は DataSource 側で解決する）。

- Updated dependencies [7097371]
  - @notion-headless-cms/core@0.5.6
  - @notion-headless-cms/validate@0.1.8

## 2.0.6

### Patch Changes

- 29040ac: コレクションから Notion DB の表示名を参照できる `cms.<collection>.dbName` を追加。`nhc generate` が introspect 時に取得した DB 名を schema に埋め込み、ページ・要素（`kind: "data"`）の両コレクションで参照できる。手書き schema で `dbName` を省略した場合は `undefined`。
- Updated dependencies [29040ac]
  - @notion-headless-cms/core@0.5.5
  - @notion-headless-cms/validate@0.1.7

## 2.0.5

### Patch Changes

- 8ded45d: 依存関係を更新: `commander` を v14 から v15 に上げた（CLI は ESM only・Node 24+ のため互換）。あわせて開発・CI 依存（biome / vitest / turbo / knip / shadcn / tsdown / @types/node / hono catalog）と GitHub Actions（codecov-action v7 / upload-artifact v7）を更新し、ws をセキュリティ修正済みの 8.20.1 以上へ override で底上げした。

## 2.0.4

### Patch Changes

- 919ec7c: 要素（データ）コレクション `kind: "data"` を追加

  URL ルーティングしない単純なデータ（設定値一覧・選択肢リストなど）を、ページとは別概念のコレクションとして扱えるようにした。`nhc.config.ts` のコレクションに `kind: "data"` を指定すると、slug を持たない `list()` / `get(id)` / `cache.invalidate()` のみのクライアントになり、Notion DB に URL 用の slug プロパティを用意する必要がなくなる。

  - ページコレクション（既定 `kind: "page"`）は従来どおり `find(slug)` / `params()` / 本文レンダリングを持つ。
  - 要素コレクションのアイテム型からは `slug` が除去され、`find` / `params` の呼び出しはコンパイルエラーになる。
  - 内部 identity は `slug ?? id` に統一。既存ページのキャッシュキーは slug のまま不変（キャッシュ移行なし）。`BaseContentItem.slug` は optional 化したが、ページコレクションのアイテム型は従来どおり `slug: string`。
  - 以前は slug を持たないコレクションで `cms.xxx.list()` が「Notion ページのスラグが空です」で落ちていた問題を解消。

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4
  - @notion-headless-cms/validate@0.1.6

## 2.0.3

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3
  - @notion-headless-cms/validate@0.1.5

## 2.0.2

### Patch Changes

- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2
  - @notion-headless-cms/validate@0.1.4

## 2.0.1

### Patch Changes

- Updated dependencies [86585a7]
  - @notion-headless-cms/core@0.5.1
  - @notion-headless-cms/validate@0.1.3

## 2.0.0

### Major Changes

- 2ba1214: **メジャーアップデート（破壊的変更）**: 使い勝手をコンセプトから再設計し、単一エントリ `@notion-headless-cms/client` に集約した（RFC: `docs/ja/rfc/v2-usability-redesign.md`）。

  - **単一エントリ `createCMS`**: `createClient` + `notionSource` + preset の 3 合成を 1 呼び出しに集約。`schema`(構造) と `token`/`content`/`collections`/`runtime`(振る舞い) を分離
  - **content モード**: `"html"` / `"react"` の単一決定で取得戦略と renderer を内部結線し、不整合フットガンを排除。アイテム本文アクセサ型も mode で分岐（`notionBlocks()` の `undefined` を型で排除）
  - **status 値の型安全**: `published` / `accessible` を schema の status options から literal union で型付け
  - **サブパス集約**: `./next`（`createNextHandler` / `nextPreset`）、`./cloudflare`（`cloudflarePreset` / `restKvCache`）、`./react`（`Renderer` / `NotionRevalidator`）
  - **単一インストール**: `@notionhq/client` / `zod` / `notion-to-md` を依存に取り込み `pnpm add @notion-headless-cms/client` だけで動く
  - **メタパッケージ廃止（破壊的）**: `@notion-headless-cms/node` / `@notion-headless-cms/cloudflare` / `@notion-headless-cms/next` を削除。`@notion-headless-cms/client` (+ サブパス) へ移行する
  - **CLI**: `nhc init` テンプレートを `createCMS` ベースに更新。公開ステータスは config から外し `createCMS({ collections })` 側へ

### Patch Changes

- 6478628: `nhc init --template <name>` を追加。`node` / `cloudflare-react-router` / `cloudflare-hono` / `next` を選ぶと、ランタイムに合った `output` パスと「次のステップ」(追加すべき依存・binding・対応する example への導線) を出力する。未指定時の挙動 (`node` 相当) は従来どおり。
- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0
  - @notion-headless-cms/validate@0.1.2

## 1.1.0

### Minor Changes

- c55a06a: DX とドキュメント差分の解消 (Issue #332)

  - **core**: 組み込みエラーコード 27 種類すべてに `docsUrl` (docs/ja/errors/index.md へのアンカー) と `nextSteps` の既定値を `CMSError` コンストラクタで自動補完するように。呼び出し側で明示指定した値は引き続き優先される
  - **cli**: `nhc generate` / `nhc init` に `--verbose` / `--debug` フラグを追加。verbose 時は CMSError の `nextSteps` / `docsUrl` を、debug 時はスタックトレースと cause を出力。help に「よくある詰まり所」セクションを追加し、進捗表示も拡充
  - **testing**: 新規パッケージ `@notion-headless-cms/testing` を公開。`createFakeNotionSource({ items })` / `createFakeCache()` / `createFixtureClient(opts)` / `fakeRenderer` を提供。`@notion-headless-cms/core` 以外への依存ゼロ

### Patch Changes

- d414823: M1: zod 検証パッケージ `@notion-headless-cms/validate` を新設 (Issue #333)

  - 新規パッケージ `@notion-headless-cms/validate` を opt-in で公開
    - `validateCreateClientOptions(opts)` — `createClient({...})` の引数を実行時検証
    - `validateNotionSourceConfig(opts)` — `notionSource({...})` の引数を実行時検証
    - `validateCMSConfig(config)` — `nhc.config.ts` の `defineConfig()` 戻り値を検証
  - いずれも失敗時は `CMSError(code: "core/schema_invalid")` を投げ、不正フィールド名と原因をまとめて表示する
  - `packages/core` には zod の依存を追加しない (ゼロ依存ルールの維持)
  - CLI の `loadConfig()` を zod 化し、`output` / `collections[*].databaseId|dbName` などの不足をフィールド単位で報告する

- Updated dependencies [c55a06a]
- Updated dependencies [d414823]
- Updated dependencies [8e73f8e]
- Updated dependencies [64b7d32]
- Updated dependencies [e2c8bee]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0
  - @notion-headless-cms/validate@0.1.1

## 1.0.35

### Patch Changes

- Updated dependencies [f6af509]
  - @notion-headless-cms/core@0.3.25

## 1.0.34

### Patch Changes

- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）
- Updated dependencies [f7fd36a]
  - @notion-headless-cms/core@0.3.24

## 1.0.33

### Patch Changes

- Updated dependencies [7f2668a]
  - @notion-headless-cms/core@0.3.23

## 1.0.32

### Patch Changes

- Updated dependencies [700ca69]
  - @notion-headless-cms/core@0.3.22

## 1.0.31

### Patch Changes

- Updated dependencies [64057f4]
  - @notion-headless-cms/core@0.3.21

## 1.0.30

### Patch Changes

- Updated dependencies [52a9f0d]
- Updated dependencies [52a9f0d]
  - @notion-headless-cms/core@0.3.20

## 1.0.29

### Patch Changes

- 30b576e: `cms.<collection>.list()` の戻り値型を CLI 生成の `XxxItem` interface と互換にする。

  - `PropertyDef` に optional な `options?: readonly string[]` を追加。型レベルで literal union を導出するためのメタ情報で、runtime では参照しない。
  - `notion-source` の型導出を `TSTypeForPropDef<P>` に変更し、`P["options"]` が存在する status カラムを literal union に narrow する。
  - CLI が status カラムの選択肢を `options: ["..."] as const` として `*Properties` に出力するよう変更。

  利用側は `nhc generate` を再実行すること。再生成後は CLI が出力する `XxxItem` interface（例: `FixedPage`）をそのまま `cms.fixedPages.list()` の戻り値型として使えるようになる。

- Updated dependencies [30b576e]
  - @notion-headless-cms/core@0.3.19

## 1.0.28

### Patch Changes

- efd3c2f: module augmentation で拡張可能な sources API を追加（#227）

  - `@notion-headless-cms/core`: `CMSAdapter` / `CMSSources` / `MergeSourceCollections` を公開。`createClient({ sources: ... })` を新設し、`createCMS` / `CreateCMSOptions` を `createClient` / `CreateClientOptions` にリネーム（破壊的変更）
  - `@notion-headless-cms/notion-source`: 新規パッケージ。`notionSource({ schema, token, publishOptions })` がコレクションを構築する。`declare module` で `sources.notion` キーが解禁される
  - `@notion-headless-cms/cli`: 生成ファイルを `nhc.schema.ts` に変更（DB 構造のみ）。旧 `createCMS` ラッパー / `NhcConfig` / `Nhc` 型の生成を廃止し、`export const schema` を出力する（破壊的変更）

- Updated dependencies [efd3c2f]
  - @notion-headless-cms/core@0.3.18

## 1.0.27

### Patch Changes

- 01a9865: 戻した

## 1.0.26

### Patch Changes

- 8ad2ba1: `@notion-headless-cms/core` を `dependencies` から `peerDependencies`（`^0.3.0`）に移動した。生成スキーマファイルが core を import するためユーザーは core を必ずインストールする必要があり、CLI がバンドルを二重に抱えないようにするための変更。
- ec37c60: `@notionhq/client` 公式ヘルパー（`collectPaginatedAPI` / `isFullPage` / `isFullBlock` / `isFullUser` / `isNotionClientError` / `APIErrorCode` / `ClientErrorCode`）への置き換えで、自作のページネーション・エラー判定・full/partial 判定を削減し、Notion API 仕様変更への追従性を高めた。挙動互換。

## 1.0.25

### Patch Changes

- 42ecbe5: OGP 設定の矛盾を修正: 生成コードの `ogp` を省略時に非取得とする

  `config.ogp ?? { enabled: true }` が `FetchBlockTreeOgpOptions.enabled`（既定 false）および
  `NotionCollectionCommonOptions.ogp`（省略時は OGP 非取得）と矛盾していた。
  生成テンプレートを `ogp: config.ogp` に変更し、省略時は OGP を取得しない挙動に統一した。

  OGP を有効にするには `nhc.config.ts` で明示的に設定を追加する必要があります：

  ```ts
  // nhc.config.ts は変更不要
  // createCMS を呼ぶ側で ogp を指定する
  const cms = createCMS({
    notionToken: process.env.NOTION_TOKEN!,
    ogp: { enabled: true },
  });
  ```

## 1.0.24

### Patch Changes

- a186757: nhc generate で生成されるファイルのヘッダーコメントをタイムスタンプから SHA256（config のハッシュ）に変更し、インデントを統一

## 1.0.23

### Patch Changes

- c38cad5: OGP 設定の追加と KV / R2 キャッシュファクトリを追加

  - `nhc generate` 生成コードの `NhcConfig` に `ogp?: FetchBlockTreeOgpOptions` を追加。省略時は `{ enabled: true }` でデフォルト有効
  - `notion-orm` に `createKvOgpCache(kv)` を追加 — Cloudflare KV で OGP メタデータ (JSON) を永続化
  - `notion-orm` に `createR2OgpImageCache(bucket, imageProxyBase)` を追加 — Cloudflare R2 で OG 画像を永続化
  - `KvOgpStore` / `R2OgpBucket` インターフェースを公開（Cloudflare Workers 型と構造互換）

## 1.0.22

### Patch Changes

- Updated dependencies [2257467]
  - @notion-headless-cms/core@0.3.17

## 1.0.21

### Patch Changes

- @notion-headless-cms/core@0.3.16

## 1.0.20

### Patch Changes

- Updated dependencies [71702e6]
  - @notion-headless-cms/core@0.3.15

## 1.0.19

### Patch Changes

- 63f5f38: ライブラリ使い勝手改善

  ### コレクション API
  - `get(slug)` → `find(slug)`（nullable が直感的）
  - `slugs()` → `params()`（Next.js 慣習に合わせる）
  - `revalidate(slug, version)` → `check(slug, version)`

  ### グローバル操作
  - `$collections` → `collections`
  - `$invalidate()` → `invalidate()`
  - `$handler()` → `handler()`
  - `$getCachedImage()` → `getCachedImage()`

  ### 設定
  - `cache: adapter` → `cache: [adapter]`（常に配列で型統一）
  - `ttlMs: number` → `swr: { ttlMs: number }`（SWR 設定を名前空間に整理）

  ### エラーハンドリング
  - `CMSError` に `is(code)` / `inNamespace(ns)` インスタンスメソッドを追加
  - `matchCMSError(err, handlers)` ユーティリティを追加

  ### adapter-next
  - `createNextHandler(cms, opts?)` を新設（推奨 API）
  - `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` は `@deprecated`

  ### CLI
  - `columnMappings` → `fieldMappings`（Notion フィールドとの対応であることを明確化）

  ### 型の改名
  - `GetOptions` → `FindOptions`
  - `RevalidateResult` → `CheckResult`
  - 新設: `SWRConfig`

- Updated dependencies [63f5f38]
  - @notion-headless-cms/core@0.3.14

## 1.0.18

### Patch Changes

- 1bae29d: `createCMS` の JSDoc @example に必須フィールド `renderer` / `blocks` を追記。

  `NhcConfig.renderer` は必須フィールドだが例示コードから抜けており、
  そのまま貼り付けると型エラーになっていた。

## 1.0.17

### Patch Changes

- e7ca2ad: 生成される `NhcConfig` に `blocks` / `logger` / `hooks` フィールドを追加。embed/video ブロックのカスタム処理とキャッシュイベント監視が `createCMS` 経由で行えるようになった。

## 1.0.16

### Patch Changes

- a7b4a81: 生成コードの NhcConfig.renderer を必須フィールドに修正（`renderer?: RendererFn` → `renderer: RendererFn`）。`_createCMS` が renderer を必須で要求するため、省略可能のままだと型エラーが発生していた。

## 1.0.15

### Patch Changes

- 45ee864: `updatedAt` を廃止し `lastEditedTime` に一本化。`list()` に `accessibleStatuses` フィルタを適用、デフォルトソート（`publishedAt` 降順）を実装。
- 84a5639: Notion Datasource API のページオブジェクトフィールドをサポートし、エラーハンドリングを強化

  - core: `BaseContentItem` に `createdAt`, `isArchived`, `coverImageUrl`, `iconEmoji` を追加。`fetchListRaw`/`findRaw` で `isArchived:true` のアイテムを自動除外
  - notion-orm: `mapper.ts` でヘルパー関数 (`extractPageTitle`, `extractCoverUrl`, `extractIconEmoji`) を追加し、新フィールドのマッピングをサポート。スラグが空の場合 `CMSError` をスロー
  - notion-orm: `schema.ts` の `parseMapping` で新フィールドをセット
  - notion-embed: OGP/oEmbed の HTTP エラーおよびネットワーク例外を `console.warn` で記録
  - cli: 生成コードに新メタデータフィールドを追加、`DataSourceObjectResponse` インポートをメインエントリに変更して安定化

- Updated dependencies [45ee864]
- Updated dependencies [84a5639]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
- Updated dependencies [c75218d]
  - @notion-headless-cms/core@0.3.13

## 1.0.14

### Patch Changes

- bccd931: Notion ページの最終編集日時を BaseContentItem.lastEditedTime として自動セット。

  - **@notion-headless-cms/core**: `BaseContentItem` に `lastEditedTime?: string` フィールドを追加し、Notion の `page.last_edited_time` に対応するシステムフィールドとして定義
  - **@notion-headless-cms/notion-orm**: `mapItemFromPropertyMap()` / `mapItem()` / `parseMapping()` が `page.last_edited_time` から `lastEditedTime` を自動セット。`SystemField` / `SYSTEM_FIELDS` に `"lastEditedTime"` を追加
  - **@notion-headless-cms/cli**: Notion の `last_edited_time` 型を未サポートとしてスキップ（生成コードは DB 列のみ対象）

- Updated dependencies [bccd931]
  - @notion-headless-cms/core@0.3.12

## 1.0.13

### Patch Changes

- bac925b: Notion `select` 型プロパティの生成型を `string | null` に変更

  これまで Notion の `select` / `status` 型は両方ともリテラル union（例: `"Alice" | null`）を生成していた。
  `select` 型はユーザーが Notion UI から自由に選択肢を追加できるため、新しい選択肢が追加されるたびに
  `nhc generate` の再実行が必要になる問題があった。

  - `status` 型（ワークフロー状態）→ 引き続きリテラル union（例: `"下書き" | "公開済み" | null`）
  - `select` 型（著者・カテゴリ等）→ `string | null` に変更

## 1.0.12

### Patch Changes

- Updated dependencies [757c7e3]
  - @notion-headless-cms/core@0.3.11

## 1.0.11

### Patch Changes

- 24bf322: `BaseContentItem.status` と `publishedAt` を `string | null` 許容に変更し、`nhc generate` が `slugField` を `string`（null 非許容）で生成するよう修正

  - `BaseContentItem.status` を `string | null | undefined` に変更（Notion の select 型が null を返す場合があるため）
  - `BaseContentItem.publishedAt` を `string | null | undefined` に変更（同上）
  - `codegen.ts`: `slugField` に指定されたフィールドの型を `string | null` ではなく `string` で生成（slug なしのアイテムは CMS からアクセスされないため）
  - `collection.ts` / `notion-adapter.ts`: `status` の null ガードを `!= null`（null/undefined の両方を弾く）に修正

- Updated dependencies [24bf322]
  - @notion-headless-cms/core@0.3.10

## 1.0.10

### Patch Changes

- 17f4201: # CMS 再設計 (実装変更が大きい patch)

  API・パッケージ構成・CLI 生成物を全面的に作り直した。詳細は `docs/migration/v1.md` を参照。

  ## ハイライト
  - **`createCMS` の API を簡素化**:
    - 12 メソッド → 4 メソッド: `get` / `list` / `params` / `cache.{invalidate,warm,adjacent}`
    - `getItem` → `get`、`getList` → `list`、`getStaticParams` → `params`
    - `getItemMeta` / `getItemContent` / `getStaticPaths` / `checkForUpdate` / `checkListForUpdate` を削除 (SWR は内部で自動)
    - `prefetch` → `cache.warm`、`revalidate(All)` → `cache.invalidate`、`adjacent` → `cache.adjacent`
    - `cms.$revalidate(scope?)` → `cms.$invalidate(scope?)`
  - **戻り値の刷新**:
    - `get(slug)` は `T & { render(opts?) }` を返し、`render()` 呼び出し時に本文を遅延ロード
    - `result.content.html()/markdown()/blocks()` → `result.render({ format?: "html" \| "markdown" })`
    - `list()` は `T[]` を直接返す (旧 `{ items, version }` を廃止)
  - **キャッシュ統合 (`@notion-headless-cms/cache`)**:
    - `cache-r2` / `cache-kv` / `cache-next` を 1 パッケージに集約
    - `memoryCache()` (doc + image)、`r2Cache()` (image)、`kvCache()` (doc)、`cloudflareCache(env)` (KV+R2)、`nextCache()` (Next.js ISR)
    - `cache: CacheAdapter \| CacheAdapter[]` で柔軟に組み合わせ可能
    - `nodePreset` / `cloudflarePreset` を削除
  - **CLI が完全な `nhc.ts` を生成**:
    - 旧 `nhc-schema.ts` (型のみ) → 新 `nhc.ts` (型 + `createCMS` ファクトリ)
    - ユーザーは `import { createCMS } from "./generated/nhc"` で即座に使える
    - select / status のオプションが literal union 型として生成される
    - `nhc.config.ts` の `dataSources: [...]` → `collections: { posts: { ... } }`
  - **パフォーマンス改善**:
    - renderer の unified processor をモジュールスコープでメモ化 (再構築コスト削減)
    - 画像 URL → SHA-256 ハッシュをプロセス内 LRU でメモ化
  - **アーキテクチャ整理**:
    - `CacheAdapter` インターフェースを `handles` フィールドで doc / image に振り分け
    - `scopeDocumentCache` を廃止 (アダプタが直接 `(collection, slug)` を受け取る)
    - core は `CacheAdapter / DocumentCacheOps / ImageCacheOps` を公開、`DocumentCacheAdapter / ImageCacheAdapter` は削除

  ## 削除されたパッケージ
  - `@notion-headless-cms/cache-r2` → `@notion-headless-cms/cache/cloudflare` の `r2Cache`
  - `@notion-headless-cms/cache-kv` → `@notion-headless-cms/cache/cloudflare` の `kvCache`
  - `@notion-headless-cms/cache-next` → `@notion-headless-cms/cache/next` の `nextCache`

  ## 移行例

  ```ts
  // Before (v0.x)
  import { createCMS, nodePreset } from "@notion-headless-cms/core";
  import { cmsDataSources } from "./generated/nhc-schema";

  const cms = createCMS({
    ...nodePreset({ ttlMs: 5 * 60_000 }),
    dataSources: cmsDataSources,
    collections: { posts: { slug: "slug", publishedStatuses: ["公開済み"] } },
  });
  const { items } = await cms.posts.getList();
  const post = await cms.posts.getItem("hello");
  const html = await post?.content.html();

  // After (v1)
  import { createCMS } from "./generated/nhc";
  import { memoryCache } from "@notion-headless-cms/cache";

  const cms = createCMS({
    notionToken: process.env.NOTION_TOKEN!,
    cache: memoryCache(),
    ttlMs: 5 * 60_000,
  });
  const items = await cms.posts.list();
  const post = await cms.posts.get("hello");
  const html = await post?.render();
  ```

- Updated dependencies [17f4201]
  - @notion-headless-cms/core@0.3.9

## 1.0.9

### Patch Changes

- Updated dependencies [ac7c5cc]
  - @notion-headless-cms/core@0.3.8

## 1.0.8

### Patch Changes

- Updated dependencies [5703a6c]
  - @notion-headless-cms/core@0.3.7

## 1.0.7

### Patch Changes

- 462732a: generate: HTTP キャッシュ無効化と非 ASCII プロパティ名の厳密エラー化

  - Notion API 呼び出しに `cache: "no-store"` を付与し、generate が常に最新のスキーマ情報を取得するようにした
  - TypeScript 識別子に変換できない非 ASCII プロパティ名（例: 日本語）を `columnMappings` 未指定のまま渡した場合、`property_N` に黙認する挙動を廃止し `CMSError (cli/schema_invalid)` を throw するように変更した

  **移行**: 日本語等の非 ASCII プロパティ名がある場合は `nhc.config.ts` で `columnMappings` を指定してください。

## 1.0.6

### Patch Changes

- e19b542: `dbName` での DB 解決を完全一致のみに変更

  - `nhc generate` での `dbName` 検索は完全一致のみを採用するようにした（部分一致のフォールバックを削除）
  - 完全一致する DB が無い場合は `cli/notion_api_failed` で generate を失敗させる
  - 同じ Notion インテグレーションから類似名の DB が複数アクセスできる場合の取り違えを防ぐ

- Updated dependencies [68b01d7]
  - @notion-headless-cms/core@0.3.6

## 1.0.5

### Patch Changes

- Updated dependencies [233af88]
  - @notion-headless-cms/core@0.3.5

## 1.0.4

### Patch Changes

- Updated dependencies [83a5cca]
  - @notion-headless-cms/core@0.3.4

## 1.0.3

### Patch Changes

- Updated dependencies [e719435]
  - @notion-headless-cms/core@0.3.3

## 1.0.2

### Patch Changes

- Updated dependencies [7b06514]
  - @notion-headless-cms/core@0.3.2

## 1.0.1

### Patch Changes

- 6f34d49: 責務分離リファクタリング: ORM は DB クエリ専念、renderer が Transformer を公開

  - **renderer**: `Transformer`・`BlockHandler`・`TransformerConfig`・`TransformContext`・`BlockConverter` を公開 API として追加。`@notionhq/client` と `notion-to-md` をオプショナル peerDeps に追加
  - **notion-orm**: 内部 `transformer/` を renderer へ移動し `@notion-headless-cms/renderer` に依存変更。`NotionFieldType.select` から `published`/`accessible` フィールド削除。`NotionSchema` から `publishedStatuses`/`accessibleStatuses` 削除
  - **core**: `DataSource` インターフェースから `publishedStatuses`/`accessibleStatuses` を削除。公開条件の唯一の権威は `createCMS({ collections })` の `CollectionSemantics` に統一
  - **cli**: `nhc init` テンプレートを `publishedStatuses` は `createCMS({ collections })` で設定するパターンに更新

- Updated dependencies [6f34d49]
  - @notion-headless-cms/core@0.3.1

## 1.0.0

### Major Changes

- c955826: feat: createCMS コレクション検証・公開条件指定、generate 全プロパティ出力

  ### @notion-headless-cms/cli（破壊的変更）
  - `nhc generate` の生成スキーマ形式を刷新。Zod / `defineSchema` / `cmsDataSources` を廃止し、`{name}SourceId` と `{name}Properties` のみを生成するシンプルな形式に変更
  - `nhc.config.ts` の `DataSourceConfig.fields` を削除し `columnMappings` に変更（非 ASCII 列名のマッピング専用）
  - 非 ASCII プロパティ名は `property_1`, `property_2`... に自動変換し warn を出力
  - `columnMappings` で明示マッピング可能、存在しないプロパティを指定した場合はエラー

  ### @notion-headless-cms/core（後方互換）
  - `createCMS` に `collections` オプションを追加（`CollectionSemantics` 型）
  - `collections[name].slug` が未指定の場合に `CMSError(core/config_invalid)` をスロー
  - `collections[name].publishedStatuses` / `accessibleStatuses` を DataSource 側の設定より優先して適用
  - 新型エクスポート: `CollectionSemantics`, `PropertyDef`, `PropertyMap`
  - `DataSource.findBySlug` を optional に変更、`findByProp?` と `readonly properties?: PropertyMap` を追加

  ### @notion-headless-cms/notion-orm（後方互換）
  - `createNotionCollection` に `properties` オプションを追加（PropertyMap ベースのマッピング）
  - `findByProp(notionPropName, value)` メソッドを実装（Core が slug ルックアップに利用）
  - 内部に `queryPageByProp` を追加（Notion API のプロパティフィルタクエリ）

### Patch Changes

- Updated dependencies [c955826]
  - @notion-headless-cms/core@0.3.0

## 0.1.6

### Patch Changes

- 15d5091: fix: slug を rich_text 専用にマッピング変更

  - `queryPageBySlug` のフィルタを常に `rich_text` 型に統一（`title` 型フィルタを廃止）
  - `nhc generate` の slug 自動検出を `rich_text` 型プロパティ（"slug"/"Slug"/"スラッグ"）専用に変更
  - DB に対象の `rich_text` プロパティが存在しない場合、generate がエラーで失敗するように変更

## 0.1.5

### Patch Changes

- 22ab39f: `nhc generate` が生成する Zod スキーマに `title: z.string().nullable().optional()` を追加。`item.title` が型・ランタイム両方で利用可能になる。

## 0.1.4

### Patch Changes

- Updated dependencies [cea9495]
  - @notion-headless-cms/core@0.2.1

## 0.1.3

### Patch Changes

- 7791e88: リリース前リファクタリング (0.x 帯のため patch bump)。

  ## API 変更 (0.x につき patch で許容)
  - **`createCMS` 一本化**: `createNodeCMS` / `createCloudflareCMS` を廃止。
    ランタイム差分は `nodePreset()` (core) と `cloudflarePreset({ env })` (cache-r2) で吸収する。
  - **`adapter-node` / `adapter-cloudflare` パッケージ削除**。上記 preset に統合された。
  - **`InvalidateScope` を `{ collection, slug? }` に統一**。旧 `{ slug }` / `{ tag }` 形式を削除。
  - **NHC プレフィクス → CMS プレフィクス**: `NHCConfig` → `CMSConfig`, `NHCSchema` → `CMSSchema`,
    `nhcDataSources` → `cmsDataSources`, `NHCDataSources` → `CMSDataSources`。
    `nhc` CLI / `nhc.config.ts` / `nhc-schema.ts` のファイル名は維持。
  - **CLI / core の生 Error を CMSError に統一**。`cli/*` 名前空間を新設 (`cli/config_invalid`,
    `cli/schema_invalid`, `cli/generate_failed`, `cli/init_failed`, `cli/notion_api_failed`,
    `cli/env_file_not_found`, `cli/config_load_failed`)。
  - **`cache-next` の invalidate を規約タグに変更**: `nhc:col:<name>` /
    `nhc:col:<name>:slug:<slug>` を `revalidateTag` する。
  - **`DataSourceFactory` を generic 化** (`DataSourceFactory<TOptions>`、
    将来 ORM 増強向けの内部 I/F 整備)。

  ## 追加
  - `nodePreset()` (core): memory cache を既定有効化。`cache` / `ttlMs` / `renderer` で上書き可。
  - `cloudflarePreset({ env, ttlMs?, bindings? })` (cache-r2): env binding を自動解決。
    推奨 binding 名 `DOC_CACHE` (KV) / `IMG_BUCKET` (R2)。旧 `CACHE_KV` / `CACHE_BUCKET` もフォールバック認識。
  - `BuiltInCMSErrorCode` に `core/notion_orm_missing` / `cli/*` を追加。
  - `@notion-headless-cms/cli` に `CMSConfig` / `defineConfig` / `env` を整備。
  - Cloudflare KV バックエンドの `kvCache` (cache-kv)。

  ## 整理
  - 全パッケージの `publishConfig.exports` 重複を削除 (root `exports` のみ)。
  - `cache-r2` に `test` スクリプトを追加。

  ## 移行ガイド

  詳細は [`docs/migration/v0.3.md`](./docs/migration/v0.3.md) を参照。

- Updated dependencies [53a93f7]
- Updated dependencies [7791e88]
  - @notion-headless-cms/core@0.2.0

## 0.1.2

### Patch Changes

- 19cb87a: ビルド・CI/CD・Wrangler 設定の基盤を改善しました。ランタイム挙動への影響はありません。

  - 公開時に **npm provenance** を有効化し、各パッケージの `publishConfig` に `"provenance": true` を追加。GitHub Actions の OIDC（`id-token: write`）と連動し、sigstore 証跡付きで公開されます。
  - `@notion-headless-cms/core` と `@notion-headless-cms/source-notion` の `publishConfig.exports` の冗長な重複定義を削除（通常の `exports` と一致していたため）。

- 0a938ab: `nhc generate` 実行時に Notion API が一時的なエラー（429 / 502 / 503 / 504）を返した場合、指数バックオフでリトライするようになりました（最大 4 回）。CI の間欠的な失敗（"DNS cache overflow" など）に対してより安定します。
- f169f34: `nhc init` / `nhc generate` に `-s, --silent` オプションを追加。CI やスクリプトから呼び出す際に stdout ログを抑制できる。エラーは `--silent` でも stderr に出力される。
- 7192646: `package.json` の `exports` で `types` を先頭に移動して TypeScript の型解決を確実にする。

  publint が `types should be the first in the object as conditions are order-sensitive` を報告していたため、全公開パッケージで `exports[*]` のキー順を `types` → `import` に修正した。動作は同じだが TypeScript の resolution で型ファイルが確実に先に解決される。

- f169f34: `nhc init` のテンプレに `import "dotenv/config";` を追加し、`.env` ファイルから `NOTION_TOKEN` 等を読み込めるようにした。`.env` を使わない環境（CI / Cloudflare の `wrangler secret` など）では先頭行を削除すればよい。docs/cli.md に補足を追加。
- f169f34: Prisma ORM 風のコレクション別 API に全面刷新（破壊的変更）。限定公開期間中のため patch bump。

  ## アーキテクチャ

  `core` を CMS 機能（キャッシュ・画像プロキシ・Web ハンドラ）に専念させ、Notion 固有処理を `@notion-headless-cms/notion-orm`（新規 private パッケージ）に分離した。ユーザーは `notion-orm` を直接 import しない。将来的に `notion-orm` はリポジトリ分離可能な設計。

  ## 主な変更
  - `@notion-headless-cms/source-notion` → `@notion-headless-cms/notion-orm` に改名（private: true）。`notionAdapter` は `createNotionCollection` に改名（旧名はエイリアスとして残す）。
  - `createCMS({ source })` を `createCMS({ dataSources: { posts, authors } })` に変更。各データソースは CLI 生成の `nhcDataSources` として渡す。
  - CMS クライアントはコレクション別 API に刷新:
    - `cms.posts.getItem(slug)` — 本文込みで単件取得（SWR 自動）
    - `cms.posts.getList(opts?)` — 公開済み一覧（本文なし）
    - `cms.posts.getStaticParams()` / `getStaticPaths()` — SSG 用
    - `cms.posts.adjacent(slug)` — 前後記事ナビゲーション
    - `cms.posts.revalidate()` / `cms.posts.prefetch()`
    - `cms.$revalidate(scope?)` / `cms.$getCachedImage(hash)` / `cms.$handler(opts)` — グローバル操作
  - 本文を **`ContentBlock[]` の AST 第一級** で返す仕様に。`post.content.blocks` は常に同梱、`html()` / `markdown()` は遅延メソッド。
  - `DataSource<T>` インターフェースを core に新設（ユーザー非公開・将来の拡張点）。`loadBlocks` / `getLastModified` / `getListVersion` / `resolveImageUrl` / `parseWebhook` を追加。
  - `cms.$handler()` — Web Standard な Request/Response ルーター（画像プロキシ / Webhook 受信）。Next / Hono / Cloudflare Workers で共通利用可能。
  - CLI 生成物 `nhc-schema.ts` は `nhcDataSources`（`createNotionCollection` 呼び出し済み）を出力。ユーザーは `createCMS({ dataSources: nhcDataSources })` だけで良い。
  - 旧 `cms.list()` / `cms.find()` / `cms.cache.*` / `cms.query()` / `QueryBuilder` / `cms.createCachedImageResponse()` / `SchemaConfig` / `DataSourceAdapter` は削除。
  - `adapter-next` の `createImageRouteHandler` / `createRevalidateRouteHandler` は新 API に合わせて書き直し（`$getCachedImage` / `$revalidate` を内部で使用）。
  - 新 example: `examples/node-hono` を追加。実 Notion に接続して getItem / getList / blocks 取得・画像プロキシ・revalidate の動作を検証済み。

- bb693f1: 単一ソース CMS を廃止し `createNodeCMS` / `createCloudflareCMS` をマルチソース一本化しました（破壊的変更）。

  - `createCloudflareCMSMulti` / `createNodeMultiCMS` を `createCloudflareCMS` / `createNodeCMS` に改名し、旧単一ソース版のファクトリは削除しました。`nhc generate` が生成した `nhcSchema` を渡すと、ソース名でアクセスできる `CMS` のマップが返ります。
  - `MultiSourceEntry` / `MultiSourceSchema` / `MultiCMSResult` を `SourceEntry` / `NHCSchema` / `CMSMap` に改名し、`@notion-headless-cms/source-notion` に一元化しました（両アダプタで重複していた定義を削除）。
  - `CloudflareCMSEnv` から `NOTION_DATA_SOURCE_ID` / `DB_NAME` を削除しました。各ソースの `dataSourceId` は `nhcSchema` から取得されます。
  - Notion fetcher のページネーションを `paginate()` ヘルパーに共通化し、`QueryBuilder` のソート・ステータス解決処理を private メソッドに抽出しました。
  - `core/cms.ts` から `buildCachedItem` を `rendering.ts` に分離し、責務を整理しました。
  - `notionAdapter` のオーバーロードを整理し、`as unknown as T` キャストを解消しました。
  - `Logger` の `context` を `LogContext` 型で構造化しました（後方互換あり）。`tsconfig.json` に `useUnknownInCatchVariables` を明示しました。
  - CLI の `notion-client` のエラー判定を `getErrorCode` ヘルパーに統合しました（挙動変更なし）。

## 0.1.1

### Patch Changes

- b453f2e: CLI ツール（nhc generate / nhc init）とマルチソースクライアントを追加

  - `@notion-headless-cms/cli` を新規追加。`nhc generate` で Notion DB を introspect して `nhc-schema.ts` を生成し、`nhc init` で設定ファイルテンプレートを生成する
  - `createNodeMultiCMS` を `adapter-node` に追加。`nhcSchema` から各ソースの `CMS<T>` インスタンスをまとめて生成する
  - `createCloudflareCMSMulti` を `adapter-cloudflare` に追加。Workers 向けのマルチソースファクトリ
  - `sources` オプションで `published` / `accessible` をクライアント作成時に差し込めるようにし、生成ファイルを編集不要にした
