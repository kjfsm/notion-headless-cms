---
title: Next.js App Router
description: Next.js で nhc を使う
category: レシピ
order: 1
---

# Next.js App Router レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-source \
  @notion-headless-cms/cache @notion-headless-cms/adapter-next \
  @notionhq/client zod \
  unified remark-parse remark-gfm remark-rehype rehype-stringify
pnpm add -D @notion-headless-cms/cli
```

## スキーマ生成

```bash
npx nhc init
# nhc.config.ts を編集
NOTION_TOKEN=secret_xxx npx nhc generate
```

## CMS インスタンスの作成

```ts
// app/lib/cms.ts
import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createClient } from "@notion-headless-cms/core";
import { notionSource } from "@notion-headless-cms/notion-source";
import { schema } from "@/app/generated/nhc.schema";

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createClient({
  sources: {
    notion: notionSource({
      schema,
      token: process.env.NOTION_TOKEN!,
      publishOptions: {
        posts: { publishedStatuses: ["公開済み"] },
      },
    }),
  },
  cache: [nextCache({ revalidate: 300, tags: ["posts"] }), memoryCache()],
});
```

`nextCache` は `unstable_cache` でラップするため document キャッシュを担当し、
`memoryCache` が画像キャッシュを担当する。配列の先着順でアダプタが振り分けられる。

## ページ一覧（Server Component）

```tsx
// app/posts/page.tsx
import { cms } from "@/lib/cms";

export const revalidate = 300;

export default async function PostsPage() {
  const posts = await cms.posts.list();
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>{post.slug}</li>
      ))}
    </ul>
  );
}
```

## 静的生成（generateStaticParams）

```tsx
// app/posts/[slug]/page.tsx
import { cms } from "@/lib/cms";

export async function generateStaticParams() {
  return cms.posts.params();
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) return <div>Not Found</div>;
  const html = await post.render();
  return (
    <article>
      <h1>{post.slug}</h1>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
```

## クライアント側の表示更新

Notion を更新したとき、画面を**静かに切り替える**には `<NotionRevalidator />` を Server Component に置くだけ。内部で `useRouter().refresh()` を呼び、現ルートの Server Component を再評価して RSC ストリーム差分で UI を更新する。クエリも別 API fetch も発生しない。

```tsx
// app/posts/[slug]/page.tsx
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import { cms } from "@/lib/cms";

export default async function Page({ params }) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) notFound();
  return (
    <article>
      <NotionRevalidator />
      <h1>{post.slug}</h1>
      {/* ... */}
    </article>
  );
}
```

`<NotionRevalidator on="visibility" />` でタブ可視化のたびに、`<NotionRevalidator on={["mount", "visibility"]} />` で両方発火させられる（既定はマウント時 1 回のみ）。

## 画像配信・Webhook の統合ルート

```ts
// app/api/cms/[...route]/route.ts
import { cms } from "@/lib/cms";
import { createNextHandler } from "@notion-headless-cms/adapter-next";

export const { GET, POST } = createNextHandler(cms, {
  webhookSecret: process.env.REVALIDATE_SECRET,
});
```

`createNextHandler` は画像プロキシ (`GET /api/cms/images/:hash`) と
Webhook 受信 (`POST /api/cms/revalidate`) をまとめて処理する。
Notion に変更があった際に `POST /api/cms/revalidate` を
`Authorization: Bearer <secret>` で叩くと、該当コレクション / slug の
キャッシュ規約タグ (`nhc:col:<name>` / `nhc:col:<name>:slug:<slug>`) が
`revalidateTag()` される。

## cache tag の命名規則

`nextCache` の `invalidate` は以下の規約タグで `revalidateTag` を呼ぶ:

- `{ collection: "posts" }` → `nhc:col:posts`
- `{ collection: "posts", slug: "abc" }` → `nhc:col:posts:slug:abc:meta` と `nhc:col:posts:slug:abc:content`
- `"all"` → `nextCache({ tags })` で指定したユーザー定義タグを全て

Next.js の `fetch` や `unstable_cache` 側で同じ規約タグを付与すれば、
投稿の更新時に該当ページだけを再生成できる。
