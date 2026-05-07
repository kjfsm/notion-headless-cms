# @notion-headless-cms/adapter-next

Next.js App Router 向けルートハンドラ。`@notion-headless-cms/core` の
CMS インスタンスから、画像プロキシ配信と Revalidate Webhook の
`GET` / `POST` ハンドラを生成する。

## インストール

```bash
pnpm add @notion-headless-cms/adapter-next @notion-headless-cms/core
```

## 使い方

### CMS インスタンスの準備

```ts
// app/lib/cms.ts
import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "@/app/generated/nhc.schema";

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: { publishedStatuses: ["公開済み"] },
      },
    }),
  },
  cache: [nextCache({ revalidate: 300, tags: ["posts"] }), memoryCache()],
  swr: { ttlMs: 5 * 60_000 },
});
```

### 画像プロキシルート

```ts
// app/api/images/[hash]/route.ts
import { cms } from "@/lib/cms";
import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";

export const GET = createImageRouteHandler(cms);
```

`/api/images/[hash]` に配置する前提。ハッシュに対応する画像が
存在しない場合は `404 Not Found` を返す。

### Revalidate Webhook ルート

```ts
// app/api/revalidate/route.ts
import { cms } from "@/lib/cms";
import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET!,
});
```

`POST /api/revalidate` を `Authorization: Bearer <REVALIDATE_SECRET>` で叩く。
リクエストボディの例:

```json
{ "collection": "posts", "slug": "my-post" }
```

`collection` / `slug` を省略すると全件 (`"all"`) 扱い。レスポンスで
`{ "updated": string[] }` が返る。認可失敗時は 401 Unauthorized。

`cache-next` と組み合わせた場合、invalidate 時に規約タグ
`nhc:col:<name>` / `nhc:col:<name>:slug:<slug>` が `revalidateTag` される。

## API

### `createImageRouteHandler(cms)`

| 引数 | 型 | 説明 |
|---|---|---|
| `cms` | `CMSClient` | `createClient()` の戻り値 |

戻り値: App Router 仕様の `GET` ハンドラ。

### `createRevalidateRouteHandler(cms, opts)`

| 引数 | 型 | 説明 |
|---|---|---|
| `cms` | `CMSClient` | CMS インスタンス |
| `opts.secret` | `string` | `Authorization: Bearer <secret>` と照合するシークレット |

戻り値: `POST` ハンドラ `(request) => Promise<Response>`。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR 向けキャッシュ
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー
