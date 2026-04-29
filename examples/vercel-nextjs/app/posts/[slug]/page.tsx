import { notFound } from "next/navigation";
import { cms } from "@/app/lib/cms";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return await cms.posts.params();
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
  const post = await cms.posts.get(slug);
  if (!post) notFound();

  const html = await post.render();
  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">{post.slug}</h1>
      {post.publishedAt && (
        <time className="block text-sm text-gray-500 mb-8">
          {post.publishedAt}
        </time>
      )}
      <div className="prose dark:prose-invert">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </article>
  );
}
