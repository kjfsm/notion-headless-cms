import { fetchBlockTree } from "@notion-headless-cms/notion-orm";
import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { Client } from "@notionhq/client";
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

  // react-renderer は Notion API のブロック木を直接消費するため、HTML 変換ではなく
  // fetchBlockTree でツリーを取得して React で描画する。
  const client = new Client({ auth: process.env.NOTION_TOKEN });
  const blocks = await fetchBlockTree(client, post.id);

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
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
