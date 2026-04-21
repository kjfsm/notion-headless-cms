# Examples

各フレームワークでの実装例です。フォルダをコピーして `.env` を設定するだけで動きます。

## 一覧

| フォルダ | ランタイム | フレームワーク | キャッシュ |
|---|---|---|---|
| [cloudflare-hono](./cloudflare-hono/) | Cloudflare Workers | Hono | R2 |
| [cloudflare-astro](./cloudflare-astro/) | Cloudflare Workers | Astro (SSR) | R2 |
| [cloudflare-react-router](./cloudflare-react-router/) | Cloudflare Workers | React Router v7 | R2 |
| [cloudflare-sveltekit](./cloudflare-sveltekit/) | Cloudflare Workers | SvelteKit | R2 |
| [vercel-nextjs](./vercel-nextjs/) | Vercel (Edge/Node) | Next.js App Router | ISR |
| [node-express](./node-express/) | Node.js | Express | メモリ |

## 共通の Notion DB 設定

すべての example は以下のプロパティを持つ Notion データベースを想定しています。プロパティ名は `defineMapping` / `properties` で自由に変更可能ですが、デフォルトのマッパー（`Slug` / `Status` / `CreatedAt`）をそのまま使う場合は以下の名前で作成してください。

| プロパティ名 | タイプ | 説明 |
|---|---|---|
| Slug | リッチテキスト | URL スラッグ（例: `my-first-post`） |
| Title | タイトル | 記事タイトル |
| Status | セレクト | `公開` / `下書き` |
| PublishedAt | 日付 | 公開日 |
| Tags | マルチセレクト | タグ |
| Description | リッチテキスト | 概要文 |

## セットアップ手順（共通）

```bash
# 1. フォルダをコピー
cp -r examples/cloudflare-hono my-blog
cd my-blog

# 2. 依存関係をインストール
pnpm install   # または npm install / yarn install

# 3. 環境変数を設定
cp .env.example .env
# .env を編集して NOTION_TOKEN と NOTION_DATA_SOURCE_ID を入力

# 4. 開発サーバーを起動
pnpm dev
```

## Cloudflare R2 のセットアップ（Cloudflare 系 example）

```bash
# R2 バケットを作成
wrangler r2 bucket create nhc-example-cache

# wrangler.toml の bucket_name を更新
# [[r2_buckets]]
# binding = "CACHE_BUCKET"
# bucket_name = "nhc-example-cache"

# シークレットを設定
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DATA_SOURCE_ID
```

## 環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `NOTION_TOKEN` | Notion API インテグレーションのシークレット | ✓ |
| `NOTION_DATA_SOURCE_ID` | Notion データベースの ID | ✓ |
| `REVALIDATE_SECRET` | Webhook 再検証用シークレット（vercel-nextjs のみ） | - |

## Node.js バージョン

examples は Node.js 24 以上を前提としています（`astro` は Node 22.12+、本体パッケージは `engines.node: ">=24"`）。
