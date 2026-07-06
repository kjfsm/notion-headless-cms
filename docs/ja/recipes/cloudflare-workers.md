---
title: Cloudflare Workers
description: Workers + R2 + D1 + Durable Object の構成
category: レシピ
order: 3
---

# Cloudflare Workers + R2 + D1 レシピ

Notion アクセス（同期）を Durable Object に一元化し、読者用の stateless Worker は D1/R2 を
読むだけにする「完全マテリアライズド」構成。読者リクエスト処理中は Notion API を一切呼ばない
（`@notion-headless-cms/cms` の北極星）。完全に動く実装は
[`examples/cloudflare-hono/`](../../../examples/cloudflare-hono/) にある。

DO を使わずシンプルに始めたい場合は Worker isolate 内スケジューラで完結する構成
（[`react-router.md`](./react-router.md)）も参照。

## インストール

```bash
pnpm add @notion-headless-cms/cms @notion-headless-cms/sql @notionhq/client
pnpm add -D @notion-headless-cms/cli kysely-d1
```

`@notion-headless-cms/sql` は D1/SQLite/libSQL 向けの `IndexStore` 実装（Kysely）を提供する
別パッケージ（`cms` 本体はゼロ依存原則のため Kysely を持たない）。`./d1` サブパスの利用には
peer 依存の `kysely-d1` が必要。

## スキーマ定義

```ts
// src/schema.ts
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
main = "src/index.ts"
compatibility_date = "2026-04-22"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "my-app"
database_id = "xxxxxxxxxxxxxxxxxxxx"

[[r2_buckets]]
binding = "IMG_BUCKET"
bucket_name = "my-app-cache"

# Notion アクセスを直列化する同期エンジン（SyncCoordinatorDO）。
# 読者リクエストは D1/R2 を読むだけで、Notion API 呼び出しは DO に一元化する。
[[durable_objects.bindings]]
name = "SYNC_COORDINATOR"
class_name = "SyncCoordinatorDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["SyncCoordinatorDO"]
```

```bash
wrangler secret put NOTION_TOKEN
```

## 読者用 Worker インスタンス

読者用の stateless Worker は D1/R2 の読み取り（`find`/`list`/`search`）だけを行い、Notion API への
直列アクセスは DO に一元化する（`syncDelegate` 経由で転送する）。

```ts
// src/lib/cms.ts
import { createCMS } from "@notion-headless-cms/cms";
import { durableObjectSyncDelegate, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";
import { schema } from "../schema.js";

export interface Env {
  readonly NOTION_TOKEN: string;
  readonly DB: D1Database;
  readonly IMG_BUCKET: R2Bucket;
  readonly SYNC_COORDINATOR: DurableObjectNamespace;
}

export function makeCms(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
  return createCMS({
    schema,
    stores: {
      index: d1IndexStore(env.DB, schema),
      blobs: r2BlobStore(env.IMG_BUCKET),
    },
    syncDelegate: durableObjectSyncDelegate({ namespace: env.SYNC_COORDINATOR }),
    waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p),
  });
}
```

## Durable Object（Notion アクセスの一元化）

```ts
// src/lib/do.ts
import type { DurableObjectStateLike } from "@notion-headless-cms/cms";
import { createCMS, createDurableObjectSyncScheduler } from "@notion-headless-cms/cms";
import { createSyncCoordinatorDO, r2BlobStore } from "@notion-headless-cms/cms/cloudflare";
import { d1IndexStore } from "@notion-headless-cms/sql/d1";
import { schema } from "../schema.js";
import type { Env } from "./cms.js";

/**
 * DO インスタンスは alarm 発火の間にエビクトされ得るため、`createCMS` は
 * DO の constructor で毎回呼び直す設計（`createSyncCoordinatorDO` 参照）。
 */
export const SyncCoordinatorDO = createSyncCoordinatorDO<Env>({
  createCMS: (state: DurableObjectStateLike, env: Env) =>
    createCMS({
      schema,
      notion: { token: env.NOTION_TOKEN },
      stores: {
        index: d1IndexStore(env.DB, schema),
        blobs: r2BlobStore(env.IMG_BUCKET),
      },
      scheduler: createDurableObjectSyncScheduler(state),
    }),
});
```

## Workers エントリ（Hono）

```ts
// src/index.ts
import { Hono } from "hono";
import { type Env, makeCms } from "./lib/cms.js";
import posts from "./routes/posts.js";

export { SyncCoordinatorDO } from "./lib/do.js";

const app = new Hono<{ Bindings: Env }>();

app.route("/posts", posts);

// 手動 kick 用のメンテナンスエンドポイント（初回コールドスタート時や動作確認用）。
// 本来は Notion webhook（/api/cms/webhook 経由）が SyncCoordinatorDO を起動する。
app.post("/api/sync/kick", (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  c.executionCtx.waitUntil(cms.sync.kick());
  return c.json({ ok: true });
});

// 画像プロキシ・webhook・OGP を cms.fetch() 1 つにまとめて配信する。
app.all("/api/cms/*", (c) => makeCms(c.env, c.executionCtx).fetch(c.req.raw));

export default app;
```

```ts
// src/routes/posts.ts
import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";
import { Hono } from "hono";
import type { Env } from "../lib/cms.js";
import { makeCms } from "../lib/cms.js";

const posts = new Hono<{ Bindings: Env }>();

posts.get("/", async (c) => {
  const { items } = await makeCms(c.env, c.executionCtx).posts.list();
  return c.json({ items });
});

posts.get("/:slug", async (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  const post = await cms.posts.find(c.req.param("slug"));
  if (!post) return c.json({ error: "Not Found" }, 404);
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
  return c.json({
    html,
    item: { id: post.meta.id, slug: post.slug, status: post.meta.status },
  });
});

export default posts;
```

## content の選び方: HTML か React か

`post.blocks` はどちらのレンダラにも渡せる正規化済みプレーンデータ。React を使わない構成
（Hono の JSON API・RSS・メール本文など）は `./html` サブパスの `renderBlocksToHtml()`、
React ベースのフレームワークなら `@notion-headless-cms/react-renderer` の `<NotionRenderer>`
を使う（詳細な比較は [`../choosing-a-renderer.md`](../choosing-a-renderer.md)）。React 版の
使い方は [`react-router.md`](./react-router.md) を参照。

## HTML ページを描画する（React を使わない場合）

Hono の `hono/html` で素の HTML を組み立てつつ、タブ可視化のたびに `location.reload()` する
スクリプトを埋め込むと、DO 側が裏で同期し終えた最新スナップショットが再取得される。

```ts
import { html, raw } from "hono/html";

function revalidatorScript(): string {
  return '<script>document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")location.reload()});</script>';
}

app.get("/ui/posts/:slug", async (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  const post = await cms.posts.find(c.req.param("slug"));
  if (!post) return c.html("<h1>404</h1>", 404);
  const content = renderBlocksToHtml(post.blocks, { links: post.links });
  return c.html(
    html`<!doctype html>
      <html lang="ja">
        <body>
          <h1>${post.slug}</h1>
          <article>${raw(content)}</article>
          ${raw(revalidatorScript())}
        </body>
      </html>`,
  );
});
```

Astro など他のテンプレートエンジンでも同じスクリプト文字列を埋め込むだけでよい。React を
使う場合は `<NotionRevalidator>`（[`react-router.md`](./react-router.md) 参照）がこれと
同等の役割を担う。

## Webhook によるキャッシュ更新

`createCMS({ webhookSecret })` を設定すると `cms.fetch()` が `POST {routes}/webhook` を自動で
マウントする。Notion integration の Webhooks 設定でこの URL を登録すると、ページ更新イベントで
DO の同期がキックされる。

1. デプロイ後、Notion の integration 設定 → Webhooks で
   `https://<site>/api/cms/webhook`（`routes` に合わせる）を登録する。
2. Notion が一度だけ送る `verification_token` を、エンドポイントのレスポンス本文
   （`{ verification_token }` を echo）または `wrangler tail` のログで確認する。
3. その値を `wrangler secret put NOTION_WEBHOOK_SECRET` に設定し、`createCMS({ webhookSecret: env.NOTION_WEBHOOK_SECRET })`
   に渡す（Notion UI 側の Verify にも同じ値を貼って有効化する。再デプロイで反映）。
4. 対象 DB のページを編集すると、署名検証（`X-Notion-Signature`）を通った webhook が
   `sync.onWebhook()` を呼び、debounce（既定 3 秒、`sync.debounceMs` で調整可）後に差分同期が走る。

## Cron Trigger による削除検知（reconcile）

Notion 側で削除されたページの検知は webhook では拾えないため、Cron Trigger で定期的に
`cms.scheduled()` を呼び、全件突合（`reconcile()`）を行う。

```toml
# wrangler.toml
[triggers]
crons = ["0 18 * * *"]  # 毎日 UTC 18:00（JST 3:00）
```

```ts
// src/index.ts に追記
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(makeCms(env, ctx).scheduled());
  },
} satisfies ExportedHandler<Env>;
```

## 画像プロキシの配線に注意

Notion 画像 URL は期限付きのため、同期時に SHA256 ハッシュキーで R2 に永続保存し、block 内の
URL を `{imagesPath}/{hash}`（既定 `/images/{hash}`）へ焼き込む。読者側の `cms.fetch()` は
`{routes}/images/:hash`（既定 `routes` は `/api/cms`）で配信するため、**同期側とバケする URL
の prefix を一致させる必要がある**。

同期・読者を同じ `createCMS()` インスタンス（1 プロセス構成、DO を使わない構成）で行う場合は
両方とも既定値のままでよい。DO のように**同期側と読者側を別の `createCMS()` インスタンスに
分ける場合**は、DO 側（焼き込み側）の `imagesPath` を読者側の実配信パス
（`{routes}/images`、既定なら `/api/cms/images`）に明示的に合わせる。

```ts
// src/lib/do.ts の createCMS に追記
createCMS({
  schema,
  notion: { token: env.NOTION_TOKEN },
  stores: { index: d1IndexStore(env.DB, schema), blobs: r2BlobStore(env.IMG_BUCKET) },
  scheduler: createDurableObjectSyncScheduler(state),
  imagesPath: "/api/cms/images", // 読者側 routes("/api/cms") + imagesPath("/images" 既定) と一致させる
});
```

## キャッシュなしで動かす（ローカル開発）

`.dev.vars` に `NOTION_TOKEN` だけ書けば `wrangler dev` で動く。D1/R2 binding が無くても
`stores` を省略すれば in-memory ストアにフォールバックし、例外にはならない（永続化はされない）。

```
# .dev.vars
NOTION_TOKEN=secret_xxx
```

## 関連

- 動作する完全な例: [`examples/cloudflare-hono/`](../../../examples/cloudflare-hono/)
- React Router（DO 無しの最小構成、React 描画）: [`react-router.md`](./react-router.md)
- レンダラの選び方: [`../choosing-a-renderer.md`](../choosing-a-renderer.md)
- CMS メソッド一覧: [`../api/cms-methods.md`](../api/cms-methods.md)
