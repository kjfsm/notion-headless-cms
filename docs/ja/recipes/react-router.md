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

binding が未設定でも `cloudflarePreset` は空のキャッシュ配列を返すため、キャッシュ無しで起動できる。

## CMS ファクトリ

`cloudflarePreset({ env, ctx })` で KV + R2 + `waitUntil` が一括配線される。

```ts
// app/lib/cms.ts
import { createCMS } from "@notion-headless-cms/client";
import { cloudflarePreset } from "@notion-headless-cms/client/cloudflare";
import { schema } from "../generated/nhc";

export interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    schema,
    token: env.NOTION_TOKEN,
    // content: "react" は blocks 取得戦略。loader で notionBlocks() を React 描画する。
    // 大きなページで CF Free のサブリクエスト上限が厳しいときは content: "html" を検討。
    content: "react",
    // ctx を渡さないと SWR のバックグラウンド更新が打ち切られ、古いキャッシュが残る。
    runtime: cloudflarePreset({ env, ctx }),
    collections: {
      posts: { published: ["公開済み"] },
    },
    // ogp は省略可。react モードでは既定オン（下記参照）。
  });
}
```

### リンクプレビュー（OGP）

`content: "react"` では bookmark / link_preview / embed ブロックの OGP（タイトル・説明・OG 画像）取得が **既定でオン**になり、`<NotionRenderer>` が Notion 本家風のリンクカードを描画する。

- メタデータはブロック取得時にサーバー側で取得され、**既存のドキュメントキャッシュに同梱**されるため、専用のキャッシュ設定は不要。
- OG 画像は**既定で元 URL のままブラウザが直接読み込む**（R2 等への永続キャッシュなし）。`<img loading="lazy">` で遅延読み込みされるため、初回表示が遅れても本文描画はブロックしない。
- 無効化したいときは `ogp: false`。OG 画像も R2 等へ永続化したい上級者は `ogp: { enabled: true, imageCache }` を渡す。

```ts
createCMS({ schema, token, content: "react", ogp: false }); // OGP を切る
```

> リンクを多用するページでは bookmark / link_preview ごとに外部 fetch が増える。CF Free のサブリクエスト上限（50/invocation）に近づく場合は `ogp: false` を検討する。初回（キャッシュミス）のみで、以降は SWR ドキュメントキャッシュが効く。

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
  route("/api/images/:hash", "routes/images.ts"),       // 画像プロキシ
  route("/api/posts/:slug/check", "routes/check.ts"),   // 再検証ポーリング用
] satisfies RouteConfig;
```

| ルート | 役割 |
|---|---|
| `/` (`home.tsx`) | `cms.posts.list()` で一覧 |
| `/posts/:slug` (`post.tsx`) | `cms.posts.find()` → `notionBlocks()` → React 描画 |
| `/api/images/:hash` (`images.ts`) | `cms.getCachedImage()` を返す画像配信 |
| `/api/posts/:slug/check` (`check.ts`) | `cms.posts.peekVersion()`（KV ポーリング再検証） |

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
import { NotionRevalidator, Renderer } from "@notion-headless-cms/client/react";
import { data } from "react-router";
import { makeCms } from "../lib/cms";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  const post = await cms.posts.find(params.slug ?? "");
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
      <NotionRevalidator
        poll={{ url: `/api/posts/${item.slug}/check`, version: item.lastEditedTime }}
      />
      <h1>{item.title ?? item.slug}</h1>
      <Renderer blocks={blocks} />
    </article>
  );
}
```

## 表示の自動更新（`<NotionRevalidator>`）

`@notion-headless-cms/client/react` の `NotionRevalidator` は内部で
`useRevalidator()` を呼び、loader を再走させる。2 つのモードがある。

### マウント時に一度だけ再検証

```tsx
<NotionRevalidator />
```

サーバ側 `waitUntil` が前回訪問時に KV を最新化済みなら、再マウント時に新内容が即時返る。

### KV ポーリングで確実に最新化

ポーリング先は専用ルートを自前で書く（`peekVersion` を返すだけ）か、`cms.handler()`
の versions ルートをそのまま使える。

```ts
// app/routes/check.ts — 自前で書く場合
export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return Response.json(await cms.posts.peekVersion(params.slug ?? ""));
}
```

`cms.handler()` を 1 つの splat ルートにマウント済みなら、画像プロキシ・Webhook と同じ口で
`GET {basePath}/versions/:collection/:slug` が `peekVersion` を返す。専用ルートは不要:

```tsx
// 既定 basePath /api/cms。app/routes/api.cms.$.ts に cms.handler() をマウント
<NotionRevalidator
  poll={{ url: `/api/cms/versions/posts/${item.slug}`, version: item.lastEditedTime }}
/>

// 自前 check.ts を使う場合
<NotionRevalidator
  poll={{ url: `/api/posts/${item.slug}/check`, version: item.lastEditedTime }}
/>
```

ポーリングは `notionUpdatedAt` の変化（更新あり → revalidate）または `cachedAt` の変化
（確認完了・更新なし → 停止）を検出した時点で自動停止する。既定タイムアウトは 30 秒。

`versions`（KV のみの受動ポーリング）に対し、`GET|POST {basePath}/check/:collection/:slug?v={version}`
は Notion を実照会してその場でキャッシュ更新し `{ stale }` を返す能動版。即時に確実な更新確認を
したい場合に使う（`cms.[collection].check()` をハンドラ経由で呼ぶ。差分時はキャッシュ更新済みなので
loader 再実行で最新本文が得られる）。

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

`swr.ttlMs` は **指定しない** のが推奨（`cloudflarePreset` の既定挙動に従う）。

- KV キャッシュは期限なしで永続させ、リクエスト時は即時返却する。
- `waitUntil` 経由でバックグラウンドに Notion の `lastEditedTime` と照合する。
- 差分があれば KV を差し替え、コンテンツキャッシュを無効化する。差分が無ければ何もしない。

`ttlMs` を入れると期限切れ時にブロッキング再取得が走り、変更が無くても遅延の原因になる。

## 関連

- 動作する完全な例: [`examples/cloudflare-react-router/`](../../../examples/cloudflare-react-router/)
- Cloudflare Workers（非 React / Hono・Astro 等）: [`cloudflare-workers.md`](./cloudflare-workers.md)
- レンダラの選び方: [`../choosing-a-renderer.md`](../choosing-a-renderer.md)
