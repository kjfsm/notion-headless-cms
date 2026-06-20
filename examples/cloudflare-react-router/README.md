# cloudflare-react-router

React Router v7（Framework mode）+ Cloudflare Workers + R2 + KV で Notion をヘッドレス CMS
として使う最小フルスタック例。loader で取得した Notion ブロックを `react-renderer` で React
として描画し、`<NotionRevalidator>` で更新を静かに反映する。

関連ドキュメント: [`docs/ja/recipes/react-router.md`](../../docs/ja/recipes/react-router.md)

## セットアップ

```bash
# 1. フォルダをコピー
cp -r examples/cloudflare-react-router my-blog && cd my-blog

# 2. 依存をインストール
pnpm install

# 3. ローカル用シークレットを設定（git 管理外）
cp .dev.vars.example .dev.vars
#   .dev.vars に NOTION_TOKEN=ntn_xxx を記入。
#   DB 名を変えたい場合は DB_NAME も設定（既定 "ブログ記事DB"）。

# 4. スキーマ生成（Notion DB 構造の変更時に再実行）
pnpm generate

# 5. 開発サーバー
pnpm dev
```

Notion 側ではインテグレーションを作成し、対象 DB に接続してトークンを取得しておく。
DB は `nhc.config.ts` の `dbName`（既定 "ブログ記事DB"）で検索され、ID が自動解決される。

## ルート構成

| ルート | ファイル | 役割 |
|---|---|---|
| `/` | `app/routes/home.tsx` | `cms.posts.list()` で記事一覧 |
| `/posts/:slug` | `app/routes/post.tsx` | `cms.posts.find()` → `notionBlocks()` → `<Renderer>` で React 描画 + `<NotionRevalidator poll>` |
| `/api/cms/*` | `app/routes/api.cms.ts` | `cms.handler()` に委譲。画像プロキシ(`/api/cms/images/:hash`)・更新検知(`POST /api/cms/check/:collection/:slug?v=`)・Webhook(`/api/cms/revalidate/:collection`) をまとめて処理 |
| `/api/warm` | `app/routes/warm.ts` | `cms.posts.cache.warm()` で全記事を事前キャッシュ（action） |

CMS の生成は `app/lib/cms.ts` の `makeCms(env, ctx)` に集約。`workers/app.ts` が
`createRequestHandler` で `cloudflare: { env, ctx }` を各 loader に渡す。

## スクリプト

| コマンド | 内容 |
|---|---|
| `pnpm dev` | React Router 開発サーバー |
| `pnpm generate` | `nhc generate`（`app/generated/nhc.ts` を再生成） |
| `pnpm build` | 本番ビルド |
| `pnpm check` | `tsc` + build + `wrangler deploy --dry-run`（構成検証） |
| `pnpm deploy` | Workers へデプロイ |
| `pnpm warm` | `scripts/warm-kv.ts`。Node.js から全記事を KV にプリウォーム（後述） |
| `pnpm cf-typegen` | `wrangler types` + `react-router typegen` |

`scripts/check-render.ts` は CI 用の描画スモークチェック。

## デプロイ（Cloudflare）

```bash
# KV（ドキュメントキャッシュ）と R2（画像）を作成し、wrangler.toml の id / bucket_name を更新
wrangler kv namespace create DOC_CACHE
wrangler r2 bucket create nhc-example-cache
wrangler r2 bucket create nhc-example-cache-preview

# ランタイムシークレット
wrangler secret put NOTION_TOKEN

pnpm deploy
```

GitHub App / GitHub Actions による自動デプロイは [`examples/README.md`](../README.md) を参照。

## KV プリウォーム（Free プラン向け）

Workers Free はサブリクエストが 50 件/invocation に制限される。大きな Notion ページは
ブロックツリー取得だけで多数のリクエストを消費し、初回アクセスでタイムアウトしうる。
`pnpm warm` を Node.js から実行して全記事を KV に書き込んでおくと、Workers は KV から
読むだけになり Notion API を叩かない。

```bash
CLOUDFLARE_ACCOUNT_ID=xxx KV_NAMESPACE_ID=yyy CLOUDFLARE_API_TOKEN=zzz \
  NOTION_TOKEN=ntn_... pnpm warm
# もしくは .dev.vars に変数を書いて: pnpm env -- pnpm warm
```
