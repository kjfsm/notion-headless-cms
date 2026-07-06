---
title: React Router (Cloudflare Workers)
description: React Router v7 + Workers + R2 + D1 で Notion を React として描画する
category: レシピ
order: 3
---

# React Router (Cloudflare Workers) レシピ

React Router v7（Framework mode）を Cloudflare Workers 上で動かし、loader で
`@notion-headless-cms/cms` から読み出した block を `@notion-headless-cms/react-renderer` で
React として描画する構成。完全に動く実装は
[`examples/cloudflare-react-router/`](../../../examples/cloudflare-react-router/) にある。

このレシピのゴール:

- loader で `cms.posts.find()` / `cms.posts.list()` を呼ぶ（D1/R2 を読むだけ、Notion API は呼ばない）
- `post.blocks` を `denormalizeBlocks()` で変換し `<NotionRenderer>` に渡す
- Notion 更新を `useNotionRevalidate()` で静かに画面反映する
- 画像プロキシ・OGP・Webhook を `cms.fetch()` 1 つで配信する

このサンプルは Worker isolate 内の `createNodeSyncScheduler()` で同期カーソルを保持する
（DO を使わない）最小構成。Notion アクセスを Durable Object に一元化したい場合は
[`cloudflare-workers.md`](./cloudflare-workers.md) の DO 構成を参照。

## インストール

```bash
pnpm add @notion-headless-cms/cms @notion-headless-cms/react-renderer @notion-headless-cms/sql @notionhq/client
pnpm add -D @notion-headless-cms/cli kysely-d1
```

## スキーマ定義

```ts
// app/schema.ts
import { defineCollection, defineSchema, prop } from "@notion-headless-cms/cms";

const posts = defineCollection({
  dataSourceId: "d8221462-5ae9-8396-bdac-8731f4ef685a",
  slug: "slug",
  properties: {
    title: prop.title(),
    slug: prop.richText(),
    status: prop.status(["下書き", "編集中", "公開済み"] as const),
    publishedAt: prop.date(),
    author: prop.select(),
  },
  statusProperty: "status",
  published: ["公開済み"],
  accessible: ["下書き", "編集中", "公開済み"],
});

export const schema = defineSchema({ posts });
```

## wrangler.toml

```toml
name = "my-app"
main = "./workers/app.ts"
compatibility_date = "2026-04-22"
compatibility_flags = ["nodejs_compat"]
assets = { directory = "./build/client" }

[[d1_databases]]
binding = "DB"
database_name = "my-app"
database_id = "xxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "my-app-cache"
```

```bash
wrangler secret put NOTION_TOKEN   # 本番
# ローカルは .dev.vars に NOTION_TOKEN=secret_xxx を書く（wrangler dev が自動読込）
```

## CMS ファクトリ

```ts
// app/lib/cms.ts
import { createCMS, createNodeSyncScheduler } from "@notion-headless-cms/cms";
import { r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";
import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly DB: D1Database;
  readonly IMG_BUCKET: R2Bucket;
}

/**
 * D1/R2 は永続化されるが、同期カーソル自体は Worker isolate 内の
 * `createNodeSyncScheduler()`（setTimeout ベース、Workers ランタイムでも動く）に
 * 保持するため isolate が入れ替わると失われる。差分クエリは既存 version と
 * 一致すれば打ち切るため、この場合の再同期は「再検証クエリ 1 回」で済み、
 * 変更の無いページを再マテリアライズすることはない。
 */
export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    schema,
    notion: { token: env.NOTION_TOKEN },
    stores: {
      index: d1IndexStore(env.DB, schema),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    scheduler: createNodeSyncScheduler(),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}

/**
 * cursor が尽きるまで kick をループする。差分が無ければ最初のチャンクで
 * `nextCursor: null` になり 1 回の軽い再検証クエリで終わる。
 */
export async function ensureSynced(cms: ReturnType<typeof makeCms>): Promise<void> {
  let state = await cms.sync.getState();
  do {
    await cms.sync.kick();
    state = await cms.sync.getState();
  } while (state.cursor !== null);
}
```

## Workers エントリ

React Router の `context` に `env`/`ctx` を積んで loader から参照できるようにする。

```ts
// app/lib/context.ts
import { createContext } from "react-router";

/**
 * v8_middleware 有効時、loader/action の `context` は `RouterContextProvider`
 * になり `AppLoadContext` のプロパティ拡張では受け取れない
 * （`context.get(cloudflareContext)` で読む）。
 */
export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>();
```

```ts
// workers/app.ts
import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context.js";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
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
  // 画像プロキシ・WebSocket 更新通知(/realtime)・Webhook をまとめて cms.fetch() に委譲。
  route("/api/cms/*", "routes/api.cms.ts"),
] satisfies RouteConfig;
```

```ts
// app/routes/api.cms.ts
import { makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/api.cms";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  return makeCms(env, ctx).fetch(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  return makeCms(env, ctx).fetch(request);
}
```

## 一覧ページ

```tsx
// app/routes/home.tsx
import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";
import { Link } from "react-router";
import { ensureSynced, makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/home";

export async function loader({ context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const cms = makeCms(env, ctx);
  await ensureSynced(cms);
  const { items } = await cms.posts.list();
  return { items };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  // mount / 再フォーカス時に loader を再走させ、裏で進んだ同期結果を反映する。
  useNotionRevalidate();
  return (
    <main>
      <h1>記事一覧</h1>
      <ul>
        {items.map((post) => {
          const meta = post.meta as { publishedAt?: string | null };
          return (
            <li key={post.slug}>
              <Link to={`/posts/${post.slug}`}>
                <strong>{post.slug}</strong>
                {meta.publishedAt && <time>{meta.publishedAt}</time>}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

## 記事ページ（React 描画）

`post.blocks` は同期時に画像 URL 解決・リンク解決まで済んだプレーンな `NormalizedBlock[]`。
`denormalizeBlocks()` で `react-renderer` が期待する `BlockObjectResponse` 形状に変換する。

```tsx
// app/routes/post.tsx
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { denormalizeBlocks, toPageLinkMap } from "@notion-headless-cms/react-renderer/cms";
import { useNotionRevalidate } from "@notion-headless-cms/react-renderer/router";
import { data } from "react-router";
import { ensureSynced, makeCms } from "../lib/cms";
import { cloudflareContext } from "../lib/context";
import type { Route } from "./+types/post";

export async function loader({ params, context }: Route.LoaderArgs) {
  const { env, ctx } = context.get(cloudflareContext);
  const cms = makeCms(env, ctx);
  await ensureSynced(cms);
  const post = await cms.posts.find(params.slug ?? "");
  if (!post) throw data("Not Found", { status: 404 });
  return { post };
}

export default function Post({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const meta = post.meta as { title?: string | null; publishedAt?: string | null };
  useNotionRevalidate();
  return (
    <article>
      <h1>{meta.title ?? post.slug}</h1>
      {meta.publishedAt && <time>{meta.publishedAt}</time>}
      <NotionRenderer
        blocks={denormalizeBlocks(post.blocks)}
        pageLinks={toPageLinkMap(post.links)}
        ogpEndpoint="/api/cms/ogp"
      />
    </article>
  );
}
```

## 表示の自動更新（`useNotionRevalidate` / `<NotionRevalidator>`）

`@notion-headless-cms/react-renderer/router` の `useNotionRevalidate()`（レンダーを伴わない
コンポーネント版が `<NotionRevalidator>`）は、`useRevalidator().revalidate()` を呼んで
現在の loader を再走させるだけの薄いフック。別 API への fetch や輪読ポーリングは行わない。
既定トリガーは `["mount", "visibility"]`（マウント時 + タブ再フォーカス時）。

```tsx
useNotionRevalidate(); // 既定: mount + visibility
useNotionRevalidate({ on: "visibility" }); // 再フォーカス時のみ
<NotionRevalidator on={["mount", "visibility"]} />;
```

同期自体は `ensureSynced()`（loader 内で `cms.sync.kick()` をキックする）または Notion webhook
（`createCMS({ webhookSecret })`、[`cloudflare-workers.md`](./cloudflare-workers.md) 参照）が
裏で進める。`useNotionRevalidate()` は「その進んだ結果を画面に反映するタイミング」を制御する。

より高度に、同期完了を WebSocket で push したい場合は `createCMS({ realtime })` +
`RealtimeHubDO`（`@notion-headless-cms/cms/cloudflare`）と `useNotionRevalidate({ realtime: { collection, item } })`
を組み合わせる（`cloudflare-workers.md` の Durable Object 構成を参照）。

## 画像プロキシ・OGP・Webhook

Notion 画像 URL は期限付きのため、同期時に SHA256 ハッシュキーで R2 に永続保存し、block 内の
参照を書き換え済みで返す。`cms.fetch()` が `GET {routes}/images/:hash` を自動で配信するため、
専用ルートの実装は不要（上記の `api.cms.ts` がまとめて処理する）。

bookmark / link_preview / embed の OGP カードは `<NotionRenderer ogpEndpoint="/api/cms/ogp">`
を明示することでページアクセス時にクライアント側から取得される。

## 関連

- 動作する完全な例: [`examples/cloudflare-react-router/`](../../../examples/cloudflare-react-router/)
- Durable Object で Notion アクセスを一元化する構成: [`cloudflare-workers.md`](./cloudflare-workers.md)
- レンダラの選び方: [`../choosing-a-renderer.md`](../choosing-a-renderer.md)
- CMS メソッド一覧: [`../api/cms-methods.md`](../api/cms-methods.md)
