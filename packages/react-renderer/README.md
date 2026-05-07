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

`createClient` 経由で取得すると、ブロックツリーが SWR キャッシュに乗り、画像 URL も
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

### 数式 (KaTeX) を使う

メインエントリの `Equation` は **bundle に `katex` を混入させないためのスタブ**で、`<pre>` で式をそのまま表示するだけ。整形描画したい場合は `@notion-headless-cms/react-renderer/equation` サブパスから差し込む。

```bash
pnpm add katex
```

利用側プロジェクトの CSS に `katex/dist/katex.min.css` を読み込むこと（Tailwind v4 なら `@import "katex/dist/katex.min.css"` を `@source` より前に置く）。`katex` は `peerDependencies` (optional) のため、数式を使わないユースケースではインストール不要。

#### Next.js App Router / React Server Components

`./equation` の `Equation` は `"use client"` 付きなので、**Server Component から直接 import** すれば Next.js が client reference として正しくシリアライズし、ルート単位で自動コードスプリットされる（`katex` は post ページの client chunk にのみ含まれる）。

```tsx
// app/posts/[slug]/page.tsx (Server Component)
import { Equation } from "@notion-headless-cms/react-renderer/equation";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";

export default async function Page() {
  return <NotionRenderer blocks={blocks} components={{ Equation }} />;
}
```

> **注**: `next/dynamic(() => import(".../equation"))` を Server Component で使うと、`Functions cannot be passed directly to Client Components` という RSC エラーになる。`next/dynamic` の戻り値（LoadableComponent 関数）は client reference として serialize できないため。次節の wrapper パターンを使うか、上記の直接 import で十分。

#### Pages Router / Client Component (rnx 流の細粒度レイジー)

ルート単位ではなく **「数式を実際に含むページでだけ katex chunk を fetch」** したい場合は、`"use client"` を付けた wrapper コンポーネント内で `next/dynamic` を使う。Pages Router でもそのまま動く。

```tsx
// components/notion-content.tsx
"use client";

import dynamic from "next/dynamic";
import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";

// 数式が render される瞬間まで katex を fetch しない（route 単位より細かい lazy）
const Equation = dynamic(() =>
  import("@notion-headless-cms/react-renderer/equation").then((m) => m.Equation),
);

export function NotionContent({ blocks }: { blocks: NotionBlock[] }) {
  return <NotionRenderer blocks={blocks} components={{ Equation }} />;
}
```

```tsx
// app/posts/[slug]/page.tsx (Server Component)
import { NotionContent } from "@/components/notion-content";

export default async function Page() {
  return <NotionContent blocks={blocks} />;
}
```

#### 非 Next.js 環境（Vite / React Router 等）

SSR 環境ではルート単位でコードスプリットされるため、`./equation` を直接 static import すれば十分。

```tsx
import { Equation } from "@notion-headless-cms/react-renderer/equation";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";

<NotionRenderer blocks={blocks} components={{ Equation }} />;
```

## Notion 更新の表示反映 (`/router`, `/next`)

Notion のページを編集したあと、開いている画面を**静かに最新化**するためのフックとコンポーネント。クエリ無し・別 API への fetch 無しで、フレームワーク本来の再評価機構（loader / RSC）だけを使う。

### React Router v7

```tsx
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/router";

export default function Post() {
  return (
    <article>
      <NotionRevalidator />
      {/* ... */}
    </article>
  );
}
```

内部で `useRevalidator()` を呼び loader を再走させる。サーバ側で `cloudflarePreset({ env, ctx })` 等により `waitUntil` が配線されていれば、前回訪問時の SWR bg 更新で KV が最新化されており、再呼び出しで新内容が返って画面が差し替わる。

### Next.js App Router

```tsx
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";

export default async function Page({ params }) {
  // ...
  return (
    <article>
      <NotionRevalidator />
      {/* ... */}
    </article>
  );
}
```

内部で `useRouter().refresh()` を呼び、Server Component を再評価して RSC ストリーム差分で UI を更新する。

### オプション

| プロップ / オプション | 既定値 | 説明 |
|---|---|---|
| `on` | `"mount"` | 発火タイミング。`"mount"` / `"visibility"` / 配列で複数指定可 |

```tsx
<NotionRevalidator on={["mount", "visibility"]} />
// マウント時 + タブが visible に戻った時の両方で再評価
```

フック版 `useNotionRevalidate(opts)` も同じシグネチャで提供。React 非依存の素 HTML 向けには `@notion-headless-cms/core/html` の `notionRevalidatorScript()` を使う。

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
