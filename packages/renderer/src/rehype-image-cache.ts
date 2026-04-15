import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface ImageCachePluginOptions {
	imageProxyBase: string;
	cacheImage?: (notionUrl: string) => Promise<string>;
}

/**
 * rehype プラグイン: img 要素の src を Notion 画像キャッシュ経由のプロキシ URL に書き換える。
 * cacheImage が未指定の場合は何もしない。
 */
export const rehypeImageCache: Plugin<[ImageCachePluginOptions], Root> = (
	options,
) => {
	return async (tree) => {
		const { cacheImage } = options;
		if (!cacheImage) return;

		const images: Array<{ node: Element; url: string }> = [];

		visit(tree, "element", (node: Element) => {
			if (
				node.tagName === "img" &&
				node.properties?.src &&
				typeof node.properties.src === "string" &&
				node.properties.src.startsWith("http")
			) {
				images.push({ node, url: node.properties.src });
			}
		});

		if (images.length === 0) return;

		const uniqueUrls = [...new Set(images.map((i) => i.url))];
		const urlToProxy = new Map<string, string>();

		await Promise.all(
			uniqueUrls.map(async (url) => {
				const proxyUrl = await cacheImage(url);
				urlToProxy.set(url, proxyUrl);
			}),
		);

		for (const { node, url } of images) {
			const proxyUrl = urlToProxy.get(url);
			if (proxyUrl) {
				node.properties.src = proxyUrl;
			}
		}
	};
};
