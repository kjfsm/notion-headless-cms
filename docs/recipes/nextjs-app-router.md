# Next.js App Router レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/source-notion \
         @notion-headless-cms/cache-next @notion-headless-cms/adapter-next
```

## CMS インスタンスの作成

```ts
// lib/cms.ts
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { nextCache } from "@notion-headless-cms/cache-next";

export const cms = createCMS({
  source: notionAdapter({
    token: process.env.NOTION_TOKEN!,
    dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
  }),
  schema: { publishedStatuses: ["公開"] },
  cache: {
    document: nextCache({ revalidate: 300, tags: ["posts"] }),
    image: memoryImageCache(),
  },
});
```

## ページ一覧（Server Component）

```ts
// app/posts/page.tsx
import { cms } from "@/lib/cms";

export default async function PostsPage() {
  const { items } = await cms.getList();
  return (
    <ul>
      {items.map((post) => (
        <li key={post.slug}>{post.slug}</li>
      ))}
    </ul>
  );
}
```

## 静的生成（generateStaticParams）

```ts
// app/posts/[slug]/page.tsx
import { cms } from "@/lib/cms";

export async function generateStaticParams() {
  const slugs = await cms.getStaticSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await cms.renderBySlug(params.slug);
  if (!post) return <div>Not Found</div>;
  return <div dangerouslySetInnerHTML={{ __html: post.html }} />;
}
```

## 画像配信ルート

```ts
// app/api/images/[hash]/route.ts
import { cms } from "@/lib/cms";
import { createImageRouteHandler } from "@notion-headless-cms/adapter-next";

export const GET = createImageRouteHandler(cms);
```

## Revalidate Webhook

```ts
// app/api/revalidate/route.ts
import { cms } from "@/lib/cms";
import { createRevalidateRouteHandler } from "@notion-headless-cms/adapter-next";

export const POST = createRevalidateRouteHandler(cms, {
  secret: process.env.REVALIDATE_SECRET!,
});
```

Notion に変更があった際に `POST /api/revalidate` を `Authorization: Bearer <secret>` で叩くと、
`cms.syncFromWebhook()` が呼ばれてキャッシュが再生成されます。
