# @notion-headless-cms/adapter-cloudflare

Cloudflare Workers 向け CMS ファクトリ。Workers のバインディング（`KVNamespace` / `R2Bucket` / シークレット）と `nhc generate` が生成した `nhcDataSources` から、各コレクションに対応する CMS クライアントを組み立てる。

**テキスト（ドキュメント）は KV、画像は R2 でキャッシュする。**

## インストール

```bash
npm install @notion-headless-cms/adapter-cloudflare \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
npm install -D @notion-headless-cms/cli
```

本パッケージは `core` / `source-notion` / `renderer` / `cache-kv` / `cache-r2` を推移依存として含むが、`source-notion` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

## 使い方

### スキーマの生成

```bash
npx nhc init
NOTION_TOKEN=secret_xxx npx nhc generate
```

### wrangler.toml

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-kv-namespace-id"

[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "nhc-cache"
```

### Workers エントリーポイント

```typescript
import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { nhcDataSources } from "./generated/nhc-schema";

export default {
  async fetch(request: Request, env: CloudflareCMSEnv): Promise<Response> {
    const cms = createCloudflareCMS({
      dataSources: nhcDataSources,
      env,
      ttlMs: 5 * 60 * 1000,
    });

    const url = new URL(request.url);

    if (url.pathname === "/posts") {
      const items = await cms.posts.getList();
      return Response.json(items);
    }

    const slug = url.pathname.replace("/posts/", "");
    const post = await cms.posts.getItem(slug);
    if (!post) return new Response("Not Found", { status: 404 });

    return new Response(post.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};
```

### 環境変数の設定

```bash
wrangler secret put NOTION_TOKEN
```

`CACHE_KV` / `CACHE_BUCKET` はどちらも任意。未バインド時はそれぞれのキャッシュなしで動作する（ローカル開発向け）。

## API

### `createCloudflareCMS<D>(opts): CMSClient<D>`

| オプション | 型 | 説明 |
|---|---|---|
| `dataSources` | `DataSourceMap` | `nhc generate` が生成した `nhcDataSources` |
| `env` | `CloudflareCMSEnv` | Workers バインディング（後述） |
| `content` | `ContentConfig`（任意） | `imageProxyBase` / `remarkPlugins` / `rehypePlugins` などのレンダリング設定 |
| `ttlMs` | `number`（任意） | SWR の TTL（ミリ秒） |
| `waitUntil` | `(p: Promise<unknown>) => void`（任意） | `ctx.waitUntil` を渡すと SWR 裏更新が Workers のレスポンス後も継続する |

### `CloudflareCMSEnv`

```typescript
interface CloudflareCMSEnv {
  NOTION_TOKEN: string;
  /** KV namespace (テキスト/ドキュメントキャッシュ用。未設定時はキャッシュなし) */
  CACHE_KV?: KVNamespaceLike;
  /** R2 バケット (画像キャッシュ用。未設定時はキャッシュなし) */
  CACHE_BUCKET?: R2BucketLike;
}
```

- `KVNamespaceLike` は `@notion-headless-cms/cache-kv` で定義される構造型。Workers の `KVNamespace` とそのまま互換。
- `R2BucketLike` は `@notion-headless-cms/cache-r2` で定義される構造型。Workers の `R2Bucket` とそのまま互換。

## キャッシュ戦略

| データ種別 | バインディング | バックエンド |
|---|---|---|
| ドキュメント一覧・本文（JSON） | `CACHE_KV` | Cloudflare KV |
| 画像バイナリ | `CACHE_BUCKET` | Cloudflare R2 |

KV はテキスト（JSON）の読み書きに最適化されており、ドキュメントキャッシュに適している。R2 は大容量バイナリに対応しており、画像キャッシュに適している。

## 関連パッケージ

- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
- [`@notion-headless-cms/cache-kv`](../cache-kv) — KV ドキュメントキャッシュ（内部で使用）
- [`@notion-headless-cms/cache-r2`](../cache-r2) — R2 画像キャッシュ（内部で使用）
- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース（内部で使用）
- [`@notion-headless-cms/renderer`](../renderer) — Markdown レンダラー（内部で使用）
- [`@notion-headless-cms/cli`](../cli) — `nhcDataSources` 生成 CLI
