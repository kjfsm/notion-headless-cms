# CLAUDE.md

## 言語ルール

- コメント、コミットメッセージ、PR概要はすべて**日本語**で記述する

## プロジェクト概要

Notion をヘッドレス CMS として利用するための TypeScript ライブラリ群。  
pnpm モノリポで管理され、npm（`@notion-headless-cms` スコープ）としてパブリック公開される。

```
Notion DB
  └─ @notion-headless-cms/fetcher（API取得）
       └─ @notion-headless-cms/transformer（ブロック→Markdown）
            └─ @notion-headless-cms/renderer（Markdown→HTML）
                 └─ @notion-headless-cms/core（CMS統合・キャッシュ）
                      └─ @notion-headless-cms/cache-r2（R2ストレージ）
                           └─ @notion-headless-cms/adapter-cloudflare（Workers注入）
```

## 技術スタック

| 層 | 技術 |
|---|---|
| ビルド | tsup（ESM + TypeScript declarations） |
| 型チェック | TypeScript 5.9（strict） |
| Notion API | @notionhq/client |
| Markdown変換 | notion-to-md |
| HTMLレンダリング | remark / rehype（unified） |
| キャッシュストレージ | Cloudflare R2 |
| バリデーション | Zod |
| リンター/フォーマッター | Biome |
| パッケージ管理 | pnpm ワークスペース |

## ディレクトリ構成

```
packages/
  core/               # CMSエンジン本体（取得・変換・キャッシュ統合）
    src/
      cms.ts          # CMS クラス・createCMS()
      cache.ts        # CacheStore・isStale・sha256Hex
      types.ts        # 公開型定義（CMSConfig, BaseContentItem など）
      errors.ts       # CMSError
      mapper.ts       # Notionプロパティマッピング
      image.ts        # 画像フェッチ・キャッシュ
      index.ts        # 公開 API
  fetcher/            # Notion API クライアントラッパー
  transformer/        # Notion ブロック → Markdown 変換
  renderer/           # Markdown → HTML レンダリング
  cache-r2/           # Cloudflare R2 StorageAdapter 実装
  adapter-cloudflare/ # createCloudflareCMS() ファクトリー

.github/
  workflows/
    ci.yml            # PR・main push 時に build / typecheck / test を実行
    release.yml       # main push 時に changesets/action で PR 作成または npm 公開
```

## コマンド

```bash
# ルート（全パッケージ一括）
pnpm build            # 全パッケージをビルド
pnpm typecheck        # 全パッケージの型チェック
pnpm test             # core・renderer のユニットテスト（vitest）
pnpm format           # Biome でフォーマット・Lint自動修正

# 個別パッケージ（例: core）
cd packages/core
pnpm build
pnpm typecheck
```

コード変更後は必ず `pnpm typecheck` を実行する。

## コードスタイル

Biome の設定に従う（biome.json 参照）。

- インデント: タブ
- クォート: ダブルクォート（`""`）
- インポートは自動整理（organizeImports）
- ES Modules（`import/export`）を使用。CommonJS（`require`）は使わない

## アーキテクチャ上の重要な注意点

### キャッシュ戦略（Stale-While-Revalidate）
- まずキャッシュを返し、TTL 切れなら裏で非同期更新
- `CMSConfig.cache.ttlMs` が有効期間
- `storage` 未設定時はキャッシュなしで動作（ローカル開発向け）

### Notion 更新検知
- `last_edited_time` でキャッシュと比較し、差分があれば HTML 再生成
- 変更なければ `cachedAt` のみ更新（TTL 延長）

### 画像処理
- Notion 画像 URL は期限付きのため、Workers で fetch → SHA256 ハッシュキーで R2 に永続保存
- `core/src/image.ts` の `fetchAndCacheImage` が担当
- フロントエンドには `{imageProxyBase}/{hash}` で配信（デフォルト: `/api/images`）

### ストレージ抽象
- `StorageAdapter` インターフェース（`core/src/types.ts`）を実装すれば R2 以外に差し替え可能
- `cache-r2` が Cloudflare R2 実装、`adapter-cloudflare` が Workers 向け注入を担当

### 環境変数（シークレット）
- `NOTION_TOKEN`: Notion API キー
- `NOTION_DATA_SOURCE_ID`: Notion データベース ID
- これらは `wrangler secret put` で設定する。コードにハードコードしない

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
