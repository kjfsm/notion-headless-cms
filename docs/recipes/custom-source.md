# カスタムデータソースの実装

`DataSourceAdapter` インターフェースを実装することで、Notion 以外のバックエンドを利用できます。

## インターフェース

```ts
import type { DataSourceAdapter, BaseContentItem } from "@notion-headless-cms/core";

interface MyItem extends BaseContentItem {
  title: string;
}

class MyCustomSource implements DataSourceAdapter<MyItem> {
  readonly name = "my-custom-source";

  async list(opts?: { publishedStatuses?: readonly string[] }): Promise<MyItem[]> {
    // データ取得ロジック
    const items = await fetchFromMyAPI();
    if (opts?.publishedStatuses?.length) {
      return items.filter((i) => opts.publishedStatuses!.includes(i.status));
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

```ts
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  source: new MyCustomSource(),
  schema: { publishedStatuses: ["published"] },
});

const posts = await cms.list();
```
