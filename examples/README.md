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

# 4. スキーマを生成（Notion DB の構造変更時に再実行）
pnpm generate

# 5. 開発サーバーを起動
pnpm dev
```

> モノレポのルートで `pnpm generate` を実行すると、`examples/*` 全部の `nhc generate` を一括で走らせることもできます。

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

## デプロイ（Cloudflare 系 example）

`cloudflare-hono` / `cloudflare-astro` / `cloudflare-react-router` / `cloudflare-sveltekit` は、以下の **2 系統** からデプロイ方式を選べる。どちらか一方を有効化する（両方有効化すると同じコミットで二重デプロイになる）。

| 方式 | トリガ | 設定場所 | おすすめ |
|---|---|---|---|
| A. **Cloudflare GitHub App**（Workers Builds） | main への push を Cloudflare 側で自動検出 | Cloudflare Dashboard | 個人/小規模、設定が最少 |
| B. **GitHub Actions** | `workflow_dispatch` で手動トリガ | `.github/workflows/deploy-examples-cloudflare.yml` | 組織で監査ログ・承認フローを残したい場合 |

### 共通の事前準備

```bash
# KV（ドキュメントキャッシュ用）— 出力された id を該当 example の wrangler.toml の
# [[kv_namespaces]].id に貼り付ける
wrangler kv namespace create DOC_CACHE

# R2（画像キャッシュ用）
wrangler r2 bucket create nhc-example-cache
wrangler r2 bucket create nhc-example-cache-preview  # react-router / sveltekit / hono のみ
```

Notion 側で Integration を作成し、対象 DB にコネクトしてシークレット (`secret_xxx`) を取得しておく。

### 方式 A: Cloudflare GitHub App（推奨・最少構成）

各 example の `wrangler.toml` に `[build].command` が記載されているため、Cloudflare Dashboard 側でビルドコマンドの設定は不要（空のままで OK）。

1. Cloudflare Dashboard > Workers & Pages > **Create > Workers > Connect to Git**
2. GitHub リポジトリと該当 example のディレクトリ（例: `examples/cloudflare-react-router`）を指定
3. **Settings > Variables and Secrets**:
   - **Build variables** に `NOTION_TOKEN`（`nhc generate` 用）と `NODE_VERSION=24`（Cloudflare デフォルトは Node 22 で engines 警告が出るため）
   - **Secrets** に `NOTION_TOKEN`（Worker ランタイム用）
4. main への push で自動ビルド → デプロイ

> Build 時用とランタイム用は別枠なので**両方**に登録する。
> Dashboard で **Build command を明示的に設定すると wrangler.toml の `[build]` を上書きする**ので、空のままにする運用を推奨（toml を真の source of truth にする）。
> `react-router` example は `@cloudflare/vite-plugin` の警告「`[build]` is ignored when using Vite」が出るが、これは vite build 実行中の話で Workers Builds のビルドフェーズでは `[build].command` が使われる。

### 方式 B: GitHub Actions

1. Cloudflare Dashboard > **My Profile > API Tokens > Create Token** で `Edit Cloudflare Workers` テンプレートからトークンを発行
2. リポジトリの **Settings > Environments > New environment** で `cloudflare-examples` を作成し、以下を Secrets に登録:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `NOTION_TOKEN`
3. GitHub の **Actions** > **Deploy examples cloudflare** > **Run workflow** から:
   - `example` で対象を選択（`all` で 4 つ並列デプロイ）
   - `dry-run` を有効化すると `wrangler deploy --dry-run` のみ実行（構成検証用）

### CI と Cloudflare GitHub App を同時有効化したい場合

`deploy-examples-cloudflare.yml` は `workflow_dispatch` のみのため自動 push では起動せず、Cloudflare GitHub App と共存できる。手動で `--dry-run` 検証だけ走らせ、本番デプロイは GitHub App に任せる、といった併用が可能。

## 環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `NOTION_TOKEN` | Notion API インテグレーションのシークレット | ✓ |
| `NOTION_DATA_SOURCE_ID` | Notion データベースの ID | ✓ |
| `REVALIDATE_SECRET` | Webhook 再検証用シークレット（vercel-nextjs のみ） | - |

## Node.js バージョン

examples は Node.js 24 以上を前提としています（`astro` は Node 22.12+、本体パッケージは `engines.node: ">=24"`）。
