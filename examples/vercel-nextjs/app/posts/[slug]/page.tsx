import { notFound } from "next/navigation";
import { cms } from "../../lib/cms";

export const revalidate = 300;

export async function generateStaticParams() {
	try {
		const slugs = await cms.getStaticSlugs();
		return slugs.map((slug) => ({ slug }));
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
	const entry = await cms.cache.get(slug);
	if (!entry) notFound();

	const { html, item } = entry;
	return (
		<article>
			<h1>{item.slug}</h1>
			{item.publishedAt && <time>{item.publishedAt}</time>}
			{item.author && <p>Author: {item.author}</p>}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Notion レンダリング結果を表示 */}
			<div dangerouslySetInnerHTML={{ __html: html }} />
		</article>
	);
}
