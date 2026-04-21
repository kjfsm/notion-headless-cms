# @notion-headless-cms/adapter-cloudflare

Cloudflare Workers 向け CMS ファクトリ。Workers のバインディング（`R2Bucket` / シークレット）から `@notion-headless-cms/core` の CMS インスタンスを組み立てる。

## インストール

```bash
npm install @notion-headless-cms/adapter-cloudflare
```

本パッケージは `core` / `source-notion` / `renderer` / `cache-r2` を推移依存として含むため、追加のインストールは不要。

## 使い方

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

export default {
  async fetch(request: Request, env: CloudflareCMSEnv): Promise<Response> {
    const cms = createCloudflareCMS({
      env,
      schema: {
        publishedStatuses: ["公開"],
        accessibleStatuses: ["公開", "下書き"],
      },
      ttlMs: 5 * 60 * 1000,
    });

    const url = new URL(request.url);

    if (url.pathname === "/posts") {
      const { items } = await cms.cache.read.list();
      return Response.json(items);
    }

    const slug = url.pathname.replace("/posts/", "");
    const cached = await cms.cache.read.get(slug);
    if (!cached) return new Response("Not Found", { status: 404 });

    return new Response(cached.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

### 型安全なカスタムスキーマ

`defineSchema` の戻り値をそのまま `schema` に渡せる。

```typescript
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { defineMapping, defineSchema } from "@notion-headless-cms/source-notion";
import { z } from "zod";

const PostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  updatedAt: z.string(),
  status: z.enum(["公開", "下書き"]),
  publishedAt: z.string(),
  title: z.string(),
});
const mapping = defineMapping<z.infer<typeof PostSchema>>({
  slug:        { type: "richText", notion: "Slug" },
  status:      { type: "select",   notion: "Status", published: ["公開"] },
  publishedAt: { type: "date",     notion: "PublishedAt" },
  title:       { type: "title",    notion: "Title" },
});

const cms = createCloudflareCMS({
  env,
  schema: defineSchema(PostSchema, mapping),
});
```

### 環境変数の設定

```bash
wrangler secret put NOTION_TOKEN
wrangler secret put NOTION_DATA_SOURCE_ID
```

`CACHE_BUCKET` 未バインド時はキャッシュなしで動作する（ローカル開発向け）。

## API

### `createCloudflareCMS<T>(opts): CMS<T>`

| オプション | 型 | 説明 |
|---|---|---|
| `env` | `CloudflareCMSEnv` | Workers バインディング（後述） |
| `schema` | `SchemaConfig<T> \| NotionSchema<T>` | `publishedStatuses` 等の設定、または `defineSchema()` の戻り値 |
| `content` | `ContentConfig` | `imageProxyBase` などのレンダリング設定 |
| `ttlMs` | `number` | SWR の TTL（ミリ秒）。`document` / `image` は `CACHE_BUCKET` から自動注入 |

戻り値は `createCMS<T>()` と同じ `CMS<T>`。

### `CloudflareCMSEnv`

```typescript
interface CloudflareCMSEnv {
  NOTION_TOKEN: string;
  NOTION_DATA_SOURCE_ID: string;
  CACHE_BUCKET?: R2BucketLike;
}
```

`R2BucketLike` は `@notion-headless-cms/cache-r2` で定義される構造型。Workers の `R2Bucket` とそのまま互換。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 キャッシュ（内部で使用）
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース（内部で使用）
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー（内部で使用）
