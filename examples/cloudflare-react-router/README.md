# cloudflare-react-router

React Router v7（Framework mode）+ Cloudflare Workers + R2 + KV + Durable Objects で
Notion をヘッドレス CMS として使う最小フルスタック例。loader で取得した正規化ブロックを
`react-renderer` で React として描画し、`useNotionRevalidate` の WebSocket push で更新を
静かに反映する。

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

| ルート | ファイル | 役割 |
|---|---|---|
| `/` | `app/routes/home.tsx` | `cms.posts.list()` で記事一覧。`useNotionRevalidate({ realtime: { collection: "posts" } })` で一覧チャンネルを購読 |
| `/posts/:slug` | `app/routes/post.tsx` | `cms.posts.find(slug)` → `denormalizeBlocks`/`toPageLinkMap` → `<NotionRenderer>` で React 描画 + `useNotionRevalidate({ realtime })` |
| `/api/cms/*` | `app/routes/api.cms.ts` | `cms.fetch(request)` に委譲。画像プロキシ（`/api/cms/images/:hash`）・WebSocket 更新通知（`/api/cms/realtime`）・Webhook（`/api/cms/webhook`）をまとめて処理 |
| `/api/warm` | `app/routes/warm.ts` | `cms.sync.kick()` を 1 回進め、進捗状態を返す手動トリガー（action） |

CMS の生成は `app/lib/cms.ts` の `makeCms(env, ctx)` に集約。`workers/app.ts` が
`createRequestHandler` で `cloudflare: { env, ctx }` を各 loader に渡し、`SyncCoordinatorDO`
（`app/lib/do.ts`）・`RealtimeHubDO`（`@notion-headless-cms/cms/cloudflare`）を re-export する。

## 同期（Durable Object で Notion アクセスを直列化）

読者用の stateless Worker は KV/R2 の読み取り（`find`/`list`）のみ行い、Notion API への
直列アクセスは `SyncCoordinatorDO` に一元化する（`makeCms` が `syncDelegate:
durableObjectSyncDelegate({ stub })` で転送する）。DO は alarm 発火のたびに `chunkSize` 件ずつ
自動で同期を進める（Free プランのサブリクエスト上限を超えないための設計）。

## 更新検知（Durable Object リアルタイム push）

`makeCms` は `realtime: durableObjectRealtime({ namespace: env.REALTIME_HUB })` を設定しており、
webhook 受信や同期完了の直後に `RealtimeHubDO` 経由で接続中クライアントへ version 同梱の
WebSocket push を行う。`useNotionRevalidate({ realtime: { collection, slug } })`（`<NotionRenderer>`
と同じ `@notion-headless-cms/react-renderer/router` から export）が `/api/cms/realtime` へ接続して
購読し、受信で `useRevalidator()` により loader を再走させる。

`onRealtimeUpgrade`（`app/lib/cms.ts`）が `/api/cms/realtime` への WebSocket アップグレードを
`RealtimeHubDO` の stub へ橋渡しする。DO は `wrangler.toml` の `durable_objects.bindings` と
`migrations` で登録している（`pnpm cf-typegen` で `Env` 型を再生成）。

## スクリプト

| コマンド | 内容 |
|---|---|
| `pnpm dev` | React Router 開発サーバー |
| `pnpm build` | 本番ビルド |
| `pnpm check` | `tsc` + build + `wrangler deploy --dry-run`（構成検証） |
| `pnpm deploy` | Workers へデプロイ |
| `pnpm cf-typegen` | `wrangler types` + `react-router typegen` |

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

## 初回同期を今すぐ進める（Free プラン向け）

`SyncCoordinatorDO` は alarm のたびに `chunkSize` 件ずつ自動で同期を進めるため、通常は
デプロイ後しばらく待てば全記事が KV/R2 に揃う。今すぐ進めたい場合は `POST /api/warm` を
`state.cursor` が `null` になるまで繰り返し叩く（1 リクエスト = DO 内 1 チャンク分の Notion
アクセスに抑えているため、Workers Free のサブリクエスト上限（50 件/invocation）を超えない）。

```bash
curl -X POST https://<your-worker>.workers.dev/api/warm
```
