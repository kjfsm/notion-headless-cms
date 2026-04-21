# @notion-headless-cms/transformer

> **⚠️ 内部パッケージ化済み**
> このパッケージは `"private": true` に変更され、npm に公開されなくなった。現在は [`@notion-headless-cms/source-notion`](../source-notion) 内部の `internal/transformer/` に取り込まれている。
>
> 直接利用していた場合は [`@notion-headless-cms/source-notion`](../source-notion) の `notionAdapter` に移行してほしい。

## 移行先

`notionAdapter` の `blocks` オプションでカスタムブロックハンドラを登録できる。

```typescript
import type { BlockHandler } from "@notion-headless-cms/source-notion";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { createCMS } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";

const calloutHandler: BlockHandler = async (block) => {
  return `> ${block.callout?.rich_text[0]?.plain_text ?? ""}`;
};

const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
    blocks: { callout: calloutHandler },
  }),
  renderer: renderMarkdown,
});
```

`cms.render(item)` を呼ぶと、登録したハンドラが適用された Markdown から HTML が生成される。

## 関連パッケージ

- [`@notion-headless-cms/source-notion`](../source-notion) — Notion データソース（旧 `fetcher` / `transformer` を取り込み済み）
- [`@notion-headless-cms/renderer`](../renderer) — Markdown → HTML 変換
- [`@notion-headless-cms/core`](../core) — CMS エンジン本体
