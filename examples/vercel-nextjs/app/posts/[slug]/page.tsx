import { notFound } from "next/navigation";
import { cms } from "../../lib/cms";

export const revalidate = 300;

export async function generateStaticParams() {
	try {
		return await cms.posts.getStaticParams();
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
	const post = await cms.posts.getItem(slug);
	if (!post) notFound();

	const html = await post.content.html();
	return (
		<article>
			<h1>{post.slug}</h1>
			{post.publishedAt && <time>{post.publishedAt}</time>}
			{post.author && <p>Author: {post.author}</p>}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
