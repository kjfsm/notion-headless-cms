# Node スクリプトでの利用

バッチ処理や静的サイト生成など、Node.js スクリプトから Notion を取得する場合。

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notion-headless-cms/cache \
  @notionhq/client zod \
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
import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "../generated/nhc";

const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  cache: memoryCache(),
});

// 全記事を事前レンダリング (cache.warm)
const { ok, failed } = await cms.posts.cache.warm({
  concurrency: 5,
  onProgress: (done, total) => {
    process.stdout.write(`\r${done}/${total}`);
  },
});
console.log(`\n完了: ${ok}件, 失敗: ${failed}件`);

// 一覧取得
const posts = await cms.posts.list();
console.log(`全${posts.length}件`);

// 前後の記事取得
const adj = await cms.posts.cache.adjacent("my-post-slug");
console.log("前の記事:", adj.prev?.slug);
console.log("次の記事:", adj.next?.slug);
```

## カスタム cache を差し込む

`createCMS` の `cache` に任意のアダプタを渡せる。
組み込みの `memoryCache` は最大アイテム数を制限できる:

```ts
import { memoryCache } from "@notion-headless-cms/cache";
import { createCMS } from "../generated/nhc";

const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  cache: memoryCache({ maxItems: 1000 }),
  ttlMs: 10 * 60_000,
});
```

キャッシュを完全に無効化する場合（常に Notion から直接取得）:

```ts
const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
  // cache を省略 or undefined → noopDocOps / noopImgOps が使われる
});
```
