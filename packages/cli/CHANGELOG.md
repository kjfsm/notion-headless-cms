# @notion-headless-cms/cli

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
