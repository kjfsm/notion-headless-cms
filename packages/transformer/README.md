# @notion-headless-cms/transformer

Notion ブロック → Markdown 変換器。`notion-to-md` を内部で使用し、カスタムブロックハンドラーを追加できる。

## インストール

```bash
npm install @notion-headless-cms/transformer
```

通常は [`@notion-headless-cms/core`](../core) 経由で利用される。

## 使い方

```typescript
import {
  createTransformer,
  transformBlocks,
} from "@notion-headless-cms/transformer";
import { createNotionClient } from "@notion-headless-cms/fetcher";

const client = createNotionClient("notion_api_token");
const transformer = createTransformer(client);

const markdown = await transformBlocks(transformer, "page_id");
```

### カスタムブロックハンドラー

```typescript
import type { BlockHandler } from "@notion-headless-cms/transformer";

const calloutHandler: BlockHandler = async (block) => {
  // カスタム変換ロジック
  return { parent: `> ${block.callout?.rich_text[0]?.plain_text ?? ""}` };
};

const transformer = createTransformer(client, {
  callout: calloutHandler,
});
```

## API

| エクスポート | 説明 |
|---|---|
| `createTransformer(client, handlers?)` | トランスフォーマーを生成する |
| `transformBlocks(transformer, pageId)` | ページブロックを Markdown 文字列に変換する |
| `BlockHandler` | カスタムブロックハンドラーの型 |

## 関連パッケージ

- [`@notion-headless-cms/fetcher`](../fetcher) — ブロック取得
- [`@notion-headless-cms/renderer`](../renderer) — Markdown → HTML 変換
- [`@notion-headless-cms/core`](../core) — CMS エンジン（このパッケージを内部で使用）
