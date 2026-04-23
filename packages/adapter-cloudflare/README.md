# @notion-headless-cms/adapter-cloudflare

Cloudflare Workers 向け CMS ファクトリ。Workers のバインディング（`R2Bucket` / シークレット）と `nhc generate` が生成した `nhcSchema` から、各ソースに対応する `CMS` インスタンスのマップを組み立てる。

## インストール

```bash
npm install @notion-headless-cms/adapter-cloudflare \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
npm install -D @notion-headless-cms/cli
```

本パッケージは `core` / `source-notion` / `renderer` / `cache-r2` を推移依存として含むが、`source-notion` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

## 使い方

### スキーマの生成

```bash
npx nhc init
NOTION_TOKEN=secret_xxx npx nhc generate
```

### wrangler.toml

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "nhc-example-cache"
```

### Workers エントリーポイント

```typescript
import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { nhcSchema } from "./generated/nhc-schema";

export default {
  async fetch(request: Request, env: CloudflareCMSEnv): Promise<Response> {
    const client = createCloudflareCMS({
      schema: nhcSchema,
      env,
      sources: {
        posts: { published: ["公開"], accessible: ["公開", "下書き"] },
      },
      ttlMs: 5 * 60 * 1000,
    });

    const url = new URL(request.url);

    if (url.pathname === "/posts") {
      const { items } = await client.posts.cache.getList();
      return Response.json(items);
    }

    const slug = url.pathname.replace("/posts/", "");
    const cached = await client.posts.cache.get(slug);
    if (!cached) return new Response("Not Found", { status: 404 });

    return new Response(cached.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

### 環境変数の設定

```bash
wrangler secret put NOTION_TOKEN
```

> 各ソースの `dataSourceId` は `nhcSchema` から自動取得されるため、`NOTION_DATA_SOURCE_ID` の設定は不要。

`CACHE_BUCKET` 未バインド時はキャッシュなしで動作する（ローカル開発向け）。

## API

### `createCloudflareCMS<S>(opts): CMSMap<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `NHCSchema` | `nhc generate` が生成した `nhcSchema` |
| `env` | `CloudflareCMSEnv` | Workers バインディング（後述） |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `content` | `ContentConfig`（任意） | `imageProxyBase` / `remarkPlugins` / `rehypePlugins` などのレンダリング設定 |
| `ttlMs` | `number`（任意） | SWR の TTL（ミリ秒）。`document` / `image` は `CACHE_BUCKET` から自動注入 |

戻り値 `CMSMap<S>` は `{ [K in keyof S]: CMS<InferredItem<S[K]>> }` のマップ型。各値は通常の `CMS<T>` インスタンスと同じメソッドを持つ。

> `waitUntil` は本ファクトリのオプションでは受け付けない。`ctx.waitUntil` に SWR の裏更新を委ねたい場合は、`core` の `createCMS()` を直接組み立てる（詳細は [Cloudflare Workers レシピ](../../docs/recipes/cloudflare-workers.md#swr-裏更新の非同期化waituntil)）。

### `CloudflareCMSEnv`

```typescript
interface CloudflareCMSEnv {
  NOTION_TOKEN: string;
  CACHE_BUCKET?: R2BucketLike;
}
```

`R2BucketLike` は `@notion-headless-cms/cache-r2` で定義される構造型。Workers の `R2Bucket` とそのまま互換。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 キャッシュ（内部で使用）
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース（内部で使用）
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー（内部で使用）
- [`@notion-headless-cms/cli`](../cli) — `nhcSchema` 生成 CLI
