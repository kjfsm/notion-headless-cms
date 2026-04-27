import { notFound } from "next/navigation";
import { cms } from "../../lib/cms";

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
		<article>
			<h1>{post.slug}</h1>
			{post.publishedAt && <time>{post.publishedAt}</time>}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
