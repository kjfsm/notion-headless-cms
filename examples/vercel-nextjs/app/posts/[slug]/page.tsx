import {
  type NotionBlock,
  NotionRenderer,
} from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import { resolveBlockImageUrls } from "@notion-headless-cms/react-renderer/server";
import { notFound } from "next/navigation";
import { cms } from "@/app/lib/cms";

// v0.2 以降は KaTeX / mermaid が既定で動的 import されるため、明示的な
// components={{ Equation }} 渡しは不要。`katex` を peer に入れているだけで動く。

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await cms.posts.params()).map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await cms.posts.find(slug);
  if (!post) notFound();

  // notionBlocks() は cms キャッシュ (SWR) 経由で取得されるため、
  // ページごとに毎回 Notion API を叩かない。画像 URL は cms.cacheImage で
  // プロキシ URL へ事前解決し、Notion 署名 URL の期限切れを回避する。
  const notionBlocks =
    ((await post.notionBlocks()) as NotionBlock[] | undefined) ?? [];
  const blocks = await resolveBlockImageUrls(notionBlocks, cms.cacheImage);

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      {/* ハイドレーション後に router.refresh() を呼び、Server Component を再評価
          させる。サーバ側 SWR で差し替えられた最新内容を、クエリ無し・別 API
          fetch 無しで RSC ストリームとして取り込む。 */}
      <NotionRevalidator />
      <h1 className="text-3xl font-bold mb-4">{post.slug}</h1>
      {post.publishedAt && (
        <time className="block text-sm text-gray-500 mb-8">
          {post.publishedAt}
        </time>
      )}
      <NotionRenderer blocks={blocks} />
    </article>
  );
}
