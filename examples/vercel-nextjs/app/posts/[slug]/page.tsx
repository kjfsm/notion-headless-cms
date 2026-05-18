import { Renderer } from "@notion-headless-cms/fetch-markdown/react";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import { notFound } from "next/navigation";
import { cms } from "@/app/lib/cms";

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

  // markdownFetcher 戦略で取得した Notion enhanced markdown。
  // <Renderer> は同期 (processSync) で React 木に変換するため RSC でもそのまま動く。
  const markdown = await post.markdown();

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <NotionRevalidator />
      <h1 className="text-3xl font-bold mb-4">{post.slug}</h1>
      {post.publishedAt && (
        <time className="block text-sm text-gray-500 mb-8">
          {post.publishedAt}
        </time>
      )}
      <Renderer content={{ markdown }} />
    </article>
  );
}
