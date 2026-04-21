# クイックスタート（5分で動かす）

## 必要なもの

- Notion API トークン（[Notion Developers](https://www.notion.so/my-integrations) で取得）
- Notion データベース ID（共有リンクの URL から取得）
- Node.js 22 以降

## インストール

```bash
pnpm add @notion-headless-cms/adapter-node
```

`adapter-node` は `core` / `source-notion` / `renderer` を推移依存として含むため、個別インストールは不要。

## 最小構成（キャッシュなし・ローカル開発向け）

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

// NOTION_TOKEN / NOTION_DATA_SOURCE_ID は process.env から自動読み込み
const cms = createNodeCMS({
  schema: { publishedStatuses: ["公開"] },
});

// 一覧取得（ソース直接）
const posts = await cms.list();
console.log(posts);

// スラッグで取得 → Markdown/HTML レンダリング
const post = await cms.find("my-first-post");
if (post) {
  const rendered = await cms.render(post);
  console.log(rendered.html);
}
```

## インメモリキャッシュ付き構成

```ts
import { createNodeCMS } from "@notion-headless-cms/adapter-node";

const cms = createNodeCMS({
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: "memory",
    image: "memory",
    ttlMs: 5 * 60_000, // 5分
  },
});

// SWR でキャッシュ優先取得
const { items, isStale, cachedAt } = await cms.cached.list();

// SWR で単一アイテム取得（HTML 付き）
const cached = await cms.cached.get("my-first-post");
console.log(cached?.html);
```

## core を直接使う（アダプタを使わない構成）

アダプタを経由せず、`createCMS` に自分で `source` / `renderer` / `cache` を組み立てることもできる。

```ts
import { createCMS, memoryDocumentCache, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  renderer: renderMarkdown,
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: memoryDocumentCache(),
    image: memoryImageCache(),
    ttlMs: 5 * 60_000,
  },
});
```

## 次のステップ

- [Cloudflare Workers + R2](./recipes/cloudflare-workers.md)
- [Next.js App Router](./recipes/nextjs-app-router.md)
- [Node スクリプト](./recipes/nodejs-script.md)
- [カスタムデータソース](./recipes/custom-source.md)
- [CMS メソッド一覧](./api/cms-methods.md)
