/**
 * DLsite アフィリエイト + Steam ウィジェットが
 * allowDangerousHtml + embedRehypePlugins を通して正しく出力されることを検証する。
 */

import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { dlsiteProvider } from "../providers/dlsite";
import { steamProvider } from "../providers/steam";
import { embedRehypePlugins } from "../rehype/rehype-sanitize-embeds";

async function renderWithPlugins(markdown: string): Promise<string> {
	const providers = [dlsiteProvider(), steamProvider()];
	const rehypePlugins = await embedRehypePlugins({ providers });

	const processor = unified()
		.use(remarkParse)
		.use(remarkRehype, { allowDangerousHtml: true })
		// rehypePlugins は [plugin, options] 配列なので個別 use ではなくまとめて適用する
		.use(rehypePlugins)
		.use(rehypeStringify);

	const result = await processor.process(markdown);
	return String(result);
}

describe("DLsite アフィリエイト HTML の通過", () => {
	const dlsiteHtml = `<a rel="noopener sponsored" href="https://dlaf.jp/sample" target="_blank"><img itemprop="image" src="https://img.dlsite.jp/sample.jpg" alt="" border="0" /></a>`;

	it("DLsite の <a> タグが出力に残る", async () => {
		const result = await renderWithPlugins(dlsiteHtml);
		expect(result).toContain("<a");
		expect(result).toContain("dlaf.jp/sample");
	});

	it("DLsite の <img> タグが出力に残る", async () => {
		const result = await renderWithPlugins(dlsiteHtml);
		expect(result).toContain("<img");
		expect(result).toContain("img.dlsite.jp/sample.jpg");
	});

	it("rel=noopener sponsored が出力に含まれる", async () => {
		const result = await renderWithPlugins(dlsiteHtml);
		expect(result).toContain("noopener");
	});
});

describe("Steam ウィジェット <iframe> の通過", () => {
	const steamHtml = `<iframe src="https://store.steampowered.com/widget/2516990/" frameborder="0" width="646" height="190"></iframe>`;

	it("Steam の <iframe> タグが出力に残る", async () => {
		const result = await renderWithPlugins(steamHtml);
		expect(result).toContain("<iframe");
		expect(result).toContain("store.steampowered.com/widget/2516990/");
	});

	it("width / height 属性が保持される", async () => {
		const result = await renderWithPlugins(steamHtml);
		expect(result).toContain('width="646"');
		expect(result).toContain('height="190"');
	});

	it("frameborder 属性が保持される", async () => {
		const result = await renderWithPlugins(steamHtml);
		expect(result).toContain('frameborder="0"');
	});
});

describe("<iframe> の frameborder / allowfullscreen 属性保持", () => {
	// rehype-sanitize のスキーマに HAST プロパティ名 (frameBorder/allowFullScreen) を
	// 使わないと、これらの属性が sanitize で削除されてしまう。
	const youtubeHtml = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;

	it("allowfullscreen 属性が保持される", async () => {
		const result = await renderWithPlugins(youtubeHtml);
		expect(result).toContain("allowfullscreen");
	});

	it("frameborder 属性が保持される", async () => {
		const result = await renderWithPlugins(youtubeHtml);
		expect(result).toContain('frameborder="0"');
	});
});

describe("XSS の排除", () => {
	it("<script> タグはサニタイズされる", async () => {
		const result = await renderWithPlugins(`<script>alert('xss')</script>`);
		expect(result).not.toContain("<script>");
	});

	it("javascript: href はサニタイズされる", async () => {
		const result = await renderWithPlugins(
			`<a href="javascript:alert(1)">click</a>`,
		);
		expect(result).not.toContain("javascript:");
	});
});

describe("nhc-* クラスの保持", () => {
	it("notionEmbed が出す class 属性 (nhc-bookmark / nhc-mention など) を sanitize で剥がさない", async () => {
		const html = `<a class="nhc-bookmark" href="https://example.com"><div class="nhc-bookmark__main"><p class="nhc-bookmark__title">Title</p></div></a>`;
		const result = await renderWithPlugins(html);
		expect(result).toContain('class="nhc-bookmark"');
		expect(result).toContain('class="nhc-bookmark__main"');
		expect(result).toContain('class="nhc-bookmark__title"');
	});

	it("nhc-mention のアイコン img と <strong> タイトルが残る", async () => {
		const html = `<a class="nhc-mention nhc-mention--link" href="https://x"><img class="nhc-mention__icon nhc-mention__icon--image" src="https://example.com/icon.png" alt="" /><span class="nhc-mention__provider">YouTube</span><strong class="nhc-mention__title">Foo</strong></a>`;
		const result = await renderWithPlugins(html);
		expect(result).toContain('class="nhc-mention nhc-mention--link"');
		expect(result).toContain(
			'class="nhc-mention__icon nhc-mention__icon--image"',
		);
		expect(result).toContain('src="https://example.com/icon.png"');
		expect(result).toContain('class="nhc-mention__provider"');
		expect(result).toContain("YouTube");
		expect(result).toContain('class="nhc-mention__title"');
	});
});
