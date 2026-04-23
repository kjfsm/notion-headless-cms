# Node スクリプトでの利用

バッチ処理や静的サイト生成など、Node.js スクリプトから Notion を取得する場合。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

## スキーマの生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

## スクリプト例

```ts
// scripts/prefetch.ts
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "../generated/nhc-schema";

const cms = createCMS({
  ...nodePreset(),
  dataSources: cmsDataSources,
});

// 全記事を事前レンダリング
const { ok, failed } = await cms.posts.prefetch({
  concurrency: 5,
  onProgress: (done, total) => {
    console.log(`${done}/${total}`);
  },
});
console.log(`完了: ${ok}件, 失敗: ${failed}件`);

// 一覧取得
const posts = await cms.posts.getList();
console.log(`全${posts.length}件`);

// 前後の記事取得
const adj = await cms.posts.adjacent("my-post-slug");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```

## カスタム cache / renderer を差し込む

`nodePreset` は `cache` / `renderer` を上書きできる。
独自の cache adapter を使う場合:

```ts
import { createCMS, nodePreset, memoryDocumentCache } from "@notion-headless-cms/core";
import { cmsDataSources } from "../generated/nhc-schema";

const cms = createCMS({
  ...nodePreset({
    cache: {
      document: memoryDocumentCache({ maxItems: 1000 }),
      ttlMs: 10 * 60_000,
    },
  }),
  dataSources: cmsDataSources,
});
```

キャッシュを完全に無効化する場合:

```ts
createCMS({ ...nodePreset({ cache: "disabled" }), dataSources: cmsDataSources });
```
