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

`cloudflarePreset({ env, ctx })` を `createClient` に展開すると、KV + R2 のキャッシュアダプタと `waitUntil` が一括で配線される。

```ts
import { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "./generated/nhc.schema";

interface Env {
  NOTION_TOKEN: string;
  DOC_CACHE?: KVNamespace;
  IMG_BUCKET?: R2Bucket;
}

function makeCms(env: Env, ctx?: ExecutionContext) {
  return createClient({
    sources: {
      notion: notionSource({
        schema,
        token: env.NOTION_TOKEN,
        publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
      }),
    },
    // cache (KV+R2) と waitUntil を一括注入。
    // ctx を渡さないと SWR の bg 更新が打ち切られて古いキャッシュが残る。
    ...cloudflarePreset({ env, ctx }),
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

## キャッシュ戦略: 永続キャッシュ + 更新検知

`swr.ttlMs` は**指定しない**のが推奨。

- KV キャッシュは期限なしで永続させる。
- リクエスト時はキャッシュを即時返却し、`waitUntil` 経由でバックグラウンドで Notion の `lastEditedTime` と照合する。
- 差分があれば KV を差し替え、コンテンツキャッシュを無効化する。
- 差分が無ければ何もしない（無駄な fetch なし）。

`ttlMs` を入れると期限切れ時にブロッキング再取得が走るため、変更が無くても遅延の原因になる。

## クライアント側の表示更新

Notion を更新したとき、画面を**静かに切り替える**には:

### React Router v7

`<NotionRevalidator />` を 1 つ置くだけ。内部で `useRevalidator` を呼び loader を再走させる。

```tsx
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";

export default function Post({ loaderData }) {
  return (
    <article>
      <NotionRevalidator />
      {/* ... */}
    </article>
  );
}
```

**KV ポーリングで確実に最新化したい場合**は `poll` オプションを使う。`peekVersion` エンドポイントをポーリングし、SWR バックグラウンド更新が完了したタイミングで自動的に loader を再走させる。

```ts
// app/routes/check.ts
export async function loader({ params, context }: Route.LoaderArgs) {
  const cms = makeCms(context.cloudflare.env, context.cloudflare.ctx);
  return Response.json(await cms.posts.peekVersion(params.slug ?? ""));
}
```

```tsx
// app/routes/post.tsx
<NotionRevalidator
  poll={{
    url: `/api/posts/${item.slug}/check`,
    version: item.lastEditedTime,
  }}
/>
```

ポーリングは `notionUpdatedAt` の変化（更新あり → revalidate）または `cachedAt` の変化（確認完了・更新なし → 停止）を検出した時点で自動停止する。既定タイムアウトは 30 秒。

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

`cloudflarePreset` の代わりに低レベル API を組み合わせる。

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
KV / R2 binding が未設定でも `cloudflarePreset` は空配列を返すため、メモリ無しでも例外にはならない。

```
# .dev.vars
NOTION_TOKEN=secret_xxx
```

## Webhook によるキャッシュ無効化

`cms.handler({ webhookSecret })` にリクエストを投げると、DataSource の `parseWebhook` が `{ collection, slug? }` を返し、該当スコープが `cache.invalidate()` される。

```ts
const handler = cms.handler({ webhookSecret: env.NOTION_WEBHOOK_SECRET });
if (url.pathname === "/api/revalidate") {
  return handler(request);
}
```

## 画像配信ルート

Notion 画像 URL は期限付きのため、core 側で SHA256 ハッシュキーに変換して R2 に永続保存する。レンダリング後の HTML 内の `<img>` は `/api/images/<hash>` に書き換わるので、同じハッシュを提供するルートを用意する。

`cms.handler()` がこれを自動でさばくため、ほぼ何も書かなくてよい。

## 構造型による型依存

`cloudflareCache` / `cloudflarePreset` が受ける binding は構造型 (`R2BucketLike` / `KVNamespaceLike`) を要求するため、`@cloudflare/workers-types` への実依存はない。テストではモックに差し替え可能。
