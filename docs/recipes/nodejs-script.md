# Node スクリプトでの利用

バッチ処理や静的サイト生成など、Node.js スクリプトから Notion を取得する場合。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/source-notion
```

## スクリプト例

```ts
// scripts/generate.ts
import { createCMS, memoryCache, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { writeFile } from "node:fs/promises";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: memoryCache(),
    image: memoryImageCache(),
  },
});

// 全記事を事前レンダリング
const { ok, failed } = await cms.prefetchAll({
  concurrency: 5,
  onProgress: (done, total) => {
    console.log(`${done}/${total}`);
  },
});

console.log(`完了: ${ok}件, 失敗: ${failed}件`);

// ページネーション取得
const page1 = await cms.paginate({ page: 1, perPage: 10 });
console.log(`全${page1.total}件中 ${page1.items.length}件表示`);

// 前後の記事取得
const adj = await cms.getAdjacent("my-post-slug");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```
