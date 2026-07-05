# @notion-headless-cms/react-renderer

## 3.0.6

### Patch Changes

- Updated dependencies [0918cce]
  - @notion-headless-cms/cms@3.0.5

## 3.0.5

### Patch Changes

- Updated dependencies [1ec133c]
  - @notion-headless-cms/cms@3.0.4

## 3.0.4

### Patch Changes

- 7144b7e: `Code`・`Equation`・`InlineEquation` の `shiki`/`katex` 動的 import を `import.meta.env.SSR` で
  ガードし、SSR/Worker バンドルから除外されるようにした。

  - これらの動的 import は `useEffect` 内（ブラウザでのみ実行）にあり、実行時には SSR で
    一切走らないが、Vite の SSR ビルドは静的にこの import を到達可能とみなし、shiki の
    言語別チャンク（数百 KB〜）や katex を含む巨大なチャンクを `build/server` 側にも
    生成していた
  - Cloudflare Workers 等、SSR 出力全体を 1 つのデプロイ単位としてアップロードする環境では、
    これらの未使用チャンクがそのまま Worker サイズ上限（無料プラン 3 MiB）を圧迫していた
  - `import.meta.env.SSR` は Vite がビルド時に静的な真偽値へ置換する定数のため、この
    early return により後続の動的 import が SSR ビルドの到達可能グラフから外れ、
    tree-shaking で完全に除外される（ブラウザ向け client ビルドには引き続き含まれる）

## 3.0.3

### Patch Changes

- 43d55b2: `PageLinkMap`・`ResolvedPageLink` 型を公開 API として export した。

  - 両型は元々 `types.ts` で `export interface`/`export type` 済みだったが、トップレベルの
    export リストに含まれていなかった
  - `toPageLinkMap()`（`react-renderer/v3`）の戻り値型が `PageLinkMap` のため、この値を
    自前のローダー関数の戻り値として扱うと、未 export のせいで `tsc -b`（`composite: true`）
    の宣言ファイル出力で「名前を付けられない型」エラーになっていた

- Updated dependencies [43d55b2]
  - @notion-headless-cms/cms@3.0.3

## 3.0.2

### Patch Changes

- Updated dependencies [2f53d86]
  - @notion-headless-cms/cms@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [eac80a3]
- Updated dependencies [eac80a3]
- Updated dependencies [eac80a3]
  - @notion-headless-cms/cms@3.0.1

## 3.0.0

### Patch Changes

- 2a37266: v3 ゼロベース再設計（#437）の基盤を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

  - `react-renderer`: `./v3` サブパスを追加。`denormalizeBlocks` が v3 の正規化 block（`NormalizedBlock`）を既存の `BlockObjectResponse` 形状へ復元するため、既存のブロックコンポーネント約 30 種を無改修のまま再利用できる。`toPageLinkMap` で `EntrySnapshot.links` を既存の `pageLinks` プロップ形式に変換する。`Image` コンポーネントは任意の `_dimensions`（v3 パイプラインが焼き込む width/height）があれば付与する CLS 対応を追加（無ければ従来どおり）
  - `cli`: `packages/cli/src/v3/` に pull（スキーマ雛形生成）・check（drift 検証）・doctor（診断）・sync（手動 kick）・init（wrangler 設定雛形）のロジックを追加。既存の `generate`/`init` コマンドとは独立

  `packages/v3` 自体は非公開（`private: true`）のステージングパッケージで、公開パッケージへの統合は別途行う。

- d030538: v3（#437）に不足していた数式・シンタックスハイライト・高度な HTML・マルチソースの実装を `packages/v3`（非公開ステージングパッケージ）に追加し、既存パッケージに橋渡しを追加した。

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

- f607b31: v3 ゼロベース再設計（#437）のコードレビューで検出した問題を修正。

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
  - @notion-headless-cms/cms@0.1.1

## 0.1.21

### Patch Changes

- f4451f3: コードブロック・callout を shadcn ドキュメント風に寄せる。

  - `notion-shiki`: シンタックスハイライトを `@shikijs/rehype` から `rehype-pretty-code`
    へ移行し、既定をライト/ダークのデュアルテーマ化。表示前にサーバーで code ブロックを
    事前ハイライトして `block.code.__cachedHtml` に埋める `highlightCodeBlocks()` を追加
    （`content: "react"` 経路向け。`resolveBlockImageUrls` と同じ前処理パターン）。
  - `react-renderer`: `Code` を shadcn docs 風の枠（ヘッダー: ファイル名 + 言語ラベル +
    コピーボタン、本体: 行番号付きハイライト、長いコードは折りたたみ）へ刷新。公式の
    `copy-button` / `callout` / `code-collapsible-wrapper` を移植し、Notion の callout
    ブロックを公式 `Callout` でラップ。`theme.css` にデュアルテーマ切替・行番号の CSS と
    `--surface` / `--code` トークンを追加。

## 0.1.20

### Patch Changes

- 8b11e1c: 更新検知を Notion 実データ基準に再設計した（破壊的変更）。

  - `SWRConfig`: `ttlMs` を廃止し、`recheckWindowMs`（Notion 再照会の最小間隔=coalescing、既定 30 秒）と `staleBlockMs`（ブロック閾値、未指定時は webhook secret あり → 無期限／なし →7 日）に分離。
  - `find()` は「新しければ即キャッシュ表示＋裏で Notion 突合（recheck ウィンドウ内は照会しない＝複数端末を集約）／古ければブロッキング再取得」になり、`FindOptions.force` で明示リロード時にウィンドウを無視して最新を取得できる。
  - Handler: 副作用付き GET だった `GET /versions` を廃止し、`POST /check/{collection}/{slug}?v=&force=` に一本化（Notion を coalescing 付きで実照会し `{ stale, version }` を返す）。`HandlerAdapter.peekVersionFor` と `CollectionClient.peekVersion` を削除。
  - `<NotionRevalidator>`: ポーリングを廃止し、mount／再フォーカス契機で `POST /check` を叩き `stale` のときだけ revalidate する方式へ。`realtime`（Durable Object）設定時はポーリングを停止し WebSocket push を主経路にする。
  - 新規 `isReloadRequest(req)` を `@notion-headless-cms/client` から提供（`Cache-Control: no-cache`/`max-age=0` を検出）。SSR ローダーで `find(slug, { force: isReloadRequest(request) })` に使う。

## 0.1.19

### Patch Changes

- 4303b7b: `NotionRevalidator` / `useNotionRevalidate` のクライアント更新検知を vercel/swr ベースに刷新。`realtime`（push 主経路）を追加し `useSWRSubscription` で WebSocket を購読、メッセージ受信で即 revalidate する。poll（フォールバック）は `useSWR` の `refreshInterval` + focus/reconnect 再検証に置き換え、`notionUpdatedAt` の比較のみで判定する（従来の `cachedAt` baseline 検出を撤去し、レース・初回サンプルの無駄・`cachedAt` の意味の上書きを解消）。`swr` を依存に追加。

## 0.1.18

### Patch Changes

- 932dcbc: 画像の caption が単一の URL のみで構成される場合、画像全体をそのリンクで包むようにした（caption テキストは表示しない）。Notion API の image ブロックには画像自体のリンクを表すフィールドが無いため、caption に URL だけを入れる規約でクリック可能な画像を表現する。説明テキスト付きリンクや複数要素の caption は従来どおり figcaption として描画する。

## 0.1.17

### Patch Changes

- 6e92cd2: Steam 埋め込みをコンテンツ全幅に修正。固定幅 646px の指定を外し、コンテンツ幅に追従するよう変更した。

  また `tailwindcss` を optional peerDependency として追加した（`theme.css` の `@source`/`@theme` ディレクティブが要求するため）。

## 0.1.16

### Patch Changes

- d0c8f31: README の `notionBlocks()` 利用例を `createCMS({ content: "react" })` のキャスト不要パターンに更新。`as NotionBlock[]` キャストが必要なのは低レベル `createClient` 経由の場合のみであることを明記する（docs/ja/api/cms-methods.md にも同趣旨を追記）。
- a2016b5: `NotionRevalidator` の `poll` で URL 手書きを不要にする。`poll.url` を省略でき、`collection` と `slug`（または `item`）から `cms.handler()` の versions ルート URL（`${basePath}/versions/${collection}/${slug}`、basePath 既定 `/api/cms`）を自動導出する。`version` も `item.lastEditedTime` から導出されるため、最小形は `poll={{ collection: "posts", item }}` で済む。

  従来の `poll={{ url, version }}` も引き続き有効（後方互換）。`basePath` で別マウント先も指定できる。

## 0.1.15

### Patch Changes

- 79be671: 既定テーマ `@notion-headless-cms/react-renderer/theme.css` を追加。`@import` 1 行で `@source`（dist スキャン）・shadcn トークンの `@theme inline` ブリッジ・ライト/ダーク既定パレットがまとめて入るようにし、利用側がトークン定義を書き忘れて引用・コールアウト等が無色になる問題を解消する。色変更は import 後の `:root` 上書きで行える。README のスタイリング節も刷新。

## 0.1.14

### Patch Changes

- 86585a7: Notion 内部リンクの slug 自動解決を追加（#356 / D6）。

  - core に `buildPageLinkMap` / `buildPageIndex` / `normalizePageId` を追加。`cms` のコレクションを走査して `正規化pageId → { href, title }` のプレーンマップを構築する（ゼロ依存・純関数）。URL 既定は `/${collection}/${slug}`、`url` オプションで上書き可。`@notion-headless-cms/client` からも re-export。
  - react-renderer に `pageLinks` プロップを追加。`link_to_page` / page・database mention / `child_page` を `pageLinks` で自サイト URL に解決し、無ければ従来フォールバック。**プレーンオブジェクトのため React Router の loader 戻り値や RSC 境界を越えられる**（関数プロップ `resolvePageUrl` は越えられないため、内部リンクは `pageLinks` を推奨）。
  - `ResolvePageUrlFn` の戻り値を `string | undefined` に緩和（後方互換）。`resolvePageUrl` / `resolvePageTitle` 関数プロップはカスタムルーティング用の escape hatch として存続。

## 0.1.13

### Patch Changes

- 2d6b5b8: 公開 API の JSDoc に `@example` と `@see` を追加し、IDE ホバーで使い方と関連 API へジャンプできるようにした (Issue #305 / S1)。`NotionRenderer` / `NotionBlocks` / `BlockSwitch` / `useNotionContext` / `resolveBlockImageUrls` / `RichText` / `Caption` / `renderMarkdown` / `Transformer` / `createTransformer` / `BlockHandler` / `RendererFn` / `RendererOptions` / `BlockConverter` / `rehypeImageCache` が対象。

## 0.1.12

### Patch Changes

- 21a4ecf: M5: React renderer のテーマ Provider とレスポンシブ画像対応 (Issue #333)

  - `<NotionThemeProvider theme="light" | "dark" | "system">` を新規追加
    - ルート div に `dark` クラス (カスタマイズ可) を付与し、Tailwind v4 の dark mode と組み合わせて使える
    - `theme="system"` は `prefers-color-scheme` を hydration 後に追従する (SSR は light 扱い)
  - `<NotionRenderer imageSizes={[400, 800, 1200]} imageSizesAttr="...">` を追加
    - `Image` ブロックが `resolveImageUrl` で proxy URL に書き換えられている場合のみ `?w={width}` 付きの `srcSet` を生成する
    - 画像プロキシ側で派生キーをサポートしている前提 (`buildCacheImageFn` の拡張は後続タスク)
    - Notion 署名済み URL (失効する) には `srcSet` を出さない安全動作
  - Context 値に `imageSizes` / `imageSizesAttr` を追加

## 0.1.11

### Patch Changes

- 359bc6f: fetch 戦略両対応の `ContentExtension` インターフェースを導入し、enrichers を廃止。

  ## 破壊的変更

  - `blocksFetcher` / `notionSource` / `createCms` の `enrichers` オプションを削除。
    拡張はすべて Renderer 側の `extensions` prop へ移動。
  - `notionKatex()` / `notionShiki()` の戻り値が `BlockEnricher`（関数）から
    `ContentExtension`（オブジェクト）に変更。

  ## 新機能

  - `notion-orm`: `ContentExtension` インターフェースをエクスポート。
    `getMarkdownPlugins()` で unified プラグインを、`getBlockComponents()` で
    React コンポーネント上書きを提供する統一 API。
  - `react-renderer`: `NotionRenderer` に `extensions` prop を追加。
    `getBlockComponents()` の戻り値が `components` とマージされる（直接指定が優先）。
  - `fetch-markdown`: `Renderer` に `extensions` prop を追加（同期プラグイン向け）。
    非同期プラグイン（shiki など）は `createNotionMarkdownRenderer(extensions)` を使う。
  - `notion-katex`: `getMarkdownPlugins()` が `rehype-katex` を返す（markdown 戦略対応）。
  - `notion-shiki`: `getMarkdownPlugins()` が `@shikijs/rehype` を返す（markdown 戦略対応）。

  ## 移行方法

  ```ts
  // Before
  notionSource({ schema, token, enrichers: [notionKatex(), notionShiki()] });

  // After — fetch はデータ取得に専念
  notionSource({ schema, token, fetch: blocksFetcher() });

  // Renderer に extensions を渡す
  const extensions = [notionKatex(), notionShiki()];
  <NotionRenderer blocks={item.blocks} extensions={extensions} />
  <Renderer content={item.content} extensions={extensions} />
  ```

## 0.1.10

### Patch Changes

- 46b348a: react-renderer の Notion ブロック対応を大幅に拡充（破壊的変更を含む）。

  主な変更:

  - **block-level color を全ブロックに反映**: paragraph / heading_1..4 / quote / callout / toggle / to_do / list_item の `color` / `*_background` が Tailwind class に変換される（`lib/notion-color.ts`）。
  - **inline equation** をデフォルトで KaTeX レンダ。`katex` を peer に入れているだけで動作（クライアントで動的 import、未インストール時はテキストフォールバック）。
  - **mermaid コード**: `code` ブロックの `language === "mermaid"` を既定で SVG に描画（クライアントで動的 import）。`mermaid` を optional peer に追加。
  - **TableOfContents**: ページ内 `heading_1..4` を `NotionRenderer` 側で自動抽出し、`<nav>` リンクツリーとして描画。`Heading` には `id={block.id}` を必ず付与。
  - **numbered list の入れ子**: `<ol>` の list-style を深さに応じて `decimal → lower-alpha → lower-roman` でローテーション。
  - **LinkToPage**: `NotionRendererProps.resolvePageTitle` で本文タイトルを差し替え可能に。アイコンを `FileText` に変更し、ラベルは `resolvePageTitle?.(id) ?? "Open page"`。
  - `ComponentOverrides.InlineEquation` slot を追加。
  - 軽微: `callout` 空時の潰れ防止 / `code` 言語ラベル `plain text` → `text` 正規化 / `table` を `w-full` 明示 / `divider` の `bg-border h-px` 明示。

  破壊的変更:

  - サブパス `@notion-headless-cms/react-renderer/equation` を**廃止**。`Equation` は既定で動的 KaTeX 対応。
  - サブパス `@notion-headless-cms/react-renderer/code` を**廃止**。`Code` は既定で mermaid 対応。Shiki シンタックスハイライトは引き続き `notion-shiki` enricher の `__cachedHtml` で server-side pre-render。
  - `Heading` の DOM に `id` 属性が必ず出力される。
  - `Callout` は `Card` → `Alert + AlertDescription` 構造に変更済（PR #289）の上で `bg-muted/40` フォールバックを上乗せ。
  - 各 block の出力 DOM/class が color 反映により変化。

- 5e6f4ad: shadcn/ui の各コンポーネント (aspect-ratio / card / collapsible / separator / table) を shadcn CLI で再生成し、最新版に揃えた

## 0.1.9

### Patch Changes

- 6137936: pnpm catalog を使って依存バージョンを一元管理するよう整理
- f7fd36a: 依存関係を pnpm up --latest で最新化（tsdown 0.22.0、turbo 2.9.14、biome 2.4.15 等）

## 0.1.8

### Patch Changes

- ccb9fe7: 空の paragraph ブロックを空行として表示する

  rich_text が空の paragraph が `<p></p>` になりブラウザが折り畳んでいた問題を修正。
  block-html は `<p><br></p>`、react-renderer は `<br />` を挿入して 1 行分の高さを確保する。

## 0.1.7

### Patch Changes

- 52fdcc7: ブロック内改行・YouTube 埋め込み・画像ライトボックスを修正

  - RichText の `\n` を `<br>` に変換（#256）
  - Video/Embed の YouTube URL を `youtube-nocookie.com/embed/` 形式に変換し接続拒否を解消（#257）
  - Image クリックでライトボックス表示（ESC・背景クリックで閉じる）（#258）

## 0.1.6

### Patch Changes

- 7f2668a: KV ポーリングによる SWR バックグラウンド更新完了後の自動再描画を追加

  - `CollectionClient.peekVersion(slug)` を追加: KV のみを読んで `{ notionUpdatedAt, cachedAt }` を返す。Notion API を叩かないため安価なポーリングエンドポイントとして使える
  - `checkAndUpdateItemBg` で差分なし時も常に `cachedAt` を更新するよう変更: ポーリング側が「バックグラウンド確認完了」を `cachedAt` の変化で検出できるようにする
  - `NotionRevalidator` / `useNotionRevalidate` に `poll` オプションを追加: `notionUpdatedAt` 変化で revalidate、`cachedAt` 変化（更新なし）で停止、タイムアウト 30 秒

## 0.1.5

### Patch Changes

- b26e623: feat(#220): notion-shiki パッケージと react-renderer/code サブパス export を追加

  - `@notion-headless-cms/notion-shiki` 新規パッケージ: fetch 時に shiki で code ブロックを pre-render し `block.code.__cachedHtml` へ埋め込む `BlockEnricher` を提供。Workers バンドルから shiki を除外できる（`notion-katex` の Code 版）
  - `react-renderer` の `Code` スタブを更新: `__cachedHtml` が付与されていれば `dangerouslySetInnerHTML` で描画、なければ従来の `<pre>` にフォールバック（完全後方互換）
  - `react-renderer/code` サブパスを追加: `shiki` をブラウザで直接使いたい場合に `SyntaxHighlighter` を import できる（`createHighlighter` + React 19 `use()` + Suspense で非同期初期化を吸収）

- 2aa855a: react-renderer: resolveImageUrl / resolvePageUrl / Image / Link スロットを追加 (#218 / #219)

  - `NotionRenderer` props に `resolveImageUrl` / `resolvePageUrl` を追加。Context 経由で Image・Video・Audio・File・Pdf・LinkToPage・ChildPage ブロック全体に伝播する
  - `Image` / `Link` コンポーネントスロットを追加。`next/image` / `next/link` などのフレームワーク最適化コンポーネントをブロック override なしに差し込める
  - `OgCard` の `<a>` / `<img>` も同スロットに対応
  - 未注入時は従来通り `<img>` / `<a>` にフォールバックし、完全互換

- a386b14: react-renderer: LinkPreview・Mention の残存ハードコード `<a>`/`<img>` を Context の Image/Link スロットに差替

  - `LinkPreview.tsx` の非 OGP fallback `<a>` を `useNotionContext()` の `Link` スロット経由に変更
  - `Mention.tsx` の `link_mention`・`link_preview` の `<a>` と、`link_mention` アイコン・`custom_emoji` の `<img>` を `useNotionContext()` の `Link`/`Image` スロット経由に変更
  - `@notion-headless-cms/next` に next/image・next/link 注入例を含む README.md を追加

## 0.1.4

### Patch Changes

- 64057f4: 後方互換性のために残されていたコードとコメントを削除

  - adapter-next: `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` と `RevalidateHandlerOptions` 型を削除。`createNextHandler` を使用すること
  - notion-embed: YouTube プロバイダの `ogp` オプションを `fetchData` に改名（旧名は廃止、内部実装は oEmbed のまま）
  - notion-embed: `renderTranscription` ハンドラを削除し、`transcription` ブロックは `meeting_notes` と同じレンダリングに統一（`--legacy` 修飾子を削除）
  - react-renderer: `ComponentOverrides.Transcription` スロットを削除。`transcription` ブロックは常に `Unsupported` にフォールバック
  - core: `loadNotionBlocks` 追加以前のキャッシュエントリを再生成する lazy backfill ロジックを削除（古いキャッシュは `cms.invalidate()` で手動更新が必要）
  - docs/migration/ 配下のマイグレーションガイドを一括削除

## 0.1.3

### Patch Changes

- 52a9f0d: Notion 更新の表示反映を 1 行で書ける再検証ヘルパを追加。

  - `@notion-headless-cms/react-renderer/router`: React Router 用の `useNotionRevalidate()` フックと `<NotionRevalidator />` コンポーネント。内部で `useRevalidator` を呼び、loader を再走させる。
  - `@notion-headless-cms/react-renderer/next`: Next.js App Router 用の同 API。内部で `useRouter().refresh()` を呼び、Server Component を再評価させる。
  - `@notion-headless-cms/core/html`: React 非依存の `notionRevalidatorScript()`。Astro / Hono / Express など素の HTML を返すフレームワーク向けに、タブ可視化で `location.reload()` する `<script>` 文字列を返す。

  いずれもクエリパラメータも別 API への fetch も発生せず、フレームワーク本来の再評価機構だけを使う。サーバ側の `cloudflarePreset({ env, ctx })` 等で `waitUntil` を渡しておけば、SWR の bg 更新で KV キャッシュが最新化された次のリクエストで画面が静かに切り替わる。

- 52a9f0d: レビューに伴う細部改善とドキュメント更新。

  - `react-renderer/router` と `react-renderer/next` で重複していた `NotionRevalidateTrigger` / `UseNotionRevalidateOptions` / トリガー処理を `internal/revalidate.ts` に集約し、`useCallback` で revalidate を安定化。
  - `core/html` の `notionRevalidatorScript({ nonce })` で nonce を base64 / base64url 文字（`A-Za-z0-9+/=_-`）に厳格化。属性値ブレイクアウトを未然に防ぐため不正な値は throw する。
  - `docs/recipes/cloudflare-workers.md` を `cloudflarePreset` ベースに全面書き換え、`swr.ttlMs` 推奨を撤廃して「永続キャッシュ + lastEditedTime 検知」方針に揃える。
  - `docs/recipes/nextjs-app-router.md` に `<NotionRevalidator />` セクションを追加。
  - `docs/recipes/useswr-integration.md` に「単純な再検証なら `react-renderer/router` / `react-renderer/next` の方が短い」という導入を追加。
  - `packages/cache/README.md` / `packages/core/README.md` / `packages/react-renderer/README.md` を現状の API と推奨パターンに揃える。

## 0.1.2

### Patch Changes

- 6a24bdc: notion-katex: フェッチ時に数式を KaTeX HTML へ事前変換するパッケージを追加（#221）

  - `@notion-headless-cms/notion-katex` を新設。`notionKatex()` が `BlockEnricher` を返す
  - `notion-orm`: `BlockEnricher` 型と `enrichers` オプションを `NotionCollectionCommonOptions` に追加
  - `react-renderer`: `Equation` コンポーネントが `__cachedHtml` を `dangerouslySetInnerHTML` で描画。Workers バンドルから katex を除外できる

- 7366cce: react-renderer: 単一 Context 化で prop drilling を解消する（#217）

  - `src/context.tsx` を追加し `NotionContext` / `useNotionContext` を公開
  - `NotionRenderer` が `NotionContext.Provider` を貼り、設定を Context に格納
  - `NotionBlocks` コンポーネントを新設し `renderBlocks` 関数を置き換え（公開 API）
  - `BlockSwitch` が Context から `components` / `classNames` を取得し、props から除去
  - `BlockComponentProps.renderChildren` を廃止。各 Block 実装は `<NotionBlocks>` を直接呼ぶ
  - `ComponentOverrides` の各スロットを block 固有の narrow 型に変更（`as` キャスト不要に）
  - `useNotionContext` / `NotionBlocks` / `HeadingBlockObjectResponse` を index.ts から export

## 0.1.1

### Patch Changes

- befbaa5: `Equation` ブロックのデフォルト実装をスタブ化し、KaTeX 対応版を `@notion-headless-cms/react-renderer/equation` サブパスへ分離した。`katex` を `dependencies` から `peerDependencies`（optional）に降格したため、数式を使わないユースケースではメインバンドルから KaTeX が完全に除外される（gzip 約 75 KB 削減）。

  **移行手順** — 数式を整形表示する場合のみ:

  ```bash
  pnpm add katex
  ```

  ```tsx
  import dynamic from "next/dynamic";

  const Equation = dynamic(() =>
    import("@notion-headless-cms/react-renderer/equation").then(
      (m) => m.Equation
    )
  );

  <NotionRenderer blocks={blocks} components={{ Equation }} />;
  ```

  数式を使わない場合は何もする必要はない（既定の `Equation` は式を `<pre>` で素のまま表示する）。

- 7e0bae4: ブックマーク（OgCard）の横方向見切れを修正: カードに `min-h-[6.5rem]` を付与し、タイトル / 説明を `line-clamp-2 break-words` で折り返し・省略するよう調整。画像エリアは `w-36 sm:w-48 md:w-64` の段階縮小で狭い親幅でも本文が圧迫されないようにした
- 1da671d: 埋め込みカード（OgCard）の表示改善: タイトル折り返し全文表示、og:description 全文表示、URL をカード下端に配置して目立たなく調整
- 391d5ea: OGP メタデータの抽出を自前正規表現から `linkedom` に置き換え、属性順や `name=`/`property=` のバリエーションを DOM API でまとめて扱うようにした。HTML エンティティのデコードも DOM 側に委譲。挙動互換。

  `react-renderer` の各 block コンポーネントを `tailwind-merge` ベースの `cn()` で統一し、`BlockComponentProps.className` と `<NotionRenderer classNames={{ ... }} />` を新設。block.type ごとにルート要素のクラスを差し替えられるようになった（追加 API、後方互換）。

## 0.1.0

### Minor Changes

- c6cbace: `@notionhq/client` の `BlockObjectResponse` union 全 type に対応した。

  - `notion-embed`: `heading_4` / `code` / `equation` / `divider` / `breadcrumb` / `table` / `table_row` / `table_of_contents` / `tab` / `column_list` / `column` / `synced_block` / `template` / `child_page` / `child_database` / `meeting_notes` / `transcription` / `unsupported` の 18 種類を追加。`createBlockHandlers` の戻り値型を `Record<BlockObjectResponse["type"], BlockHandler>` に固定し、`@notionhq/client` で新しい block type が追加された場合は型エラーで検知できる。
  - `react-renderer`: `Heading` コンポーネントを `heading_4` にも対応させ、`BlockSwitch` の dispatcher を `satisfies Record<BlockObjectResponse["type"], unknown>` 付き map に置換。ライブラリ更新で union が増えたら typecheck で気付ける。`ComponentOverrides` に `TableRow` / `Tab` / `Template` / `MeetingNotes` / `Transcription` の override スロットを追加。
  - Issue #208: discriminated union が既に narrowing 済みの 3 箇所 (`callout.ts` の `"file" in icon`、`render-rich-text.ts` の user mention `"name" in u` および custom_emoji の `"url" in emoji`) を冗長な `"in"` 演算子チェックを除去するリファクタリング。

## 0.0.11

### Patch Changes

- d6e7f57: Refactor OG image handling to use object-cover and remove aspect-video

## 0.0.10

### Patch Changes

- 2948a65: Image / Embed ブロックの上下マージン（my-4）を除去

## 0.0.9

### Patch Changes

- 1be8726: bookmark カードの見た目を整理。OGP 画像を右端に揃え、`aspect-video` + `object-contain` で見切れを防止し、`w-40 sm:w-56` の最小幅を確保して小さくなりすぎないようにした。

## 0.0.8

### Patch Changes

- e0b4579: 依存パッケージのメジャーバージョンアップ: lucide-react 1.14.0、tailwind-merge 3.5.0

## 0.0.7

### Patch Changes

- c2e4f03: fix(react-renderer): ブックマークサムネイルの画像が見切れる問題を修正

## 0.0.6

### Patch Changes

- 13ad21c: embed ブロックを OGP カードではなく iframe で描画するよう修正し、ホスト別の推奨サイズを適用する（Steam widget は 646x190、その他は aspect-video）。

## 0.0.5

### Patch Changes

- 0a5c883: link_preview ブロックに OGP カード表示を追加

  - `fetchBlockTree` の OGP enrichment 対象に `link_preview` を追加（`LinkPreviewBlockWithOgp` 型を export）
  - `renderLinkPreview` が OGP 取得に対応。成功時は bookmark と同形状のカードを出力、失敗時はシンプルリンクにフォールバック。OG 画像は `loading="lazy"` でブラウザ側取得（ミラーリングなし）
  - `LinkPreview` React コンポーネントが `ogp` フィールドを持つ場合に `OgCard` を使用

- 9c3777b: embed/video ブロックの URL 判定を廃止

  - `Embed` コンポーネントの YouTube 専用分岐を削除。すべての embed URL を `OgCard` で統一描画
  - `Video` コンポーネントの YouTube 専用分岐を削除。`block.video.type` で `"file"` は `<video>` タグ、`"external"` は `<iframe>` を使用
  - 公開 API `Embeds.YouTubeEmbed` を削除
  - 内部ユーティリティ `isYouTubeUrl` / `extractYouTubeId` を削除

## 0.0.4

### Patch Changes

- a82db83: embed/bookmark ブロックを OG 情報ベースの汎用カードに統一。`fetchBlockTree(client, pageId, { ogp: { enabled: true, imageCache } })` で OG メタデータを取得して各ブロックに `ogp` フィールドとして付与し、react-renderer 側は YouTube 以外をすべて画像入りリンクカード (`OgCard`) で描画する。Steam / DLsite / Twitter / Vimeo / 汎用 iframe 専用コンポーネントは廃止。

## 0.0.3

### Patch Changes

- 1501e16: Code ブロックから shiki 依存を削除し、シンタックスハイライトせず素の `<pre><code>` で描画するように変更。バンドルサイズを大幅に削減。言語名は `data-language` 属性で参照可能。

## 0.0.2

### Patch Changes

- 2257467: react-renderer 経由でも Notion ブロックツリーと画像をキャッシュできるようにする。

  - core: `DataSource.loadNotionBlocks` (optional) を追加し、`CachedItemContent` / `ItemWithContent` に `notionBlocks` を含める。`cms.posts.find()` 経由で SWR キャッシュに乗る。
  - core: `cms.cacheImage` / `cms.imageProxyBase` を公開。画像キャッシュが設定されていれば Notion 画像 URL を SHA256 ハッシュキーのプロキシ URL へ変換できる。
  - notion-orm: `NotionCollection.loadNotionBlocks` を実装 (内部で `fetchBlockTree` を呼ぶ)。
  - react-renderer: `@notion-headless-cms/react-renderer/server` サブパスから `resolveBlockImageUrls(blocks, cacheImage)` を提供。サーバー側で image / video / audio / file / pdf の file 型 URL をプロキシ URL へ事前解決する。

## 0.0.1

### Patch Changes

- aa3b1d5: `@notion-headless-cms/react-renderer` パッケージを新規追加。Notion API のブロックレスポンスを React コンポーネント (shadcn/ui + Tailwind v4) として直接描画する。`notion-to-md` を経由せず、Notion 全 block type に対応する。あわせて `@notion-headless-cms/notion-orm` に `fetchBlockTree(client, pageId)` を追加し、children を再帰的に解決済みのブロック木を返せるようにした。
