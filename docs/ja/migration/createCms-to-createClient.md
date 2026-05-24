# `createCms` → `createClient` への移行

各ランタイムパッケージ (`@notion-headless-cms/{node,cloudflare,next}`) の `createCms`
は v1.0.0 で削除予定です。`createClient` + `notionSource` + ランタイム preset の
組み合わせに置き換えてください。

## 期限

- 非推奨マーク: v0.3.x (現在)
- **削除予定: v1.0.0**

## なぜ

- 「`createCms` と `createClient` のどちらを使えば？」という二重エントリ問題が
  v0.3 時点で残っていた (Issue #312 / M1)
- `createClient({ sources, ...preset() })` 1 本に統一することで、利用側は
  「環境による分岐 = preset の差分」だけを理解すればよくなる
- preset 契約 (Issue #313 / M2) が `{ cache, swr, hooks?, rateLimiter?, waitUntil? }`
  に対称化したため、`...preset()` で同じ感覚で組み立てられる

## Node.js

旧:

```ts
import { createCms } from "@notion-headless-cms/node";
import { schema } from "./generated/nhc";

export const cms = createCms({
  schema,
  token: process.env.NOTION_TOKEN!,
  publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
});
```

新 (推奨):

```ts
import {
  createClient,
  nodePreset,
  notionSource,
} from "@notion-headless-cms/node";
import { schema } from "./generated/nhc";

export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: { posts: { publishedStatuses: ["公開済み"] } },
    }),
  },
  ...nodePreset(),
});
```

## Cloudflare Workers

旧:

```ts
import { createCms } from "@notion-headless-cms/cloudflare";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const cms = createCms({ schema, token: env.NOTION_TOKEN, env, ctx });
    // ...
  },
};
```

新:

```ts
import {
  cloudflarePreset,
  createClient,
  notionSource,
} from "@notion-headless-cms/cloudflare";

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const cms = createClient({
      sources: { notion: notionSource({ schema, token: env.NOTION_TOKEN }) },
      ...cloudflarePreset({ env, ctx }),
    });
    // ...
  },
};
```

`cloudflarePreset` は `{ cache, swr, waitUntil }` を返します (Issue #313 / M2)。
KV / R2 binding の名前は env (`DOC_CACHE` / `IMG_BUCKET`) に合わせてください。

## Next.js

旧:

```ts
import { createCms } from "@notion-headless-cms/next";

export const cms = createCms({ schema, token: process.env.NOTION_TOKEN! });
```

新:

```ts
import {
  createClient,
  nextPreset,
  notionSource,
} from "@notion-headless-cms/next";

export const cms = createClient({
  sources: { notion: notionSource({ schema, token: process.env.NOTION_TOKEN! }) },
  ...nextPreset(),
});
```

ISR キャッシュ (cache-next) を使う場合は `nextPreset` を使わず、
`createClient({ cache: [nextISRCache(...)], swr: { ttlMs }, ... })` を直接組み立ててください。

## 機械的置換のヒント

- `createCms` を `createClient` に改名
- `schema, token` を `notionSource({ schema, token })` で `sources.notion` 配下に
- 末尾に `...<env>Preset(...)` をスプレッド
- import 文を 3 つに分割 (`createClient` / `notionSource` / `<env>Preset`)

`createCms` は内部で同等の `createClient` を呼ぶ薄い shim です。挙動は変わりません。
