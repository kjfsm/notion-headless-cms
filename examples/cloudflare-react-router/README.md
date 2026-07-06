# cloudflare-react-router

React Router v7（Framework mode）+ Cloudflare Workers + R2 + D1 で Notion を
ヘッドレス CMS として使う最小フルスタック例。loader で取得した正規化ブロックを
`react-renderer` で React として描画し、`useNotionRevalidate` で更新を静かに反映する。

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

# 4. 開発サーバー
pnpm dev
```

Notion 側ではインテグレーションを作成し、対象 DB に接続してトークンを取得しておく。
`app/schema.ts` の `dataSourceId` を対象 DB の data source ID に書き換える（`defineCollection`
で TS ファーストにスキーマを書く運用のため、codegen は行わない）。

## ルート構成

| ルート         | ファイル                | 役割                                                                                                                      |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/`            | `app/routes/home.tsx`   | `cms.posts.list()` で記事一覧。`useNotionRevalidate()` で mount / 再フォーカス時に再取得                                  |
| `/posts/:slug` | `app/routes/post.tsx`   | `cms.posts.find(slug)` → `denormalizeBlocks`/`toPageLinkMap` → `<NotionRenderer>` で React 描画 + `useNotionRevalidate()` |
| `/api/cms/*`   | `app/routes/api.cms.ts` | `cms.fetch(request)` に委譲。画像プロキシ（`/api/cms/images/:hash`）・Webhook（`/api/cms/webhook`）をまとめて処理         |
| `/api/warm`    | `app/routes/warm.ts`    | `ensureSynced()` で同期を完了させ、進捗状態を返す手動トリガー（action）                                                   |

CMS の生成は `app/lib/cms.ts` の `makeCms(env, ctx)` に集約。`workers/app.ts` が
`createRequestHandler` で `cloudflare: { env, ctx }` を各 loader に渡す。

## 同期とキャッシュ

`makeCms` は `scheduler: createNodeSyncScheduler()`（setTimeout ベース、Durable Object
不要）を使う。同期カーソルは Worker isolate 内の in-memory 状態のため isolate が
入れ替わると失われるが、Notion の差分クエリは既存 version と一致すれば打ち切るため、
再同期は「軽い再検証クエリ 1 回」で済む（`app/lib/cms.ts` の `ensureSynced()` が
`cms.sync.kick()` を cursor が尽きるまでループし、各 loader の先頭で呼ばれる）。

D1（`DB`）/R2（`IMG_BUCKET`）はマテリアライズ済みエントリの永続ストアで、
`find`/`list`/`search` はここだけを読む（Notion API は同期時のみ叩く）。

## 表示の更新

`useNotionRevalidate()`（`@notion-headless-cms/react-renderer/router`）を引数なしで
呼ぶと、mount 時と再フォーカス（visibilitychange）時に `useRevalidator()` で loader を
再走させる。裏で `ensureSynced()` が同期を進めているため、再フォーカス時には最新の
D1/R2 スナップショットが返る。

WebSocket によるリアルタイム push（Durable Object 経由）は行わない。必要であれば
`examples/cloudflare-hono` の `SyncCoordinatorDO`/`RealtimeHubDO` 構成を参照。

## スクリプト

| コマンド          | 内容                                                    |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | React Router 開発サーバー                               |
| `pnpm build`      | 本番ビルド                                              |
| `pnpm check`      | `tsc` + build + `wrangler deploy --dry-run`（構成検証） |
| `pnpm deploy`     | Workers へデプロイ                                      |
| `pnpm cf-typegen` | `wrangler types` + `react-router typegen`               |

## デプロイ（Cloudflare）

```bash
# D1（ドキュメントインデックス）と R2（画像）を作成し、wrangler.toml の database_id / bucket_name を更新
wrangler d1 create nhc-example-cloudflare-react-router
wrangler r2 bucket create nhc-example-cache
wrangler r2 bucket create nhc-example-cache-preview

# ランタイムシークレット
wrangler secret put NOTION_TOKEN

pnpm deploy
```

GitHub App / GitHub Actions による自動デプロイは [`examples/README.md`](../README.md) を参照。

## 初回同期を今すぐ進める

デプロイ直後の cold isolate は `find`/`list` の初回アクセス時に同期が始まる
（`ensureSynced()` が loader 内で呼ばれるため）。事前に完了させたい場合は
`POST /api/warm` を叩く。

```bash
curl -X POST https://<your-worker>.workers.dev/api/warm
```
