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
  Code: MyCustomCode, // 既定の Code 実装を上書き
};

<NotionRenderer blocks={blocks} components={components} />;
```

### 数式 (KaTeX) / mermaid 図を使う

v0.2 以降、block / inline equation は **既定で動的 import** されるため、`katex` を peer に入れるだけで自動的に整形される（サブパス `react-renderer/equation` は廃止）。同様に `code` ブロックの `language === "mermaid"` も既定で `mermaid` を動的 import して SVG にレンダする。

```bash
pnpm add katex mermaid
```

利用側プロジェクトの CSS に `katex/dist/katex.min.css` を読み込むこと（Tailwind v4 なら `@import "katex/dist/katex.min.css"` を `@source` より前に置く）。`katex` / `mermaid` はいずれも optional peer なので、数式・mermaid を使わない構成では未インストールでよく、ブロックが現れた瞬間にだけ chunk が fetch される（route より細かい lazy）。

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
| `on` | `"mount"` | 発火タイミング。`"mount"` / `"visibility"` / 配列で複数指定可。`poll` 指定時は既定が `[]`（空）になる |
| `poll.url` | — | `peekVersion` を返すエンドポイント URL |
| `poll.version` | — | ページロード時の `item.lastEditedTime`（比較基準） |
| `poll.intervalMs` | `500` | ポーリング間隔（ms） |
| `poll.timeoutMs` | `30000` | タイムアウト（ms） |

```tsx
<NotionRevalidator on={["mount", "visibility"]} />
// マウント時 + タブが visible に戻った時の両方で再評価

<NotionRevalidator
  poll={{ url: `/api/posts/${item.slug}/check`, version: item.lastEditedTime }}
/>
// KV ポーリング: バックグラウンド SWR 更新の完了を検出してから revalidate
// notionUpdatedAt 変化 → 即 revalidate / cachedAt 変化（確認完了・更新なし）→ 停止
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
