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

`adapter-node` は `core` / `notion-orm`（内部 ORM 層）/ `renderer` を推移依存として含む。
ただし `notion-orm` の `@notionhq/client` / `zod`、`renderer` の `unified` / `remark-*` / `rehype-*` は `peerDependencies` のため、利用側で明示的にインストールする必要がある。

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
import "dotenv/config";
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
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
import { nhcDataSources } from "./generated/nhc-schema";

// NOTION_TOKEN は process.env から自動読み込み
const cms = createNodeCMS({ dataSources: nhcDataSources });

// 一覧取得
const posts = await cms.posts.getList();
console.log(posts);

// スラッグで取得 → 本文を blocks / html / markdown で取り出す
const post = await cms.posts.getItem("my-first-post");
if (post) {
  console.log(post.content.blocks);        // ContentBlock[]
  console.log(await post.content.html());  // HTML 文字列 (遅延)
}
```

## インメモリキャッシュ付き構成

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcDataSources } from "./generated/nhc-schema";

const cms = createNodeCMS({
  dataSources: nhcDataSources,
  cache: {
    document: "memory",
    image: "memory",
    ttlMs: 5 * 60_000, // 5分
  },
});

// getItem / getList は SWR キャッシュ経由で動作する
const posts = await cms.posts.getList();
const post = await cms.posts.getItem("my-first-post");
const html = post ? await post.content.html() : null;
```

`cache` は `"disabled"`（完全無効化）か、`{ document?: "memory"; image?: "memory"; ttlMs?: number }` を受け取る。`document` / `image` を省略するとキャッシュなし（noop）で動作する。

## core を直接使う（アダプタを使わない構成）

アダプタを経由せず、`createCMS` に自分で `dataSources` / `renderer` / `cache` を組み立てることもできる。カスタムキャッシュ（例: `nextCache`）を使う場合はこの構成になる。

```ts
import { createCMS, memoryDocumentCache, memoryImageCache } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { nhcDataSources } from "./generated/nhc-schema";

const cms = createCMS({
  dataSources: nhcDataSources,
  renderer: renderMarkdown,
  cache: {
    document: memoryDocumentCache({ maxItems: 500 }),
    image: memoryImageCache({ maxItems: 200, maxSizeBytes: 64 * 1024 * 1024 }),
    ttlMs: 5 * 60_000,
  },
});
```

`memoryDocumentCache` / `memoryImageCache` は LRU 上限をオプションで指定できる。長時間稼働するプロセスではメモリ膨張を防ぐために必ず指定することを推奨する。

## 複数の DB を扱う場合

`nhc.config.ts` に複数の `dataSources` を書けば、`cms.posts` / `cms.news` のように型安全にアクセスできる。

```ts
import "dotenv/config";
import { defineConfig } from "@notion-headless-cms/cli";

export default defineConfig({
  dataSources: [
    { name: "posts", dbName: "ブログ記事DB" },
    { name: "news",  dbName: "ニュースDB" },
  ],
});
```

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcDataSources } from "./generated/nhc-schema";

const cms = createNodeCMS({ dataSources: nhcDataSources });

const posts = await cms.posts.getList();  // PostsItem[]
const news  = await cms.news.getList();   // NewsItem[]
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
