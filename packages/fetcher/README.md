# @notion-headless-cms/fetcher

> **⚠️ 内部パッケージ化済み**
> このパッケージは `"private": true` に変更され、npm に公開されなくなった。現在は [`@notion-headless-cms/source-notion`](../source-notion) 内部の `internal/fetcher/` に取り込まれている。
>
> 直接利用していた場合は [`@notion-headless-cms/source-notion`](../source-notion) の `notionAdapter` に移行してほしい。

## 移行先

```typescript
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
});

const items = await cms.list();
```

Notion API の生レスポンスが必要な場合は `source-notion` 経由で `DataSourceAdapter` をラップするか、`@notionhq/client` を直接利用することを推奨する。

## 関連パッケージ

- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース（旧 `fetcher` / `transformer` を取り込み済み）
- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
