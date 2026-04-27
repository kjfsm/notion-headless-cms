# カスタムデータソースの実装

`DataSource<T>` インターフェースを実装することで、Notion 以外のバックエンドを利用できる。
CLI 生成の `createCMS` ラッパーではなく、core の `createCMS` を直接呼ぶ。

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

## createCMS で利用

core の `createCMS` に `collections` として渡す。`slugField` と `statusField` も指定する。

```ts
import { createCMS } from "@notion-headless-cms/core";
import { memoryCache } from "@notion-headless-cms/cache";

const cms = createCMS({
  collections: {
    posts: {
      source: new MyCustomSource(),
      slugField: "slug",
      statusField: "status",
      publishedStatuses: ["published"],
    },
  },
  cache: memoryCache(),
  ttlMs: 5 * 60_000,
});

const posts = await cms.posts.list();
const post = await cms.posts.get("my-post");
if (post) console.log(await post.render());
```

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
