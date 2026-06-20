---
title: Cloudflare Workers
description: Workers + R2 + KV の構成
category: レシピ
order: 3
---

# Cloudflare Workers + R2 + KV レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-source \
  @notion-headless-cms/cache \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

## スキーマ生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `nhc.schema.ts` を Workers から読み込む。

## wrangler.toml の設定

推奨 binding 名は `DOC_CACHE` (KV) と `IMG_BUCKET` (R2)。

```toml
[[kv_namespaces]]
binding = "DOC_CACHE"
id = "xxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "nhc-images"
```

## シークレット

```bash
wrangler secret put NOTION_TOKEN
```

## Workers のコード

`cache` グループに `kvCache` / `r2Cache` を役割別に渡すと、KV を document、R2 を image に割り当てつつ `waitUntil` を配線できる。

```ts
import { createCMS, memoryCache } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
import { schema } from "./generated/nhc.schema";

interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

function makeCms(env: Env, ctx: ExecutionContext) {
  return createCMS({
    notion: {
      schema,
      token: env.NOTION_TOKEN,
      collections: { posts: { published: ["公開済み"] } },
    },
    render: { content: "html" },
    cache: {
      // KV を document、R2 を image に割り当てる。
      // DOC_CACHE は optional 型なので未設定時は memoryCache() へフォールバック。
      document: env.DOC_CACHE ? kvCache({ namespace: env.DOC_CACHE }) : memoryCache(),
      image: r2Cache({ bucket: env.IMG_BUCKET }),
      // waitUntil を渡さないと SWR の bg 更新が打ち切られて古いキャッシュが残る。
      waitUntil: (p) => ctx.waitUntil(p),
    },
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const cms = makeCms(env, ctx);
    const url = new URL(request.url);

    // 画像配信 (core の handler でまとめてさばく)
    if (url.pathname.startsWith("/api/images/")) {
      return cms.handler()(request);
    }

    // 一覧
    if (url.pathname === "/posts") {
      return Response.json(await cms.posts.list());
    }

    // 単一アイテム
    const slug = url.pathname.replace("/posts/", "");
    const post = await cms.posts.find(slug);
    if (!post) return new Response("Not Found", { status: 404 });

    return new Response(await post.html(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

## content モードと subrequest 制限の選び方

Cloudflare Workers **Free プラン**は 1 invocation あたり 50 サブリクエストの上限がある。
`content` モードはこの制限に直結するので、ページ規模で選ぶ。

| content | 取得戦略 | Notion API 消費 | 向き |
|---|---|---|---|
| `"html"` | Markdown export API（1 リクエスト） | **ページあたり 1** | 大きい / ネストが深いページ、CF Free |
| `"react"` | blocks.children.list（再帰） | ブロック階層に比例（数十〜） | React 高忠実度描画、Paid / 小〜中ページ |

- まず `content: "html"` を既定にし、React で callout / column / embed を厳密に描画したいときだけ `"react"` にする。
- `"react"` で大きなページを扱い subrequest が逼迫するなら、**KV プリウォーム**（`@notion-headless-cms/client/cloudflare` の `restKvCache` / `readRestKvEnv`）を併用し、Workers は KV（内部リクエスト）だけ読む構成にする。
- カスタムブロックハンドラや OGP・並列度（`concurrency`）の調整が必要なら、escape hatch（`createClient` + `notionSource({ fetch: blocksFetcher({ concurrency, blocks, ogp }) })`）で個別に組み立てる。既定 `concurrency` は 3（Notion の 3 req/s に合わせた値）。

## キャッシュ戦略: 永続キャッシュ + 更新検知

`swr.staleBlockMs` は**指定せず既定に任せる**のが推奨。Notion webhook secret（`notion.webhookSecret`）を設定して push 経路を稼働させると `staleBlockMs` の既定が無期限になり、キャッシュは常に即表示される（更新は webhook で届くため、古さによるブロッキング再取得が起きない）。

- KV キャッシュは期限なしで永続させる。
- リクエスト時はキャッシュを即時返却し、`waitUntil` 経由でバックグラウンドで Notion の `lastEditedTime` と照合する（照会は `recheckWindowMs`（既定 30 秒）で coalescing され、短時間に集中するアクセスは 1 回にまとまる）。
- 差分があれば KV を差し替え、コンテンツキャッシュを無効化する。
- 差分が無ければ何もしない（無駄な fetch なし）。

`staleBlockMs` を短く入れると閾値超過時にブロッキング再取得が走るため、変更が無くても遅延の原因になる（webhook 稼働時は既定の無期限のままでよい）。

## クライアント側の表示更新

Notion を更新したとき、画面を**静かに切り替える**には:

### React Router v7

React で描画する場合（loader + `<Renderer>` + `<NotionRevalidator>`）は専用レシピにまとめた。
→ [`react-router.md`](./react-router.md)

### Hono / Astro / Express など素 HTML

`notionRevalidatorScript()` をテンプレートに埋め込む。タブ可視化で `location.reload()` する `<script>` 文字列を返す。

```ts
import { raw, html as h } from "hono/html";
import { notionRevalidatorScript } from "@notion-headless-cms/core/html";

c.html(h`<!doctype html>...
  ${raw(notionRevalidatorScript())}
  </body></html>`);
```

```astro
---
import { notionRevalidatorScript } from "@notion-headless-cms/core/html";
---
<Fragment set:html={notionRevalidatorScript()} />
```

サーバ側の `waitUntil` が前回訪問時に KV を最新化済みなので、再ロード時は新内容が即時返る。クエリも別 API への fetch も発生しない。

## 個別の binding をカスタマイズしたい場合

`createCMS` の `cache` グループの代わりに、低レベル `createClient` でアダプタ配列を直接組み立てることもできる。

```ts
import {
  cloudflareCache,
  kvCache,
  r2Cache,
} from "@notion-headless-cms/cache/cloudflare";

createClient({
  sources: { notion: notionSource({ schema, token: env.NOTION_TOKEN }) },
  // KV + R2 のショートカット (prefix 指定可)
  cache: cloudflareCache(
    { docCache: env.DOC_CACHE, imgBucket: env.IMG_BUCKET },
    { prefix: "blog:" },
  ),
  // または個別に:
  // cache: [kvCache({ namespace: env.MY_KV }), r2Cache({ bucket: env.MY_R2 })],
  waitUntil: (p) => ctx.waitUntil(p),
});
```

binding が未設定なら該当アダプタは省略され、キャッシュなしで動作する。

## キャッシュなしで動かす（ローカル開発）

`.dev.vars` に `NOTION_TOKEN` だけ書けば `wrangler dev` で動く。
KV / R2 binding が未設定でも、`document` を `memoryCache()` にフォールバックさせておけば（上記 `makeCms` の例）メモリキャッシュで起動でき、例外にはならない。

```
# .dev.vars
NOTION_TOKEN=secret_xxx
```

## Webhook によるキャッシュ無効化

`cms.handler({ webhookSecret })` にリクエストを投げると、DataSource の `parseWebhook` が `{ collection, slug? }` を返し、該当スコープが `cache.invalidate()` される。`notion-source` には既定の `parseWebhook` 実装が入っている。

ルートは `POST {basePath}/revalidate/:collection`（既定 `basePath` なら `/revalidate/posts`）。collection は URL から決まる。

```ts
const handler = cms.handler({ webhookSecret: env.NOTION_WEBHOOK_SECRET });
// POST /api/revalidate/posts?secret=xxx
if (url.pathname.startsWith("/api/revalidate/")) {
  return handler(request);
}
```

`notion-source` の既定 `parseWebhook` の挙動:

- **シークレット検証**: `webhookSecret` を渡した場合、リクエストは `?secret=<値>` クエリ / `X-Webhook-Secret` ヘッダ / `Authorization: Bearer <値>` のいずれかで一致させる。Notion の Automation Webhook は送信先 URL を自由に設定できるためクエリが実用的。不一致は `webhook/signature_invalid`（401）。
- **対象の絞り込み**: リクエスト body が `{ "slug": "..." }` を含めばそのスラッグだけ、無ければコレクション全体を無効化する。不正な JSON は `webhook/payload_invalid`（400）。
- **独自方式**: Notion の HMAC 署名検証など別方式が必要なら、`DataSource.parseWebhook` を自前実装で差し替える。

## Notion 公式 webhook で「ページ更新時」に自動ウォーム（初回アクセス高速化）

キャッシュが空のコールドスタートは Notion API を同期で叩くため初回が遅い。**Notion の integration「Webhooks」（無料プランでも利用可）**を使うと、ページ更新イベントを受けて該当ページだけをサーバー側で温め直せる。`createCMS` に検証トークンを渡すだけで `cms.handler()` が `POST {basePath}/notion-webhook` を自動マウントする。

```ts
const cms = createCMS({
  notion: {
    schema,
    token: env.NOTION_TOKEN,
    collections: { posts: { published: ["公開済み"] } },
    webhookSecret: env.NOTION_WEBHOOK_SECRET, // ← これだけで /notion-webhook が有効化
  },
  render: { content: "react" },
  cache: {
    document: kvCache({ namespace: env.DOC_CACHE }),
    image: r2Cache({ bucket: env.IMG_BUCKET }),
    waitUntil: (p) => ctx.waitUntil(p), // 応答後にウォームを完走させる
  },
});
// 既に cms.handler() を /api/* 等に配線していれば追加コードは不要
```

セットアップ手順:

1. デプロイ後、Notion の integration 設定 → Webhooks で `https://<site>/api/cms/notion-webhook`（`basePath` に合わせる）を登録する。
2. Notion が一度だけ送る `verification_token` を、エンドポイントのレスポンス本文（`{ verification_token }` を echo）または `wrangler tail` のログで確認する。
3. その値を `wrangler secret put NOTION_WEBHOOK_SECRET` に設定し、Notion UI 側の Verify に貼って有効化する（再デプロイで反映）。
4. 対象 DB のページを編集すると `page.content_updated` 等が届き、`entity.id` → slug を `findById`（`pages.retrieve` + parent data source 一致チェック）で解決して `cache.prime()` 相当の単件ウォームが走る。

> 公式 webhook の payload は page id のみ（slug を含まない）。`findById` で fresh に解決するため、一覧キャッシュが stale でも新規公開ページを取りこぼさない。デプロイ直後の「一度も編集していない既存ページ」は対象外なので、必要なら `cms.<collection>.cache.warm()` で一度シードする。

## 画像配信ルート

Notion 画像 URL は期限付きのため、core 側で SHA256 ハッシュキーに変換して R2 に永続保存する。レンダリング後の HTML 内の `<img>` は `/api/images/<hash>` に書き換わるので、同じハッシュを提供するルートを用意する。

`cms.handler()` がこれを自動でさばくため、ほぼ何も書かなくてよい。

## 構造型による型依存

`cloudflareCache` / `cloudflarePreset` が受ける binding は構造型 (`R2BucketLike` / `KVNamespaceLike`) を要求するため、`@cloudflare/workers-types` への実依存はない。テストではモックに差し替え可能。
