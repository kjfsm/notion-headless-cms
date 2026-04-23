# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース（`nhc generate` で introspect する対象）
- Node.js 24 以降

## インストール

```bash
pnpm add @notion-headless-cms/adapter-node @notionhq/client zod
pnpm add -D @notion-headless-cms/cli
```

`adapter-node` は `core` / `source-notion` / `renderer` を推移依存として含む。
ただし `source-notion` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

<details>
<summary>必要な peer 依存をまとめて入れるコマンド</summary>

```bash
pnpm add @notion-headless-cms/adapter-node \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
```

</details>

## スキーマを自動生成する

`nhc init` で設定ファイルを、`nhc generate` で `nhc-schema.ts` を生成する。

```bash
npx nhc init
```

`nhc.config.ts` を編集して DB を設定する:

```ts
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB", fields: { published: ["公開"] } },
  ],
});
```

```bash
# Notion DB を introspect してスキーマを生成
NOTION_TOKEN=secret_xxx npx nhc generate
```

## 最小構成（キャッシュなし・ローカル開発向け）

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "./generated/nhc-schema";

// NOTION_TOKEN は process.env から自動読み込み
const client = createNodeCMS({ schema: nhcSchema });

// 一覧取得（ソース直接）
const posts = await client.posts.list();
console.log(posts);

// スラッグで取得 → Markdown/HTML レンダリング
const post = await client.posts.find("my-first-post");
if (post) {
  const rendered = await client.posts.render(post);
  console.log(rendered.html);
}
```

## インメモリキャッシュ付き構成

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "./generated/nhc-schema";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"] },
  },
  cache: {
    document: "memory",
    image: "memory",
    ttlMs: 5 * 60_000, // 5分
  },
});

// SWR でキャッシュ優先取得
const { items, isStale, cachedAt } = await client.posts.cache.getList();

// SWR で単一アイテム取得（HTML 付き）
const cached = await client.posts.cache.get("my-first-post");
console.log(cached?.html);
```

`cache` は `"disabled"`（完全無効化）か、`{ document?: "memory"; image?: "memory"; ttlMs?: number }` を受け取る。`document` / `image` を省略するとキャッシュなし（noop）で動作する。

## core を直接使う（アダプタを使わない構成）

アダプタを経由せず、`createCMS` に自分で `source` / `renderer` / `cache` を組み立てることもできる。カスタムキャッシュ（例: `nextCache`）を使う場合はこの構成になる。

```ts
import { createCMS, memoryDocumentCache, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { nhcSchema } from "./generated/nhc-schema";

const { posts } = nhcSchema;

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: posts.id,
    schema: posts.schema,
  }),
  renderer: renderMarkdown,
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: memoryDocumentCache({ maxItems: 500 }),
    image: memoryImageCache({ maxItems: 200, maxSizeBytes: 64 * 1024 * 1024 }),
    ttlMs: 5 * 60_000,
  },
});
```

`memoryDocumentCache` / `memoryImageCache` は LRU 上限をオプションで指定できる。長時間稼働するプロセスではメモリ膨張を防ぐために必ず指定することを推奨する。

## 複数の DB を扱う場合

`nhc.config.ts` に複数の `dataSources` を書けば、`client.posts` / `client.news` のように型安全にアクセスできる。

```ts
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB", fields: { published: ["公開"] } },
    { name: "news",  dbName: "ニュースDB",   fields: { published: ["掲載中"] } },
  ],
});
```

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "./generated/nhc-schema";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"] },
    news:  { published: ["掲載中"] },
  },
});

const posts = await client.posts.list();  // PostsItem[]
const news  = await client.news.list();   // NewsItem[]
```

詳細は [CLI ドキュメント](./cli.md) と [マルチソースレシピ](./recipes/multi-source.md) を参照。

## 次のステップ

- [CLI ツール（nhc）](./cli.md)
- [マルチソース](./recipes/multi-source.md)
- [Cloudflare Workers + R2](./recipes/cloudflare-workers.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Node スクリプト](./recipes/nodejs-script.md)
- [カスタムデータソース](./recipes/custom-source.md)
- [CMS メソッド一覧](./api/cms-methods.md)
