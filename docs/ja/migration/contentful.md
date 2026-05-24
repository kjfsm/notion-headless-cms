# Contentful から `@notion-headless-cms` への移行 (DataSourceAdapter 自作ガイド)

Contentful を使っていて、Notion 以外のデータソースを `@notion-headless-cms` の
キャッシュ・SWR・renderer エコシステムに乗せたい場合の最小手順です。

## 概念対応表

| Contentful | `@notion-headless-cms` | 備考 |
| --- | --- | --- |
| Space | (なし) | DataSource 単位で吸収 |
| Content Type | `CollectionDef<T>` | `defineCollection<T>({...})` で型付け (M3) |
| Entry | `BaseContentItem` 拡張 | `id` / `slug` / `lastEditedTime` 等 |
| Rich Text Field | Markdown / Blocks AST | `loadMarkdown()` で Markdown を返す |
| Asset | 画像プロキシ URL | `cms.cacheImage` で永続化 |
| Webhook | `cms.parseWebhookFor` | 署名検証 + invalidate |
| Localization | (未対応) | source 側でロケール分岐 |

## DataSourceAdapter の自作

`DataSource<T>` インターフェース ([`packages/core/src/types/data-source.ts`]) を実装します。
最低限必要なのは `name` / `list` / `loadMarkdown` / `getLastModified` の 4 つ。

```ts
import type { DataSource, BaseContentItem } from "@notion-headless-cms/core";
import { createClient } from "contentful";

interface ContentfulPost extends BaseContentItem {
  body: string;
}

export function contentfulSource(opts: {
  spaceId: string;
  accessToken: string;
  contentType: string;
}): DataSource<ContentfulPost> {
  const client = createClient({
    space: opts.spaceId,
    accessToken: opts.accessToken,
  });

  return {
    name: "contentful",

    async list() {
      const res = await client.getEntries({ content_type: opts.contentType });
      return res.items.map((e) => ({
        id: e.sys.id,
        slug: String(e.fields.slug),
        title: String(e.fields.title),
        lastEditedTime: e.sys.updatedAt,
        body: String(e.fields.body),
      }));
    },

    async loadMarkdown(item) {
      return item.body;
    },

    getLastModified(item) {
      return item.lastEditedTime;
    },

    getListVersion() {
      // 任意の version トークン。空文字なら毎回再フェッチ。
      return "";
    },
  };
}
```

`findByProp` / `loadBlocks` / `properties` は省略可能。実装すると `find()` を効率化できます。

## CMSAdapter として組み込む

`DataSource<T>` を直接 `createClient` に渡すのではなく、`CMSAdapter` でラップして
コレクション集合として登録します。

```ts
import { createClient, defineCollection, nodePreset } from "@notion-headless-cms/core";

const source = contentfulSource({
  spaceId: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_ACCESS_TOKEN!,
  contentType: "post",
});

declare module "@notion-headless-cms/core" {
  interface CMSSources {
    contentful?: { readonly collections: { posts: ReturnType<typeof defineCollection<ContentfulPost>> } };
  }
}

export const cms = createClient({
  sources: {
    contentful: {
      collections: {
        posts: defineCollection<ContentfulPost>({
          source,
          slugField: "slug",
        }),
      },
    },
  },
  ...nodePreset(),
});
```

## 動作確認

1. `cms.posts.list()` で Entry がそのまま並ぶ
2. `cms.posts.find(slug)` でメタ → `html()` で markdown → HTML 変換が走る
3. Webhook を使う場合は `cms.handler({ webhookSecret })` を従来どおり登録

## 注意点

- `lastEditedTime` は ISO 8601 文字列必須。Contentful の `sys.updatedAt` は
  そのまま使えます
- 画像は Contentful Asset の URL を `cms.cacheImage` 経由で永続キャッシュに
  保存し、フロントには `/api/images/<hash>` を渡してください
- Localization が必要なら locale ごとに別 collection (`posts_ja` / `posts_en`)
  として登録するのが現状の推奨

## 参考

- `DataSource<T>` 型定義: `packages/core/src/types/data-source.ts`
- 既存実装の例: `packages/notion-source/src/index.ts`
- 公式の `DataSourceAdapter` 拡張ポイント: [`CMSSources`](../api/cms-methods.md)
