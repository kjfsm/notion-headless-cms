/**
 * DLsite アフィリエイト + Steam ウィジェットが
 * allowDangerousHtml + embedRehypePlugins を通して正しく出力されることを検証する。
 */

import type { Root } from "hast";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type Processor, unified } from "unified";
import { describe, expect, it } from "vitest";
import { dlsiteProvider } from "../providers/dlsite";
import { steamProvider } from "../providers/steam";
import { embedRehypePlugins } from "../rehype/rehype-sanitize-embeds";

async function renderWithPlugins(markdown: string): Promise<string> {
	const providers = [dlsiteProvider(), steamProvider()];
	const rehypePlugins = await embedRehypePlugins({ providers });

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let processor: Processor<any, any, any, any, any> = unified()
		.use(remarkParse)
		.use(remarkRehype, { allowDangerousHtml: true });

	for (const plugin of rehypePlugins) {
		if (Array.isArray(plugin)) {
			processor = processor.use(plugin[0] as never, plugin[1] as never);
		} else {
			processor = processor.use(plugin as never);
		}
	}

	processor = processor.use(rehypeStringify);

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
