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

  // markdownFetcher 戦略を使っているため Notion ブロックツリーは取れない。
  // 代わりに post.html() を使う — lib/cms.ts の renderer (embed プロバイダ含む)
  // を通った HTML 文字列が返る。Notion 画像 URL は renderer 側で
  // imageProxyBase 経由のプロキシ URL に書き換えられている。
  const html = await post.html();

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
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: cms renderer の出力を信頼する */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
