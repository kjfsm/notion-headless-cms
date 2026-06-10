# 旧リポジトリ（notion-headless-cms）資産の再利用マップ

旧リポジトリには実証済みの資産が多くある。「全部書き直し」ではなく、**何をそのまま運び、何を再設計し、何を捨てるか**をここで確定する。パスはすべて旧リポジトリ基準。

## A. そのまま移植する（実証済み・設計変更不要）

| 資産 | 旧パス | 備考 |
|---|---|---|
| エラー体系（namespace/kind コード・`format()`・`matchCMSError`） | `packages/core/src/errors.ts` | `DashError` に改名のみ。docsUrl の張り替え |
| 画像パイプライン（fetch → SHA256 ハッシュ → 永続ストア） | `packages/core/src/image.ts` | Notion 署名 URL 失効対策の核。PortableContent の `images` がこれを参照する |
| blocks ツリー再帰取得（rate limit 配慮・リトライ） | `packages/notion-orm/src/internal/fetcher/`、`packages/fetch-blocks/src/` | pipeline 層の中身としてそのまま |
| blocks → Markdown 変換 | `packages/notion-orm/src/internal/transformer/` | `ndash/markdown` 変換器の中身 |
| Markdown → HTML（unified、processor の WeakMap キャッシュ） | `packages/markdown-html/src/render.ts` | `ndash/html` の Markdown 経路として利用可 |
| blocks → HTML（bookmark/embed/OGP 対応） | `packages/block-html/src/` | `ndash/html` の blocks 直接経路の土台 |
| React ブロックコンポーネント群 | `packages/react-renderer/src/` | コンポーネント実装は流用。**テーマ層は要改修**（下記 B） |
| 構造型によるストア抽象（`R2BucketLike` / `KVNamespaceLike`） | `packages/cache/src/cloudflare.ts` ほか | artifact ストア抽象（architecture.md 3-2）の実装基盤 |
| リトライ・指数バックオフ | `packages/core/src/retry.ts` | そのまま |
| webhook 署名検証・パース | `packages/core/src/handler.ts` の該当部 | mount 統合ハンドラの中身として |
| テストパターン（fake source / fake store / fakeTimers / fetch モック） | `packages/testing/src/`、`.claude/rules/testing.md` | `ndash/testing` として整理し直して移植 |
| CLI の introspection（DB 解決・プロパティ型マッピング） | `packages/cli/src/commands/generate.ts` の取得部 | `ndash pull` の中身。**codegen 出力部は使わない**（雛形コード生成に書き換え） |
| examples の知見（8 フレームワーク分の配線実例・E2E） | `examples/` | 新 API で書き直すが、構成・E2E の知見はそのまま価値がある |
| エラーごとの対処ドキュメント | `docs/ja/errors/` | コード名を読み替えて移植 |

## B. 再設計して移植する（中身は使うが形を変える）

| 資産 | 旧パス | 再設計の内容 |
|---|---|---|
| コレクションクライアント（find/list/SWR） | `packages/core/src/collection.ts` | データモデルを全面変更: 遅延メソッド付き item（`:336-347` の `Object.assign`）→ PortableContent のプレーンデータ。ブロッキング SWR（`:93-110`）→ serve-stale 既定の freshness ループ。`tags` ハードコード（`:622-627`）→ schema 駆動 where |
| 本文ビルド | `packages/core/src/rendering.ts:66-197` | 「全 4 表現を毎回生成」→「要求された body のみ生成」。canonical=blocks に一本化（独自 AST `ContentBlock` は廃止） |
| schema 型導出（条件型による Item 型推論） | `packages/notion-source/src/schema-types.ts` | 優れた推論基盤。**入力を codegen 生成物から `defineCollection` のリテラルに変える**だけで TS-first 化できる |
| キャッシュ抽象（CacheAdapter / doc / img） | `packages/core/src/types/cache.ts`、`packages/cache/src/` | 「ドキュメントキャッシュ」→「artifact ストア」へ意味を単純化。インターフェースは概ね流用可 |
| フック（CMSHooks / definePlugin） | `packages/core/src/types/hooks.ts`、`hooks.ts` | 最小セット（onError / afterRender 相当）に絞って継承。観測系フックは logger に統合 |
| Next.js グルー | `packages/client/src/next.ts` | `basePath: "/__nhc"` 等の URL 書き換えハック（`:104-129`）を捨て、mount 統合ハンドラ + draftMode 連携で書き直す |
| Notion ポーリング再検証（NotionRevalidator / check / peekVersion） | `packages/client/src/react.tsx`、`collection.ts` | 仕組みは scheduled ループと React グルーの内部実装に隠蔽。公開 API から消す |

## C. 持っていかない（設計判断として廃棄）

| 資産 | 廃棄理由 |
|---|---|
| `content: "html" \| "react"` モード（`packages/client/src/index.ts`） | 取得戦略・中間表現・描画技術の 3 軸を 1 軸に潰した誤った抽象。`get(slug, { body })` + サブパス変換器で置換 |
| ブロッキング SWR と「stale を返さない」要件 | 北極星（ライブ反映の体感）に逆行。serve-stale 既定へ反転（concepts.md 2） |
| 15 パッケージの公開構成・メタパッケージ的 re-export | 公開面は `ndash` 1 つ（architecture.md 1） |
| CLI config の `publishedStatuses` / `accessibleStatuses`（`packages/cli/src/index.ts:21-23`、受理されるが codegen が捨てる dead option） | サイレント事故の温床。公開ポリシーの住所は `defineCollection` のみ |
| 独自中間 AST `ContentBlock`（`packages/core/src/content/blocks.ts`） | canonical=blocks 一本化（ADR-1） |
| `nhc generate` の codegen 出力（`generated/nhc.schema.ts`） | TS-first 化により不要。introspection は `pull` の雛形生成に転用 |
| `DataSource` / `CMSSources` のマルチソース公開抽象 | Non-goal 4（ADR-4）。内部レイヤ境界としてのみ残す |
| `cloudflarePreset` の二重 export（cache と client）、`createClient`/`createCMS` 併存 | 公開面統合で自然消滅 |
| Tailwind v4 + shadcn テーマ必須の renderer 構成 | headless / styled の 2 層へ（api-design.md 4） |

## D. ドキュメント・運用資産

| 資産 | 扱い |
|---|---|
| `docs/ja/architecture.md` / `docs/ja/rfc/v2-usability-redesign.md` | 設計判断の歴史として参照リンクのみ。転記しない |
| `.claude/` 一式（rules / skills / hooks） | 構造は優秀。CLAUDE.md.draft と bootstrap.md に要点を継承し、新リポジトリで再構築 |
| changesets / Biome / vitest / CI 設定 | bootstrap.md に選定理由ごと記載して再利用 |
| dogfooding（公式サイトでの自己利用） | nDash でも継続する。M5 でドキュメントサイトを nDash 自身で配信する |
