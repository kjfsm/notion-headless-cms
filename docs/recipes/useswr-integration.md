# useSWR とのクライアントサイド連携

`@notion-headless-cms/core` の `cms.posts.find()` / `cms.posts.list()` は
Server Component / SSR での直接呼び出しを前提とした設計だが、
サーバ側で API ルートを立てることで [useSWR](https://swr.vercel.app/) などの
クライアントサイドキャッシュとも自然に連携できる。

## サーバ側 API ルート（Next.js）

```ts
// app/api/posts/route.ts
import { cms } from "@/lib/cms";

export async function GET() {
  const posts = await cms.posts.list();
  return Response.json(posts);
}
```

```ts
// app/api/posts/[slug]/route.ts
import { cms } from "@/lib/cms";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) return new Response("Not Found", { status: 404 });
  const html = await post.render();
  return Response.json({ ...post, html });
}
```

Hono / Cloudflare Workers でも同形で書ける。

## クライアント側 Component

```tsx
"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PostsList() {
  const { data: posts, isLoading } = useSWR<{ slug: string; title?: string }[]>(
    "/api/posts",
    fetcher,
  );
  if (isLoading) return <p>Loading…</p>;
  return (
    <ul>
      {posts?.map((p) => <li key={p.slug}>{p.title ?? p.slug}</li>)}
    </ul>
  );
}

export function Article({ slug }: { slug: string }) {
  const { data } = useSWR<{ html: string; slug: string }>(
    `/api/posts/${slug}`,
    fetcher,
  );
  if (!data) return <p>Loading…</p>;
  return (
    <article>
      <h1>{data.slug}</h1>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
      <div dangerouslySetInnerHTML={{ __html: data.html }} />
    </article>
  );
}
```

## Webhook で useSWR を即時更新する

Notion Webhook → API ルートでキャッシュを invalidate した後、
クライアント側で `mutate` を叩くと useSWR のキャッシュもリフレッシュされる。

```tsx
"use client";
import useSWR, { useSWRConfig } from "swr";
import { useEffect } from "react";

export function LiveArticle({ slug }: { slug: string }) {
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{ html: string }>(`/api/posts/${slug}`, fetcher, {
    refreshInterval: 60_000, // 1分ごとに自動リフレッシュ
  });

  // ページフォーカス時に強制リフレッシュ
  useEffect(() => {
    const onFocus = () => mutate(`/api/posts/${slug}`);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [slug, mutate]);

  return (
    <article>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
      <div dangerouslySetInnerHTML={{ __html: data?.html ?? "" }} />
    </article>
  );
}
```

## SSR との併用

Server Component では `cms.posts.find(slug)` を引き続き使う。
SSR で初期 HTML を返しつつ、クライアントで `useSWR` を起動するパターン:

```tsx
// app/posts/[slug]/page.tsx (Server Component)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) notFound();
  const html = await post.render();

  return (
    <article>
      <h1>{post.slug}</h1>
      {/* 初期描画は SSR 済み HTML を使い、クライアント側で useSWR が引き継ぐ */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
```

## なぜ API ルート経由が「一番便利」か

- **SWR の cache キー管理が明快**: URL がキーになるため、`mutate` でのリフレッシュが直感的
- **ストリーミング対応**: Next.js の `Suspense` + `useSWR` を組み合わせると、本文の遅延ロードが容易
- **Webhook との相性**: `revalidateTag` / `cms.posts.cache.invalidate()` の後に `mutate` を呼ぶだけで連動する
