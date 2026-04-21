# @notion-headless-cms/adapter-next

Next.js App Router 向けルートハンドラ。`@notion-headless-cms/core` の CMS インスタンスから、画像プロキシ配信と Revalidate Webhook の `GET` / `POST` ハンドラを生成する。

## インストール

```bash
npm install @notion-headless-cms/adapter-next @notion-headless-cms/core
```

## 使い方

### CMS インスタンスの準備

```ts
// lib/cms.ts
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache-next";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";

export const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  renderer: renderMarkdown,
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: nextCache({ revalidate: 300, tags: ["posts"] }),
    image: memoryImageCache(),
  },
});
```

### 画像プロキシルート

Notion の期限付き画像 URL を永続キャッシュ経由で配信する。

```ts
// app/api/images/[hash]/route.ts
import { cms } from "@/lib/cms";
import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";

export const GET = createImageRouteHandler(cms);
```

`createImageRouteHandler` は `/api/images/[hash]` に配置する前提。ハッシュに対応する画像が存在しない場合は `404 Not Found` を返す。

### Revalidate Webhook ルート

```ts
// app/api/revalidate/route.ts
import { cms } from "@/lib/cms";
import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET!,
});
```

Notion 側の変更通知などから `POST /api/revalidate` を呼ぶ際に、`Authorization: Bearer <REVALIDATE_SECRET>` ヘッダが必要。認可に成功すると `cms.cache.manage.sync(payload)` が呼ばれてキャッシュが再生成される。

リクエストボディの例:

```json
{ "slug": "my-post" }
```

`slug` を省略すると全体の再生成が走る。レスポンスは `{ "updated": true | false }`。

## API

### `createImageRouteHandler(cms)`

| 引数 | 型 | 説明 |
|---|---|---|
| `cms` | `CMS` | `createCMS()` / `createNodeCMS()` / `createCloudflareCMS()` のいずれかの戻り値 |

戻り値は App Router 仕様の `GET` ハンドラ `(request, { params: Promise<{ hash: string }> }) => Promise<Response>`。

### `createRevalidateRouteHandler(cms, opts)`

| 引数 | 型 | 説明 |
|---|---|---|
| `cms` | `CMS` | CMS インスタンス |
| `opts.secret` | `string` | `Authorization: Bearer <secret>` と照合するシークレット |

戻り値は `POST` ハンドラ `(request) => Promise<Response>`。認可失敗時は `401 Unauthorized`。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR 向けキャッシュ
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー
