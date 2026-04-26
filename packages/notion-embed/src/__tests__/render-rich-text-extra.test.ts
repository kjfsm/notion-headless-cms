import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderRichText } from "../render-rich-text";

const defaultAnnotations: RichTextItemResponse["annotations"] = {
	bold: false,
	italic: false,
	strikethrough: false,
	underline: false,
	code: false,
	color: "default",
};

describe("renderRichText 追加カバレッジ", () => {
	it("link_preview mention を出す", async () => {
		const item = {
			type: "mention",
			mention: {
				type: "link_preview",
				link_preview: { url: "https://example.com/preview" },
			},
			annotations: defaultAnnotations,
			plain_text: "preview",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item]);
		expect(html).toContain("nhc-mention--link-preview");
		expect(html).toContain("example.com/preview");
	});

	it("database mention を出す", async () => {
		const item = {
			type: "mention",
			mention: { type: "database", database: { id: "db-1" } },
			annotations: defaultAnnotations,
			plain_text: "db-1",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item]);
		expect(html).toContain("nhc-mention--database");
		expect(html).toContain("db-1");
	});

	it("database mention の resolvePageTitle が呼ばれる", async () => {
		const item = {
			type: "mention",
			mention: { type: "database", database: { id: "db-x" } },
			annotations: defaultAnnotations,
			plain_text: "db-x",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item], {
			resolvePageTitle: async (id) => `DB(${id})`,
		});
		expect(html).toContain("DB(db-x)");
	});

	it("custom_emoji mention (url 付き) を <img> で出す", async () => {
		const item = {
			type: "mention",
			mention: {
				type: "custom_emoji",
				custom_emoji: {
					id: "e",
					name: "smile",
					url: "https://example.com/e.png",
				},
			},
			annotations: defaultAnnotations,
			plain_text: "smile",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item]);
		expect(html).toContain("<img");
		expect(html).toContain('src="https://example.com/e.png"');
		expect(html).toContain('alt="smile"');
	});

	it("custom_emoji mention (url なし) は plain_text にフォールバック", async () => {
		const item = {
			type: "mention",
			mention: { type: "custom_emoji", custom_emoji: { id: "e", name: "n" } },
			annotations: defaultAnnotations,
			plain_text: ":fallback:",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item]);
		expect(html).toBe(":fallback:");
	});

	it("template_mention は plain_text にフォールバック", async () => {
		const item = {
			type: "mention",
			mention: { type: "template_mention", template_mention: {} },
			annotations: defaultAnnotations,
			plain_text: "today",
			href: null,
		} as unknown as RichTextItemResponse;
		const html = await renderRichText([item]);
		expect(html).toBe("today");
	});
});
