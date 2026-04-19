# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース ID（共有リンクの URL から取得）

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/source-notion
```

## 最小構成（キャッシュなし・ローカル開発向け）

```ts
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
});

// 一覧取得
const posts = await cms.list();
console.log(posts);

// スラッグで取得してレンダリング
const rendered = await cms.renderBySlug("my-first-post");
console.log(rendered?.html);
```

## インメモリキャッシュ付き構成

```ts
import { createCMS, memoryCache, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: memoryCache(),
    image: memoryImageCache(),
    ttlMs: 5 * 60_000, // 5分
  },
});

// SWR でキャッシュ優先取得
const { items } = await cms.getList();
```

## 次のステップ

- [Cloudflare Workers + R2](./recipes/cloudflare-workers.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Node スクリプト](./recipes/nodejs-script.md)
- [カスタムデータソース](./recipes/custom-source.md)
