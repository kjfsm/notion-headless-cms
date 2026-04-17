# CLAUDE.md

## 言語ルール

- コメント、コミットメッセージ、PR概要はすべて**日本語**で記述する

## プロジェクト概要

バンドサイト。Notion を CMS として利用し、Cloudflare Workers + R2 でキャッシュ・配信、React Router でSSRレンダリングする構成。

```
Notion → Workers/notion.ts → Workers/content.ts → R2 (posts.json / post/{slug}.json / images/*) → React Router loader → ブラウザ
```

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React 19 + React Router 7 (SSR) |
| バックエンド | Hono 4 on Cloudflare Workers |
| CMS | Notion API (@notionhq/client) |
| Markdown変換 | notion-to-md → marked |
| キャッシュ | Cloudflare R2 |
| スタイル | Tailwind CSS 4 + @tailwindcss/typography |
| リンター/フォーマッター | Biome |

## ディレクトリ構成

```
app/
  routes/          # React Router ファイルベースルート
    _index.tsx     # ホームページ
    blog.tsx       # ブログレイアウト
    blog._index.tsx # ブログ一覧（Stale-While-Revalidate）
    blog.$slug.tsx  # 記事詳細（Stale-While-Revalidate + Notion更新検知）
  root.tsx         # ルートレイアウト
workers/
  app.ts           # Hono メインエントリー
  notion.ts        # Notion API 取得
  cache.ts         # R2 キャッシュ操作
  content.ts       # Markdown→HTML変換・画像処理
```

## コマンド

```bash
npm run dev        # ローカル開発サーバー起動
npm run build      # プロダクションビルド
npm run deploy     # ビルド → Cloudflare Workers デプロイ
npm run typecheck  # 型チェック（wrangler types 生成 → tsc）
npm run format     # Biome でフォーマット・Lint自動修正
```

コード変更後は必ず `npm run typecheck` を実行する。

## コードスタイル

Biome の設定に従う（biome.json 参照）。

- インデント: タブ
- クォート: ダブルクォート（`""`）
- インポートは自動整理（organizeImports）
- ES Modules（`import/export`）を使用。CommonJS（`require`）は使わない

## アーキテクチャ上の重要な注意点

### キャッシュ戦略（Stale-While-Revalidate）
- まずキャッシュを返し、TTL（5分）切れなら裏で非同期更新
- `workers/cache.ts` の `POSTS_TTL_MS` が有効期間
- 開発環境（`CACHE_BUCKET` 未設定時）は Notion API を直接呼ぶ

### Notion 更新検知
- `last_edited_time` でキャッシュと比較し、差分があれば HTML 再生成
- 変更なければ `cachedAt` のみ更新（TTL延長）

### 画像処理
- Notion 画像URLは期限付きのため、Workers で fetch → SHA256 ハッシュキーで R2 に永続保存
- `content.ts` の `fetchAndCacheImage` が担当
- フロントエンドには `/api/images/{hash}` で配信（1年不変キャッシュ）

### 環境変数（シークレット）
- `NOTION_TOKEN`: Notion API キー
- `NOTION_DATA_SOURCE_ID`: Notion データベース ID
- これらは `wrangler secret put` で設定する。コードにハードコードしない

## ワークフロー

1. **機能追加・修正前**: Plan Mode で関連ファイルを確認してから実装する
2. **実装後**: `npm run typecheck` && `npm run format` を通してからコミット
3. **コミットメッセージ**: 日本語で変更の「なぜ」を記述する
4. **デプロイ**: `npm run deploy` 前に必ずビルドが通ることを確認する
