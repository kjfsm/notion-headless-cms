---
title: React Router (Cloudflare Workers)
description: React Router v7 + Workers + R2 + KV で Notion を React として描画する
category: レシピ
order: 3
---

# React Router (Cloudflare Workers) レシピ

React Router v7（Framework mode）を Cloudflare Workers 上で動かし、loader で Notion から
取得したブロックを `react-renderer` で React として描画する構成。完全に動く実装は
[`examples/cloudflare-react-router/`](../../../examples/cloudflare-react-router/) にある。

このレシピのゴール:

- loader で `cms.posts.find()` / `cms.posts.list()` を呼ぶ
- `post.notionBlocks()` を `<Renderer blocks={...} />` に渡して React 描画する
- Notion 更新を `<NotionRevalidator>` で静かに画面反映する
- 画像プロキシ・KV+R2 キャッシュを配線する

## インストール

```bash
pnpm add @notion-headless-cms/client
pnpm add @notionhq/client zod notion-to-md react react-dom react-router
pnpm add -D @notion-headless-cms/cli
```

## スキーマ生成

```bash
npx nhc init
# nhc.config.ts を編集（dbName / slugField / statusField）
NOTION_TOKEN=secret_xxx npx nhc generate
```

生成された `app/generated/nhc.ts` を loader 側から import する。

## wrangler.toml

推奨 binding は `DOC_CACHE`（KV / ドキュメントキャッシュ）と `IMG_BUCKET`（R2 / 画像）。

```toml
[[kv_namespaces]]
binding = "DOC_CACHE"
id = "xxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "nhc-images"
```

```bash
wrangler secret put NOTION_TOKEN   # 本番
# ローカルは .dev.vars に NOTION_TOKEN=secret_xxx を書く（wrangler dev が自動読込）
```

binding が未設定でも `document` を `memoryCache()` へフォールバックさせておけば、キャッシュ無しで起動できる。

## CMS ファクトリ

`cache` グループに `kvCache` / `r2Cache` を役割別に渡すと、KV を document、R2 を image に割り当てつつ `waitUntil` を配線できる。

```ts
// app/lib/cms.ts
import { createCMS, memoryCache } from "@notion-headless-cms/client";
import { kvCache, r2Cache } from "@notion-headless-cms/client/cloudflare";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    notion: {
      schema,
      token: env.NOTION_TOKEN,
      collections: {
        posts: { published: ["公開済み"] },
      },
    },
    render: {
      // content: "react" は blocks 取得戦略。loader で notionBlocks() を React 描画する。
      // 大きなページで CF Free のサブリクエスト上限が厳しいときは content: "html" を検討。
      content: "react",
      // ogp は省略可。react モードでは既定オン（下記参照）。
    },
    cache: {
      // KV を document、R2 を image に割り当てる。
      // DOC_CACHE は optional 型なので未設定時は memoryCache() へフォールバック。
      document: env.DOC_CACHE ? kvCache({ namespace: env.DOC_CACHE }) : memoryCache(),
      image: r2Cache({ bucket: env.IMG_BUCKET }),
      // waitUntil を渡さないと SWR のバックグラウンド更新が打ち切られ、古いキャッシュが残る。
      waitUntil: (p) => ctx.waitUntil(p),
    },
  });
}
```

### リンクプレビュー（OGP）

`content: "react"` では bookmark / link_preview / embed ブロックの OGP（タイトル・説明・OG 画像）取得が **既定でオン**になり、`<NotionRenderer>` が Notion 本家風のリンクカードを描画する。

- メタデータはブロック取得時にサーバー側で取得され、**既存のドキュメントキャッシュに同梱**されるため、専用のキャッシュ設定は不要。
- OG 画像は**既定で元 URL のままブラウザが直接読み込む**（R2 等への永続キャッシュなし）。`<img loading="lazy">` で遅延読み込みされるため、初回表示が遅れても本文描画はブロックしない。
- 無効化したいときは `render.ogp: false`。OG 画像も R2 等へ永続化したい上級者は `render.ogp: { enabled: true, imageCache }` を渡す。

```ts
// OGP を切る（notion / render を分けて渡す）
createCMS({
  notion: { schema, token, collections: { posts: { published: ["公開済み"] } } },
  render: { content: "react", ogp: false },
});
```

> リンクを多用するページでは bookmark / link_preview ごとに外部 fetch が増える。CF Free のサブリクエスト上限（50/invocation）に近づく場合は `render.ogp: false` を検討する。初回（キャッシュミス）のみで、以降は SWR ドキュメントキャッシュが効く。

## Workers エントリ

`createRequestHandler` の第 2 引数で `cloudflare: { env, ctx }` を渡すと、各 loader の
`context.cloudflare` から `env` / `ctx` にアクセスできる。

```ts
// workers/app.ts
import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, { cloudflare: { env, ctx } });
  },
} satisfies ExportedHandler<Env>;
```

## ルート定義

```ts
// app/routes.ts
import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/home.tsx"),
  route("/posts/:slug", "routes/post.tsx"),
  route("/api/cms/*", "routes/api.cms.$.ts"),           // cms.handler() を splat で配線（画像 / check / webhook）
] satisfies RouteConfig;
```

| ルート | 役割 |
|---|---|
| `/` (`home.tsx`) | `cms.posts.list()` で一覧 |
| `/posts/:slug` (`post.tsx`) | `cms.posts.find()` → `notionBlocks()` → React 描画 |
| `/api/cms/*` (`api.cms.$.ts`) | `cms.handler()`。画像プロキシ・`POST /check/:collection/:slug`（更新検知）・Webhook を一括配信 |

## 一覧ページ

```tsx
// app/routes/home.tsx
import { Link } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return { items: await cms.posts.list() };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <ul>
      {loaderData.items.map((post) => (
        <li key={post.slug}>
          <Link to={`/posts/${post.slug}`}>{post.title ?? post.slug}</Link>
        </li>
      ))}
    </ul>
  );
}
```

## 記事ページ（React 描画）

`post.notionBlocks()` が BlockObjectResponse ツリーを返す。`@notion-headless-cms/client/react`
の `Renderer` に渡すだけで shadcn/ui ベースのコンポーネントとして描画される。

```tsx
// app/routes/post.tsx
import { isReloadRequest } from "@notion-headless-cms/client";
import { NotionRevalidator, Renderer } from "@notion-headless-cms/client/react";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  // F5 等の明示リロード時のみ recheck ウィンドウを無視して最新化
  const post = await cms.posts.find(params.slug ?? "", { force: isReloadRequest(request) });
  if (!post) throw data("Not Found", { status: 404 });
  const blocks = await post.notionBlocks(); // NotionBlock[]（キャスト不要）
  return {
    blocks,
    item: { slug: post.slug, title: post.title, lastEditedTime: post.lastEditedTime },
  };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { blocks, item } = loaderData;
  return (
    <article>
      {/* collection と item だけで poll URL(/api/cms/check/...) と version を自動導出 */}
      <NotionRevalidator poll={{ collection: "posts", item }} />
      <h1>{item.title ?? item.slug}</h1>
      <Renderer blocks={blocks} />
    </article>
  );
}
```

## 表示の自動更新（`<NotionRevalidator>`）

`@notion-headless-cms/client/react` の `NotionRevalidator` はポーリングを行わない。内部で
`POST {basePath}/check/{collection}/{slug}` を叩き、`stale: true`（更新あり）のときだけ
`useRevalidator()` で loader を再走させる。既定トリガーは **mount** と **visibility（再フォーカス）**。

### 推奨: collection + item を渡す

```tsx
// URL(/api/cms/check/posts/:slug) と version(item.lastEditedTime) を自動導出
<NotionRevalidator poll={{ collection: "posts", item }} />

// slug + version を直接渡す形も可
<NotionRevalidator poll={{ collection: "posts", slug: item.slug, version: item.lastEditedTime }} />
```

`POST /check` は Notion を coalescing（`recheckWindowMs`）付きで実照会し、差分があればその場で
キャッシュを更新して `{ stale, version }` を返す。差分時はキャッシュ更新済みのため、`stale: true` を
受けた `NotionRevalidator` が loader を再走させれば最新本文が得られる。

### 定期チェックを足す / push 経路に切り替える

- 連続インターバルは既定なし。`poll.intervalMs` を明示したときだけ定期チェックが加わる
  （`<NotionRevalidator poll={{ collection: "posts", item, intervalMs: 60_000 }} />`）。
- `realtime`（Durable Object / WebSocket）を設定すると push が主経路になり、ポーリングは停止する。

## 画像プロキシ

Notion 画像 URL は約 1 時間で失効するため、core が SHA256 ハッシュキーで R2 に永続保存し、
HTML/JSX 内の参照を `/api/images/<hash>` に書き換える。同じハッシュを返すルートを置くだけ。

```ts
// app/routes/images.ts
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/images";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const object = await cms.getCachedImage(params.hash ?? "");
  if (!object) return new Response("Not Found", { status: 404 });
  const headers = new Headers();
  if (object.contentType) headers.set("content-type", object.contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.data, { headers });
}
```

## キャッシュ戦略: 永続 KV + バックグラウンド更新検知

`cache.swr.staleBlockMs` は **指定せず既定に任せる** のが推奨。Notion webhook secret を設定して
push 経路を稼働させると `staleBlockMs` の既定が無期限になり、KV キャッシュは常に即表示される。

- KV キャッシュは期限なしで永続させ、リクエスト時は即時返却する。
- `waitUntil` 経由でバックグラウンドに Notion の `lastEditedTime` と照合する（照会は
  `recheckWindowMs`（既定 30 秒）で coalescing される）。
- 差分があれば KV を差し替え、コンテンツキャッシュを無効化する。差分が無ければ何もしない。

`staleBlockMs` を短く入れると閾値超過時にブロッキング再取得が走り、変更が無くても遅延の原因になる
（webhook 稼働時は既定の無期限のままでよい）。F5 等の明示リロードで最新化したいなら、loader 側で
`cms.posts.find(slug, { force: isReloadRequest(request) })` を使う（`isReloadRequest` は
`@notion-headless-cms/client` から export）。

## 関連

- 動作する完全な例: [`examples/cloudflare-react-router/`](../../../examples/cloudflare-react-router/)
- Cloudflare Workers（非 React / Hono・Astro 等）: [`cloudflare-workers.md`](./cloudflare-workers.md)
- レンダラの選び方: [`../choosing-a-renderer.md`](../choosing-a-renderer.md)
