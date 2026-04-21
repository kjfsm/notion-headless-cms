# カスタムデータソースの実装

`DataSourceAdapter` インターフェースを実装することで、Notion 以外のバックエンドを利用できる。

## インターフェース

```ts
import type {
  DataSourceAdapter,
  BaseContentItem,
  SourceQueryOptions,
  SourceQueryResult,
} from "@notion-headless-cms/core";

interface MyItem extends BaseContentItem {
  title: string;
}

class MyCustomSource implements DataSourceAdapter<MyItem> {
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

  // オプション: ソース側でフィルタ・ソートをサポートすると
  // QueryBuilder が push-down する（where() 未使用時のみ）
  async query(opts: SourceQueryOptions): Promise<SourceQueryResult<MyItem>> {
    const { items, hasMore, nextCursor } = await queryMyAPI({
      statuses: opts.filter?.statuses,
      tags: opts.filter?.tags,
      sort: opts.sort,
      pageSize: opts.pageSize,
      cursor: opts.cursor,
    });
    return { items, hasMore, nextCursor };
  }
}
```

## createCMS で利用

```ts
import { createCMS } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const cms = createCMS({
  source: new MyCustomSource(),
  renderer: renderMarkdown,
});

const posts = await cms.list();
const post = await cms.find("my-post");
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
