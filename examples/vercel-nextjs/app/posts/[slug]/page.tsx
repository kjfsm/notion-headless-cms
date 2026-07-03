import { NotionRenderer } from "@notion-headless-cms/react-renderer";
import { NotionRevalidator } from "@notion-headless-cms/react-renderer/next";
import {
  denormalizeBlocks,
  toPageLinkMap,
} from "@notion-headless-cms/react-renderer/v3";
import { notFound } from "next/navigation";
import { cms, ensureSynced } from "@/app/lib/cms";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    await ensureSynced();
    const { items } = await cms.posts.list();
    return items.map((item) => ({ slug: item.slug }));
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
  await ensureSynced();
  const post = await cms.posts.find(slug);
  if (!post) notFound();

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <NotionRevalidator />
      <h1 className="text-3xl font-bold mb-4">{post.slug}</h1>
      {post.meta.publishedAt && (
        <time className="block text-sm text-gray-500 mb-8">
          {post.meta.publishedAt}
        </time>
      )}
      <NotionRenderer
        blocks={denormalizeBlocks(post.blocks)}
        pageLinks={toPageLinkMap(post.links)}
      />
    </article>
  );
}
