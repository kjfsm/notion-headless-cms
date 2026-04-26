# useSWR とのクライアントサイド連携

`@notion-headless-cms/core` v0.4.0 でメタデータと本文が独立したキー / API で扱えるようになりました。
これにより [useSWR](https://swr.vercel.app/) などのクライアントサイドキャッシュと自然に連携できます。

## 公開 API

| メソッド | 用途 | 戻り値 |
| --- | --- | --- |
| `cms.posts.getItemMeta(slug)` | メタデータのみ | `T \| null` |
| `cms.posts.getItemContent(slug)` | 本文ペイロード（HTML / Markdown / blocks） | `ItemContentPayload \| null` |
| `cms.posts.checkForUpdate({ slug, since })` | 差分判定。差分検出時は本文 cache を invalidate + バックグラウンド再生成 | `{ changed: false } \| { changed: true; meta: T }` |

`getItemMeta` / `getItemContent` の戻り値は **関数を含まない pure JSON**。
`useSWR` の cache に安全に格納でき、`Response.json()` でそのまま返せます。

## サーバ側ルート（Next.js / Hono / Workers いずれでも同形）

```ts
// app/api/posts/[slug]/meta/route.ts
import { cms } from "@/lib/cms";
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
	const meta = await cms.posts.getItemMeta(params.slug);
	return meta ? Response.json(meta) : new Response("Not Found", { status: 404 });
}

// app/api/posts/[slug]/content/route.ts
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
	const content = await cms.posts.getItemContent(params.slug);
	return content ? Response.json(content) : new Response("Not Found", { status: 404 });
}

// app/api/posts/[slug]/check/route.ts
export async function GET(req: Request, { params }: { params: { slug: string } }) {
	const since = new URL(req.url).searchParams.get("since") ?? "";
	const result = await cms.posts.checkForUpdate({ slug: params.slug, since });
	return Response.json(result);
}
```

## クライアント側 Component

```tsx
"use client";
import useSWR, { useSWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function Article({ slug }: { slug: string }) {
	const { data: meta } = useSWR<{ updatedAt: string; title?: string }>(
		`/api/posts/${slug}/meta`,
		fetcher,
	);
	// メタが先に来てから content を起動する
	const { data: content } = useSWR<{ html: string }>(
		meta ? `/api/posts/${slug}/content` : null,
		fetcher,
	);
	const { mutate } = useSWRConfig();

	// フォーカス時に差分検知 → mutate でローカルキャッシュを置き換え
	useSWR(
		meta ? ["check", slug, meta.updatedAt] : null,
		async () => {
			const r = await fetch(
				`/api/posts/${slug}/check?since=${encodeURIComponent(meta!.updatedAt)}`,
			).then((x) => x.json());
			if (r.changed) {
				// メタは戻り値で即時置換。本文はサーバ側でバックグラウンド再生成済みなので
				// `mutate(contentKey)` で SWR に再フェッチを起こさせるだけでよい。
				mutate(`/api/posts/${slug}/meta`, r.meta, { revalidate: false });
				mutate(`/api/posts/${slug}/content`);
			}
		},
		{ revalidateOnFocus: true },
	);

	return (
		<article>
			<h1>{meta?.title ?? "..."}</h1>
			<div dangerouslySetInnerHTML={{ __html: content?.html ?? "" }} />
		</article>
	);
}
```

## なぜこの形が「一番便利」か

- **メタは軽い**: `useSWR` の初回フェッチで HTML を含まず、TTFB が短い
- **本文は遅延**: メタ表示とは独立して content ロードが進む
- **差分検知が高速**: `checkForUpdate` は Notion メタのみ取得し、HTML 再生成は **バックグラウンド** で起こる
- **mutate で即時 UI 反映**: 戻り値の `meta` で楽観的更新、`mutate(contentKey)` でサーバ再フェッチを起動

## SSR との併用

サーバコンポーネント / SSR では `cms.posts.getItem(slug)` を引き続き使えます。
`getItem()` は **メタを即座に返し、`content.html()` / `content.markdown()` / `content.blocks()` の最初の呼び出し時に本文をロードします（lazy）**。

```tsx
// app/posts/[slug]/page.tsx
export default async function Page({ params }: { params: { slug: string } }) {
	const post = await cms.posts.getItem(params.slug);
	if (!post) notFound();
	const html = await post.content.html(); // ここで初めて本文 cache を読む
	return <article dangerouslySetInnerHTML={{ __html: html }} />;
}
```
