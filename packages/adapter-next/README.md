# @notion-headless-cms/adapter-next

Next.js App Router 向けの統合ルートハンドラ。`@notion-headless-cms/core` の
CMS インスタンスから、画像プロキシ配信と Revalidate Webhook を 1 つの
ハンドラで処理する `GET` / `POST` を生成する。

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
  // 統合ハンドラのマウントパスに合わせる。
  imageProxyBase: "/api/cms/images",
});
```

### 統合ルートハンドラ

```ts
// app/api/cms/[...path]/route.ts
import { createNextHandler } from "@notion-headless-cms/adapter-next";
import { cms } from "@/lib/cms";

const handler = createNextHandler(cms, {
  webhookSecret: process.env.REVALIDATE_SECRET,
});

export const GET = handler;
export const POST = handler;
```

`/app/api/cms/[...path]/route.ts` に配置する前提で以下のサブパスを処理する。

- `GET  /api/cms/images/<hash>` — 画像プロキシ配信。ハッシュ未登録時は 404
- `POST /api/cms/revalidate/<collection>` — Webhook 受信。`Authorization: Bearer <REVALIDATE_SECRET>` で認証

`cache-next` と組み合わせた場合、invalidate 時に規約タグ
`nhc:col:<name>` / `nhc:col:<name>:slug:<slug>` が `revalidateTag` される。

## API

### `createNextHandler(cms, opts?)`

| 引数 | 型 | 説明 |
|---|---|---|
| `cms` | `CMSGlobalOps` | `createClient()` の戻り値 |
| `opts.webhookSecret` | `string \| undefined` | Webhook 署名検証用シークレット。未指定時は検証スキップ |

戻り値: App Router 仕様の `GET` / `POST` 共通ハンドラ `(req: Request) => Promise<Response>`。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-next`](../cache-next) — Next.js ISR 向けキャッシュ
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー
