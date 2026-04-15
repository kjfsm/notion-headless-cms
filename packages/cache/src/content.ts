import { marked, Renderer } from "marked";
import type { Post } from "@kjfsm/notion-core";
import { getPostMarkdown } from "@kjfsm/notion-core";
import type { CachedPost, NotionCacheEnv } from "./types";
import { getCachedImage, setCachedImage, sha256Hex } from "./cache";

// 画像配信エンドポイントの設定オプション。
export interface BuildOptions {
	/** 画像配信エンドポイントのプレフィックス（デフォルト: "/api/images"） */
	imageBaseUrl?: string;
}

// レスポンスヘッダまたはURLの拡張子からContent-Typeを推測する。ヘッダが優先。
function inferContentType(
	url: string,
	responseContentType: string | null,
): string {
	if (responseContentType?.startsWith("image/")) {
		return responseContentType.split(";")[0].trim();
	}
	if (url.includes(".png")) return "image/png";
	if (url.includes(".gif")) return "image/gif";
	if (url.includes(".webp")) return "image/webp";
	return "image/jpeg";
}

// Notion画像URLをfetchしてR2にキャッシュし、ハッシュキーを返す。既存キャッシュがあれば再fetchしない。
async function fetchAndCacheImage(
	bucket: R2Bucket,
	notionUrl: string,
): Promise<string> {
	const hash = await sha256Hex(notionUrl);

	const existing = await getCachedImage(bucket, hash);
	if (existing) return hash;

	try {
		const response = await fetch(notionUrl, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return hash;

		const data = await response.arrayBuffer();
		const contentType = inferContentType(
			notionUrl,
			response.headers.get("content-type"),
		);
		await setCachedImage(bucket, hash, data, contentType);
	} catch (err) {
		console.error("Failed to cache image:", notionUrl, err);
	}

	return hash;
}

// マークダウンをHTMLに変換し、Notion画像URLをR2キャッシュ経由のエンドポイントに書き換える。
// bucket が null/undefined の場合（ローカル開発環境等）はオリジナルURLをそのまま使用する。
async function processMarkdownWithImages(
	bucket: R2Bucket | null | undefined,
	markdown: string,
	imageBaseUrl: string,
): Promise<string> {
	// Pass 1: render markdown to HTML with placeholder data-notion-src attributes
	const renderer = new Renderer();
	renderer.image = ({ href, title, text }) => {
		const titleAttr = title ? ` title="${title}"` : "";
		return `<img data-notion-src="${href}" alt="${text}"${titleAttr}>`;
	};

	const rawHtml = await marked.parse(markdown, { renderer, gfm: true });

	const srcPattern = /data-notion-src="([^"]+)"/g;

	// R2が利用不可の場合、オリジナルURLをそのまま src に設定してフォールバック
	if (!bucket) {
		return rawHtml.replace(srcPattern, (_, url: string) => `src="${url}"`);
	}

	// Pass 2: find all data-notion-src attributes, fetch+cache images, rewrite to {imageBaseUrl}/{hash}
	const matches = [...rawHtml.matchAll(srcPattern)];

	// Deduplicate URLs
	const urlToHash = new Map<string, string>();
	await Promise.all(
		[...new Set(matches.map((m) => m[1]))].map(async (url) => {
			if (!url.startsWith("http")) return;
			const hash = await fetchAndCacheImage(bucket, url);
			urlToHash.set(url, hash);
		}),
	);

	// Replace data-notion-src="url" with src="{imageBaseUrl}/{hash}"
	return rawHtml.replace(srcPattern, (_, url: string) => {
		const hash = urlToHash.get(url);
		if (hash) return `src="${imageBaseUrl}/${hash}"`;
		// Graceful fallback: keep original URL if fetch failed
		return `src="${url}"`;
	});
}

// NotionポストのマークダウンをHTMLに変換し、画像もR2キャッシュ済みのCachedPostを返す。
export async function buildCachedPost(
	env: NotionCacheEnv,
	post: Post,
	options: BuildOptions = {},
): Promise<CachedPost> {
	const imageBaseUrl = options.imageBaseUrl ?? "/api/images";
	const markdown = await getPostMarkdown(env, post.id);
	const html = await processMarkdownWithImages(
		env.CACHE_BUCKET,
		markdown,
		imageBaseUrl,
	);

	return {
		html,
		post,
		notionLastEdited: post.lastEdited,
		cachedAt: Date.now(),
	};
}
