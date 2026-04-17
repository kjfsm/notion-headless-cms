import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList } from "unified";
import { unified } from "unified";
import { rehypeImageCache } from "./rehype-image-cache";
import type { RendererOptions } from "./types";

/**
 * MarkdownをHTMLに変換する。unified/remark/rehype パイプラインを使用。
 *
 * - cacheImage が指定された場合は Notion 画像 URL をプロキシ経由に変換する。
 * - render が指定された場合はデフォルトのパイプラインを置き換える。
 */
export async function renderMarkdown(
	markdown: string,
	options: RendererOptions = {},
): Promise<string> {
	const {
		imageProxyBase = "/api/images",
		cacheImage,
		remarkPlugins = [],
		rehypePlugins = [],
		render,
	} = options;

	if (render) {
		return render(markdown, {
			imageProxyBase,
			cacheImage: cacheImage ?? ((url) => Promise.resolve(url)),
		});
	}

	// unified の use はプラグイン追加のたびに型が変化するため any でブリッジする。
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const proc: any = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkPlugins as PluggableList)
		.use(remarkRehype)
		.use(rehypeImageCache, { imageProxyBase, cacheImage })
		.use(rehypePlugins as PluggableList)
		.use(rehypeStringify);

	const result = await proc.process(markdown);
	return String(result);
}
