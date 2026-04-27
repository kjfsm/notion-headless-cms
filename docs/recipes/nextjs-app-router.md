# Next.js App Router レシピ

## インストール

```bash
pnpm add @notion-headless-cms/core @notion-headless-cms/notion-orm \
  @notion-headless-cms/renderer @notion-headless-cms/cache \
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
import { memoryCache } from "@notion-headless-cms/cache";
import { nextCache } from "@notion-headless-cms/cache/next";
import { createCMS } from "../generated/nhc";

// document は Next.js の unstable_cache + revalidateTag、image は in-process メモリ。
export const cms = createCMS({
  notionToken: process.env.NOTION_TOKEN!,
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
  const post = await cms.posts.get(slug);
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

`nextCache` の `invalidate` は以下の規約タグで `revalidateTag` を呼ぶ:

- `{ collection: "posts" }` → `nhc:col:posts`
- `{ collection: "posts", slug: "abc" }` → `nhc:col:posts:slug:abc:meta` と `nhc:col:posts:slug:abc:content`
- `"all"` → `nextCache({ tags })` で指定したユーザー定義タグを全て

Next.js の `fetch` や `unstable_cache` 側で同じ規約タグを付与すれば、
投稿の更新時に該当ページだけを再生成できる。
