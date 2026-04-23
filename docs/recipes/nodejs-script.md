# Node スクリプトでの利用

バッチ処理や静的サイト生成など、Node.js スクリプトから Notion を取得する場合。

## インストール

```bash
pnpm add @notion-headless-cms/adapter-node
pnpm add -D @notion-headless-cms/cli
```

`adapter-node` は `core` / `source-notion` / `renderer` を推移依存として含む。

## スキーマの生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

## スクリプト例

```ts
// scripts/generate.ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema } from "../generated/nhc-schema";

const client = createNodeCMS({
  schema: nhcSchema,
  sources: {
    posts: { published: ["公開"] },
  },
  cache: {
    document: "memory",
    image: "memory",
  },
});

// 全記事を事前レンダリング
const { ok, failed } = await client.posts.cache.prefetchAll({
  concurrency: 5,
  onProgress: (done, total) => {
    console.log(`${done}/${total}`);
  },
});

console.log(`完了: ${ok}件, 失敗: ${failed}件`);

// ページネーション取得
const page1 = await client.posts
  .query()
  .paginate({ page: 1, perPage: 10 })
  .execute();
console.log(`全${page1.total}件中 ${page1.items.length}件表示`);

// 前後の記事取得
const adj = await client.posts.query().adjacent("my-post-slug");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```

## core を直接使う場合

アダプタを使わず、`core` の `memoryDocumentCache` / `memoryImageCache` を直接組み立てることもできる。

```ts
import {
  createCMS,
  memoryDocumentCache,
  memoryImageCache,
} from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { nhcSchema } from "../generated/nhc-schema";

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
    document: memoryDocumentCache(),
    image: memoryImageCache(),
  },
});
```
