# CLAUDE.md

## 言語ルール

- コメント、コミットメッセージ、PR概要はすべて**日本語**で記述する

## プロジェクト概要

Notion をヘッドレス CMS として利用するための TypeScript ライブラリ群。
pnpm モノリポで管理され、npm（`@notion-headless-cms` スコープ）としてパブリック公開される。

依存方向（下が上を使う、core は外部ランタイム依存ゼロ）:

```
Notion DB
  └─ @notion-headless-cms/source-notion（API 取得 + Notion→Markdown）
       ├─ @notion-headless-cms/renderer（Markdown→HTML）
       └─ @notion-headless-cms/core（CMS 統合・キャッシュ・クエリ・フック）
            ├─ @notion-headless-cms/cache-r2（R2 キャッシュ）
            ├─ @notion-headless-cms/cache-next（Next.js ISR キャッシュ）
            ├─ @notion-headless-cms/adapter-cloudflare（Workers 向けファクトリ）
            ├─ @notion-headless-cms/adapter-node（Node.js 向けファクトリ）
            └─ @notion-headless-cms/adapter-next（Next.js ルートハンドラ）
```

Notion API クライアントと Notion ブロック→Markdown 変換器は `source-notion` の `src/internal/` 配下に実装されており、独立パッケージとしては公開しない。

## 技術スタック

| 層 | 技術 |
|---|---|
| ビルド | tsup（ESM + TypeScript declarations） |
| 型チェック | TypeScript 5.9（strict） |
| Notion API | @notionhq/client |
| Markdown変換 | notion-to-md |
| HTMLレンダリング | remark / rehype（unified） |
| キャッシュストレージ | Cloudflare R2 / Next.js `unstable_cache` / メモリ |
| バリデーション | Zod |
| リンター/フォーマッター | Biome |
| パッケージ管理 | pnpm ワークスペース |
| リリース | changesets |

## ディレクトリ構成

```
packages/
  core/                   # CMS エンジン本体（外部ランタイム依存なし）
    src/
      cms.ts              # CMS クラス・createCMS()
      cache.ts            # isStale / sha256Hex
      cache/memory.ts     # memoryDocumentCache / memoryImageCache
      cache/noop.ts       # noop 実装
      query.ts            # QueryBuilder
      retry.ts            # withRetry / DEFAULT_RETRY_CONFIG
      hooks.ts            # mergeHooks / mergeLoggers
      errors.ts           # CMSError / 名前空間付きエラーコード
      image.ts            # 画像フェッチ・キャッシュ
      types/              # 型定義（config / content / cache / hooks / logger / plugin / source）
      index.ts            # 公開 API
  source-notion/          # Notion データソースアダプタ
    src/
      notion-adapter.ts   # notionAdapter() ファクトリ
      mapper.ts           # デフォルトマッパー・getPlainText
      schema.ts           # defineSchema / defineMapping
      internal/fetcher/   # Notion API クライアント（内部実装）
      internal/transformer/ # Notion ブロック→Markdown 変換（内部実装）
  renderer/               # Markdown → HTML レンダリング（unified）
  cache-r2/               # Cloudflare R2 キャッシュアダプタ（R2BucketLike）
  cache-next/             # Next.js ISR キャッシュアダプタ
  adapter-cloudflare/     # createCloudflareCMS() ファクトリ
  adapter-node/           # createNodeCMS() ファクトリ
  adapter-next/           # Next.js 用ルートハンドラ

examples/                 # フレームワーク別の動作例

.github/
  workflows/
    ci.yml                # PR・main push 時に build / typecheck / test を実行
    release.yml           # main push 時に changesets/action で PR 作成または npm 公開
```

## コマンド

```bash
# ルート（全パッケージ一括）
pnpm build            # 全パッケージをビルド
pnpm typecheck        # 全パッケージの型チェック
pnpm test             # vitest ユニットテスト
pnpm format           # Biome でフォーマット・Lint 自動修正
pnpm lint             # Biome ci（CI で失敗させる）

# 個別パッケージ（例: core）
cd packages/core
pnpm build
pnpm typecheck
```

コード変更後は必ず `pnpm typecheck && pnpm test` を実行する。

## コードスタイル

Biome の設定に従う（biome.json 参照）。

- インデント: タブ
- クォート: ダブルクォート（`""`）
- インポートは自動整理（organizeImports）
- ES Modules（`import/export`）を使用。CommonJS（`require`）は使わない

## アーキテクチャ上の重要な注意点

### core は外部ランタイム依存ゼロ
- `@notionhq/client` / `unified` / `zod` / `renderer` のいずれにも依存しない
- レンダラーは `CreateCMSOptions.renderer`（`RendererFn`）として注入する
- アダプタ（`adapter-cloudflare` / `adapter-node`）が `renderMarkdown` を自動注入する
- 何も指定しなかった場合、`core` は動的 `import("@notion-headless-cms/renderer")` でフォールバック

### キャッシュ戦略（Stale-While-Revalidate）
- まずキャッシュを返し、TTL 切れなら裏で非同期更新
- `CreateCMSOptions.cache.ttlMs` が有効期間
- `cache.document` / `cache.image` 未設定時は `noopDocumentCache` / `noopImageCache` が使われる（キャッシュなし）
- `cms.cache.read.list()` / `cms.cache.read.get(slug)` が SWR アクセサ

### Notion 更新検知
- `last_edited_time` でキャッシュと比較し、差分があれば HTML 再生成
- `cms.cache.manage.checkItem(slug, lastEdited)` / `cms.cache.manage.checkList(version)` が差分 API

### 画像処理
- Notion 画像 URL は期限付きのため、fetch → SHA256 ハッシュキーでストレージに永続保存
- `core/src/image.ts` の `fetchAndCacheImage` が担当（HTTP 失敗時は `CMSError` を投げる）
- フロントエンドには `{imageProxyBase}/{hash}` で配信（デフォルト: `/api/images`）

### エラー体系
- すべての内部エラーは `CMSError` に統一（コード: `namespace/kind` 形式）
- 組み込みコード: `core/config_invalid` / `core/schema_invalid` / `source/fetch_items_failed` / `source/fetch_item_failed` / `source/load_markdown_failed` / `cache/io_failed` / `renderer/failed`
- サードパーティアダプタは任意の文字列コードを使える（`CMSErrorCode = BuiltInCMSErrorCode | (string & {})`）
- 名前空間判定は `isCMSErrorInNamespace(err, "source/")` を使う

### キャッシュ抽象
- `DocumentCacheAdapter<T>` / `ImageCacheAdapter` インターフェース（`core/src/types/cache.ts`）を実装すれば R2 以外に差し替え可能
- `cache-r2` は Cloudflare R2、`cache-next` は Next.js ISR、`core` は in-memory / noop を提供
- `cache-r2` は構造型 `R2BucketLike` を受け取るため `@cloudflare/workers-types` への実依存なし

### 環境変数（シークレット）
- `NOTION_TOKEN`: Notion API キー
- `NOTION_DATA_SOURCE_ID`: Notion データベース ID
- Workers は `wrangler secret put` で設定する。コードにハードコードしない
- `adapter-node` は `process.env` から自動読み込み（未設定時は `CMSError` `core/config_invalid`）

## npm 公開フロー

changesets を使ったセマンティックバージョン管理で自動公開される。

```bash
# 1. 変更内容を記録する changeset を作成
pnpm changeset

# 2. main にマージすると release.yml が起動し、
#    "Version Packages" PR を自動作成する

# 3. その PR をマージすると npm に自動公開される
```

- `release.yml` は build → typecheck → test の後に `changesets/action` を実行
- `NPM_TOKEN` と `GITHUB_TOKEN` シークレットが必要（リポジトリ Settings > Secrets）
- アクセス設定は `.changeset/config.json` の `"access": "public"` で制御

## ワークフロー

1. **実装前**: Plan Mode で関連ファイルを確認してから実装する
2. **実装後**: `pnpm typecheck` && `pnpm test` && `pnpm format` を通してからコミット
3. **コミットメッセージ**: 日本語で変更の「なぜ」を記述する
4. **changeset**: ライブラリを更新したら `pnpm changeset` を実行して changeset を作成する
5. **リリース**: main にマージすると release.yml が "Version Packages" PR を作成し、その PR をマージすると npm に公開される
