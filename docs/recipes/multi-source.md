# マルチソースレシピ

複数の Notion DB を 1 つのクライアントで型安全に扱うパターン。`nhc generate` で生成したスキーマを `createNodeCMS` / `createCloudflareCMS` に渡す。

## 事前準備：スキーマの生成

```bash
# CLI をインストール
pnpm add -D @notion-headless-cms/cli

# 設定ファイルを作成
npx nhc init

# nhc.config.ts を編集して複数 DB を設定
npx nhc generate
```

`nhc.config.ts` の例:

```ts
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    {
      name: "posts",
      dbName: "ブログ記事DB",
      // published/accessible は nhc.config.ts に書かない
      // → createNodeCMS / createCloudflareCMS の sources オプションで差し込む
    },
    {
      name: "news",
      id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
  ],
});
```

詳細は [CLI ドキュメント](../cli.md) を参照。

---

## Node.js

### インストール

```bash
pnpm add @notion-headless-cms/adapter-node @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

### 基本的な使い方

```ts
import { nhcSchema } from "./nhc-schema.ts";
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const client = createNodeCMS({
  schema: nhcSchema,
  // published/accessible はここで差し込む（生成ファイルは編集不要）
  sources: {
    posts: { published: ["公開"], accessible: ["公開", "下書き"] },
    news:  { published: ["掲載中"] },
  },
});

// 各ソースは個別の CMS インスタンスとして推論される
const posts = await client.posts.list();   // PostsItem[]
const news  = await client.news.list();    // NewsItem[]
```

### インメモリキャッシュ付き

```ts
const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"], accessible: ["公開", "下書き"] },
  },
  cache: {
    document: "memory",
    image: "memory",
    ttlMs: 5 * 60_000, // 5分
  },
});

// SWR でキャッシュ優先取得
const { items } = await client.posts.cache.getList();
const cached = await client.news.cache.get("some-slug");
```

### API

#### `createNodeCMS<S>(opts): CMSMap<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `NHCSchema` | `nhc generate` で生成した `nhcSchema` |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `token` | `string`（任意） | Notion API トークン（省略時は `NOTION_TOKEN` 環境変数） |
| `cache` | `NodeCacheConfig`（任意） | `"disabled"` または `{ document?: "memory"; image?: "memory"; ttlMs? }` |
| `content` | `ContentConfig`（任意） | `imageProxyBase` などのレンダリング設定 |

戻り値 `CMSMap<S>` は `{ [K in keyof S]: CMS<InferredItem<S[K]>> }` のマップ型。各値は通常の `CMS<T>` インスタンスと同じメソッドを持つ。

---

## Cloudflare Workers

### インストール

```bash
pnpm add @notion-headless-cms/adapter-cloudflare @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

### wrangler.toml

```toml
[[r2_buckets]]
binding = "CACHE_BUCKET"
bucket_name = "nhc-cache"
```

### Workers エントリーポイント

```ts
import { nhcSchema } from "./nhc-schema.ts";
import {
  createCloudflareCMS,
  type CloudflareCMSEnv,
} from "@notion-headless-cms/adapter-cloudflare";

export default {
  async fetch(request: Request, env: CloudflareCMSEnv): Promise<Response> {
    const client = createCloudflareCMS({
      schema: nhcSchema,
      env,
      ttlMs: 5 * 60_000, // 5分 TTL
      // published/accessible はここで差し込む（生成ファイルは編集不要）
      sources: {
        posts: { published: ["公開"], accessible: ["公開", "下書き"] },
        news:  { published: ["掲載中"] },
      },
    });

    const url = new URL(request.url);

    if (url.pathname === "/posts") {
      const { items } = await client.posts.cache.getList();
      return Response.json(items);
    }

    if (url.pathname === "/news") {
      const { items } = await client.news.cache.getList();
      return Response.json(items);
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

### 環境変数の設定

```bash
wrangler secret put NOTION_TOKEN
```

> 各ソースの `dataSourceId` は `nhcSchema` から自動取得されるため、`NOTION_DATA_SOURCE_ID` の設定は不要。

### API

#### `createCloudflareCMS<S>(opts): CMSMap<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `NHCSchema` | `nhc generate` で生成した `nhcSchema` |
| `env` | `CloudflareCMSEnv` | Workers バインディング |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `ttlMs` | `number`（任意） | SWR の TTL（ミリ秒） |
| `content` | `ContentConfig`（任意） | `imageProxyBase` などのレンダリング設定 |

#### `CloudflareCMSEnv`

```ts
interface CloudflareCMSEnv {
  NOTION_TOKEN: string;
  CACHE_BUCKET?: R2BucketLike;  // 未設定時はキャッシュなし
}
```

---

## 型推論の仕組み

`nhcSchema` の型から各ソースのアイテム型が自動推論される。

```ts
// nhc-schema.ts（生成ファイル）
export interface PostsItem extends BaseContentItem {
  title: string | null;
  tags: string[];
}
export const nhcSchema = {
  posts: { id: postsSourceId, dbName: "ブログ記事DB", schema: postsSchema },
} as const;

// アプリコード
const client = createNodeCMS({ schema: nhcSchema });
//    ^? { posts: CMS<PostsItem> }

const posts = await client.posts.list();
//    ^? PostsItem[]
```

`postsSchema`（`defineSchema` の戻り値）に埋め込まれた型情報を `CMSMap<S>` のマップ型が抽出するため、IDE 上で完全な補完・型チェックが得られる。

---

## 1 ソースのみ扱いたい場合

`nhc.config.ts` の `dataSources` に 1 件だけ登録すれば、そのまま単一 DB 構成としても使える。

```ts
const client = createNodeCMS({ schema: nhcSchema });
const posts = await client.posts.list();
```

## 関連ドキュメント

- [CLI ツール](../cli.md)
- [Node.js スクリプト](./nodejs-script.md)
- [Cloudflare Workers + R2](./cloudflare-workers.md)
- [CMS メソッド一覧](../api/cms-methods.md)
