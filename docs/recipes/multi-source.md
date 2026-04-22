# マルチソースレシピ

複数の Notion DB を1つのクライアントで型安全に扱うパターン。
`nhc generate` で生成したスキーマを `createNodeMultiCMS` / `createCloudflareCMSMulti` に渡す。

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
      fields: { published: ["公開"], accessible: ["公開", "下書き"] },
    },
    {
      name: "news",
      id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      fields: { published: ["掲載中"] },
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
import { createNodeMultiCMS } from "@notion-headless-cms/adapter-node";

const client = createNodeMultiCMS({
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
const client = createNodeMultiCMS({
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

#### `createNodeMultiCMS<S>(opts): MultiCMSResult<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `MultiSourceSchema` | `nhc generate` で生成した `nhcSchema` |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `token` | `string`（任意） | Notion API トークン（省略時は `NOTION_TOKEN` 環境変数） |
| `cache` | `NodeCMSOptions["cache"]`（任意） | キャッシュ設定（`adapter-node` の `createNodeCMS` と同じ） |
| `content` | `ContentConfig`（任意） | `imageProxyBase` などのレンダリング設定 |

戻り値 `MultiCMSResult<S>` は `{ [K in keyof S]: CMS<InferredItem<S[K]>> }` のマップ型。各値は通常の `CMS<T>` インスタンスと同じメソッドを持つ。

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
  createCloudflareCMSMulti,
  type CloudflareMultiCMSEnv,
} from "@notion-headless-cms/adapter-cloudflare";

export default {
  async fetch(request: Request, env: CloudflareMultiCMSEnv): Promise<Response> {
    const client = createCloudflareCMSMulti({
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

> `NOTION_DATA_SOURCE_ID` は不要。各ソースの ID は `nhcSchema` から取得される。

### API

#### `createCloudflareCMSMulti<S>(opts): MultiCMSResult<S>`

| オプション | 型 | 説明 |
|---|---|---|
| `schema` | `MultiSourceSchema` | `nhc generate` で生成した `nhcSchema` |
| `env` | `CloudflareMultiCMSEnv` | Workers バインディング |
| `sources` | `{ [K in keyof S]?: SourceStatusConfig }`（任意） | ソースごとの `published` / `accessible` 設定 |
| `ttlMs` | `number`（任意） | SWR の TTL（ミリ秒） |
| `content` | `ContentConfig`（任意） | `imageProxyBase` などのレンダリング設定 |

#### `CloudflareMultiCMSEnv`

```ts
interface CloudflareMultiCMSEnv {
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
const client = createNodeMultiCMS({ schema: nhcSchema });
//    ^? { posts: CMS<PostsItem> }

const posts = await client.posts.list();
//    ^? PostsItem[]
```

`postsSchema`（`defineSchema` の戻り値）に埋め込まれた型情報を `MultiCMSResult<S>` のマップ型が抽出するため、IDE 上で完全な補完・型チェックが得られる。

---

## シングルソースとの混在

既存の `createNodeCMS` / `createCloudflareCMS`（シングルソース）と `createNodeMultiCMS`（マルチソース）は独立して使える。共有リソースが不要な場合は用途ごとに使い分けてよい。

```ts
// メインブログは既存の単一ソースクライアント
const blog = createNodeCMS({ schema: blogSchema });

// 複数 DB をまとめて扱う管理用クライアント
const admin = createNodeMultiCMS({ schema: nhcSchema });
```

## 関連ドキュメント

- [CLI ツール](../cli.md)
- [Node.js スクリプト](./nodejs-script.md)
- [Cloudflare Workers + R2](./cloudflare-workers.md)
- [CMS メソッド一覧](../api/cms-methods.md)
