# @notion-headless-cms/react-renderer

Notion API のブロックレスポンスを **React コンポーネントとして直接描画**するレンダラ。
`notion-to-md` / Markdown 経由ではなく、`BlockObjectResponse` を 1:1 で React ツリーに変換する。

UI プリミティブは [shadcn/ui](https://ui.shadcn.com/) (`new-york` style) 由来、スタイルは **Tailwind v4** ユーティリティクラスで完結する。

## インストール

```bash
pnpm add @notion-headless-cms/react-renderer @notion-headless-cms/notion-orm @notionhq/client react react-dom
```

利用側プロジェクトに **Tailwind v4 のセットアップが必須**。`tailwind.config` で本パッケージのソースをスキャン対象に含める:

```ts
// tailwind.config.ts (Tailwind v4 では @source を使う方式でも可)
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@notion-headless-cms/react-renderer/dist/**/*.{js,mjs}",
  ],
};
```

## 使い方

```tsx
import { Client } from "@notionhq/client";
import { fetchBlockTree } from "@notion-headless-cms/notion-orm";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";

const client = new Client({ auth: process.env.NOTION_TOKEN });
const blocks = await fetchBlockTree(client, pageId);

export default function Page() {
  return <NotionRenderer blocks={blocks} />;
}
```

### `@notion-headless-cms/core` と組み合わせて使う (推奨)

`createCMS` 経由で取得すると、ブロックツリーが SWR キャッシュに乗り、画像 URL も
`cms.cacheImage` 経由で永続プロキシ URL に書き換えられる (Notion 署名 URL の失効対策)。

```tsx
import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
// "use client" を含まないサーバーサイド専用エントリ
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";

const post = await cms.posts.find(slug);
const notionBlocks =
  ((await post?.notionBlocks()) as NotionBlock[] | undefined) ?? [];
const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);

return <NotionRenderer blocks={blocks} />;
```

- `cms.posts.find(slug).notionBlocks()` — ブロックツリーをキャッシュ経由で取得 (`DataSource.loadNotionBlocks` を実装している場合のみ。`@notion-headless-cms/notion-orm` は対応済み)
- `resolveBlockImageUrls(blocks, cacheImage)` — `image` / `video` / `audio` / `file` / `pdf` の `file` 型 URL を `cacheImage(url)` で書き換えた**新しい**ツリーを返す。`cacheImage` が `undefined` のときは入力をそのまま返す。`external` 型は触らない。children も再帰的に処理する
- このサブパスは React Server Component やサーバーローダから呼び出すために `"use client"` を含めていない

### コンポーネント差し替え

```tsx
import { NotionRenderer, type ComponentOverrides } from "@notion-headless-cms/react-renderer";

const components: ComponentOverrides = {
  Code: MyCustomCode, // 既定の shiki ベース実装を上書き
};

<NotionRenderer blocks={blocks} components={components} />;
```

## 対応ブロック

paragraph / heading_1-3 / bulleted_list_item / numbered_list_item / to_do / toggle / callout /
quote / code / equation / divider / image / video / audio / file / pdf / bookmark / link_preview /
link_to_page / child_page / child_database / embed / table / table_row / column_list / column /
synced_block / breadcrumb / table_of_contents / unsupported

## 設計

- 入力は `fetchBlockTree` が返す **children を再帰解決済みのツリー**
- 全コンポーネントに `"use client"` ディレクティブが付き、Next.js App Router の server component から `<NotionRenderer>` を直接呼べる
- 連続する `bulleted_list_item` / `numbered_list_item` は内部で `<ul>` / `<ol>` にグループ化される
- interactive embed (Twitter widgets / YouTube facade) は副作用を hook で隔離
