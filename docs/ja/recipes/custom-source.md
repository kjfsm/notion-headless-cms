---
title: カスタムソース
description: Notion 以外のソースを実装する
category: レシピ
order: 6
---

# カスタムデータソースの実装

`DataSource<T>` インターフェースを実装することで、Notion 以外のバックエンドを利用できる。
独自の `DataSource<T>` 実装を `CMSAdapter` でラップして `createClient({ sources })` に渡す（または `collections` に直接渡す）。

## インターフェース

```ts
import type {
  DataSource,
  BaseContentItem,
  ListOptions,
} from "@notion-headless-cms/core";

interface MyItem extends BaseContentItem {
  title: string;
}

class MyCustomSource implements DataSource<MyItem> {
  readonly name = "my-custom-source";
  readonly publishedStatuses = ["published"] as const;
  readonly accessibleStatuses = ["published", "draft"] as const;

  async list(opts?: { publishedStatuses?: readonly string[] }): Promise<MyItem[]> {
    const items = await fetchFromMyAPI();
    if (opts?.publishedStatuses?.length) {
      return items.filter((i) =>
        i.status ? opts.publishedStatuses!.includes(i.status) : false,
      );
    }
    return items;
  }

  async findBySlug(slug: string): Promise<MyItem | null> {
    return fetchItemBySlugFromMyAPI(slug);
  }

  async loadMarkdown(item: MyItem): Promise<string> {
    return fetchMarkdownFromMyAPI(item.id);
  }
}
```

## createClient で利用

### 方法 1: `collections` に直接渡す（最も低レベル）

```ts
import { createClient, memoryCache } from "@notion-headless-cms/core";

const cms = createClient({
  collections: {
    posts: {
      source: new MyCustomSource(),
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["published"],
    },
  },
  cache: [memoryCache()],
  swr: { ttlMs: 5 * 60_000 },
});

const posts = await cms.posts.list();
const post = await cms.posts.find("my-post");
if (post) console.log(await post.render());
```

### 方法 2: `CMSAdapter` パッケージを作って `sources` に渡す（推奨）

`@notion-headless-cms/notion-source` と同じパターンで、宣言マージ（module augmentation）により `sources.<key>` を補完候補に追加できる。

```ts
// packages/my-source/src/index.ts
import type { CMSAdapter, CollectionDef } from "@notion-headless-cms/core";

declare module "@notion-headless-cms/core" {
  interface CMSSources {
    myStore?: CMSAdapter;
  }
}

export interface MySourceConfig {
  apiUrl: string;
  apiKey: string;
}

export function mySource(opts: MySourceConfig): CMSAdapter {
  return {
    collections: {
      posts: {
        source: new MyCustomSource(opts),
        slugField: "slug",
        statusField: "status",
        publishedStatuses: ["published"],
      } satisfies CollectionDef,
    },
  };
}
```

利用側:

```ts
import { createClient, memoryCache } from "@notion-headless-cms/core";
import { mySource } from "@example/my-source";

const cms = createClient({
  sources: {
    myStore: mySource({ apiUrl: "...", apiKey: "..." }),
  },
  cache: [memoryCache()],
});

await cms.posts.list();
```

`import { mySource } from "@example/my-source"` した時点で `sources.myStore` キーが補完候補として現れる（Fastify プラグインと同じパターン）。Notion 用ソースと混在させる場合は[マルチソースレシピ](./multi-source.md)を参照。

## エラー処理

カスタムソース内部のエラーは `CMSError` に包んで投げると、名前空間判定が効く。

```ts
import { CMSError } from "@notion-headless-cms/core";

async list() {
  try {
    return await fetchFromMyAPI();
  } catch (err) {
    throw new CMSError({
      code: "my-source/fetch_failed", // 任意の namespace/kind 文字列
      message: "Failed to fetch items from my backend.",
      cause: err,
      context: { operation: "MyCustomSource.list" },
    });
  }
}
```

呼び出し側では `isCMSErrorInNamespace(err, "my-source/")` で判定できる。
