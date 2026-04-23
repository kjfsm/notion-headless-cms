# Next.js App Router レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notion-headless-cms/cache-next \
  @notion-headless-cms/adapter-next \
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
import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache-next";
import { cmsDataSources } from "../generated/nhc-schema";

export const cms = createCMS({
  ...nodePreset({
    cache: {
      document: nextCache({ revalidate: 300, tags: ["posts"] }),
      // 画像は memory cache (Next.js の image cache は別レイヤー)
    },
    ttlMs: 5 * 60_000,
  }),
  dataSources: cmsDataSources,
});
```

## ページ一覧（Server Component）

```tsx
// app/posts/page.tsx
import { cms } from "@/lib/cms";

export default async function PostsPage() {
  const posts = await cms.posts.getList();
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
  return cms.posts.getStaticParams();
}

export default async function PostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await cms.posts.getItem(params.slug);
  if (!post) return <div>Not Found</div>;
  const html = await post.content.html();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
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

Notion に変更があった際に `POST /api/revalidate` を
`Authorization: Bearer <secret>` で叩くと、該当コレクション / slug の
キャッシュ規約タグ (`nhc:col:<name>` / `nhc:col:<name>:slug:<slug>`) が
`revalidateTag()` される。

## cache tag の命名規則

`cache-next` の `invalidate` は以下の規約タグで `revalidateTag` を呼ぶ:

- `{ collection: "posts" }` → `nhc:col:posts`
- `{ collection: "posts", slug: "abc" }` → `nhc:col:posts` と `nhc:col:posts:slug:abc`
- `"all"` → `nextCache({ tags })` で指定したユーザー定義タグを全て

Next.js の `fetch` や `unstable_cache` 側で同じ規約タグを付与すれば、
投稿の更新時に該当ページだけを再生成できる。
