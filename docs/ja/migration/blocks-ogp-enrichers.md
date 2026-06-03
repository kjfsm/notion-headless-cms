# `blocks` / `ogp` / `enrichers` → `content: blocksFetcher({...})`

`@notion-headless-cms/notion-orm` の `createNotionCollection({ blocks, ogp, enrichers })` は
v1.0.0 で削除されます。`content` オプションに `@notion-headless-cms/fetch-blocks` の
`blocksFetcher(...)` を渡す形式へ移行してください。

## 期限

- 非推奨マーク: v0.3.x
- **削除予定: v1.0.0**

## なぜ

- ブロック取得・OGP 付与・enricher 適用は「本文取得戦略」という 1 つの責務にまとまる
- `content` を別パッケージ (`fetch-blocks` / `fetch-markdown`) に分離することで、
  Notion Markdown 派と Notion Blocks 派を別の依存ツリーに分けられる
- `notion-orm` 本体の API 面積が縮み、v1 凍結後の保守が安定する

## 旧 API

```ts
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import { katexEnricher } from "@notion-headless-cms/notion-katex";

const posts = createNotionCollection({
  token,
  dataSourceId,
  blocks: { equation: customEquationHandler }, // 削除
  ogp: { timeoutMs: 3000 },                    // 削除
  enrichers: [katexEnricher()],                // 削除
});
```

## 新 API (v0.3.0 以降の推奨)

```ts
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import { blocksFetcher } from "@notion-headless-cms/fetch-blocks";
import { katexEnricher } from "@notion-headless-cms/notion-katex";

const posts = createNotionCollection({
  token,
  dataSourceId,
  content: blocksFetcher({
    blocks: { equation: customEquationHandler },
    ogp: { timeoutMs: 3000 },
    enrichers: [katexEnricher()],
  }),
});
```

Markdown 派は `blocksFetcher` の代わりに `@notion-headless-cms/fetch-markdown` の
`markdownFetcher(...)` を使ってください。

## 対応表

| 旧 (`createNotionCollection` 直下) | 新 (`content: blocksFetcher({...})` 内) |
| --- | --- |
| `blocks` | `blocks` |
| `ogp` | `ogp` |
| `enrichers` | `enrichers` |

オプション名はそのままなので、`content: blocksFetcher({ ...旧オプション })` で機械的に
置き換えできます。

## 自動チェック

v1.0.0 以降は `blocks` / `ogp` / `enrichers` が型から削除されるため、
そのまま渡すと `tsc --noEmit` で「既知のプロパティではありません」という
コンパイルエラーになります (0.3.x までは `@deprecated` の IDE 警告のみでした)。
`content: blocksFetcher({ blocks, ogp, enrichers })` へ移すとエラーは解消します。
