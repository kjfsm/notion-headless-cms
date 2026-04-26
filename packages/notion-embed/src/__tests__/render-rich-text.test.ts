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

function makeText(
	content: string,
	overrides: Partial<RichTextItemResponse["annotations"]> = {},
	href?: string | null,
): RichTextItemResponse {
	return {
		type: "text",
		text: { content, link: href ? { url: href } : null },
		annotations: { ...defaultAnnotations, ...overrides },
		plain_text: content,
		href: href ?? null,
	};
}

describe("renderRichText", () => {
	describe("テキストアノテーション", () => {
		it("プレーンテキストをそのまま出力する", async () => {
			const result = await renderRichText([makeText("Hello")]);
			expect(result).toBe("Hello");
		});

		it("bold を <strong> で包む", async () => {
			const result = await renderRichText([makeText("Bold", { bold: true })]);
			expect(result).toBe("<strong>Bold</strong>");
		});

		it("italic を <em> で包む", async () => {
			const result = await renderRichText([
				makeText("Italic", { italic: true }),
			]);
			expect(result).toBe("<em>Italic</em>");
		});

		it("strikethrough を <s> で包む", async () => {
			const result = await renderRichText([
				makeText("Strike", { strikethrough: true }),
			]);
			expect(result).toBe("<s>Strike</s>");
		});

		it("underline を <u> で包む", async () => {
			const result = await renderRichText([
				makeText("Under", { underline: true }),
			]);
			expect(result).toBe("<u>Under</u>");
		});

		it("code を <code> で包む", async () => {
			const result = await renderRichText([makeText("code", { code: true })]);
			expect(result).toBe('<code class="nhc-inline-code">code</code>');
		});

		it("bold + italic を重ねられる", async () => {
			const result = await renderRichText([
				makeText("BI", { bold: true, italic: true }),
			]);
			expect(result).toBe("<em><strong>BI</strong></em>");
		});

		it("カラーアノテーションを span で包む", async () => {
			const result = await renderRichText(
				[makeText("Red", {}, undefined)].map((r) => ({
					...r,
					annotations: { ...r.annotations, color: "red" as const },
				})),
			);
			expect(result).toContain('class="nhc-color--red"');
		});

		it("背景色を nhc-color-bg-- クラスで出力する", async () => {
			const item = {
				...makeText("BG"),
				annotations: {
					...defaultAnnotations,
					color: "blue_background" as const,
				},
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-color-bg--blue"');
		});

		it("リンク付きテキストを <a> で包む", async () => {
			const result = await renderRichText([
				makeText("link", {}, "https://example.com"),
			]);
			expect(result).toContain('<a href="https://example.com"');
			expect(result).toContain("link");
		});

		it("HTML 特殊文字をエスケープする", async () => {
			const result = await renderRichText([
				makeText('<script>alert("xss")</script>'),
			]);
			expect(result).not.toContain("<script>");
			expect(result).toContain("&lt;script&gt;");
		});

		it("複数アイテムを連結する", async () => {
			const result = await renderRichText([
				makeText("Hello "),
				makeText("World", { bold: true }),
			]);
			expect(result).toBe("Hello <strong>World</strong>");
		});
	});

	describe("mention", () => {
		it("link_mention を nhc-mention--link リンクで出力する", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: {
					type: "link_mention",
					link_mention: {
						href: "https://example.com",
						title: "Example",
					},
				},
				annotations: defaultAnnotations,
				plain_text: "Example",
				href: "https://example.com",
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-mention nhc-mention--link"');
			expect(result).toContain('href="https://example.com"');
			expect(result).toContain("Example");
		});

		it("page mention を nhc-mention--page で出力する", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: { type: "page", page: { id: "page-id-123" } },
				annotations: defaultAnnotations,
				plain_text: "page-id-123",
				href: null,
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-mention nhc-mention--page"');
			expect(result).toContain("page-id-123");
		});

		it("page mention の resolvePageTitle を呼ぶ", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: { type: "page", page: { id: "abc" } },
				annotations: defaultAnnotations,
				plain_text: "abc",
				href: null,
			};
			const result = await renderRichText([item], {
				resolvePageTitle: async (id) => `Page: ${id}`,
			});
			expect(result).toContain("Page: abc");
		});

		it("date mention を nhc-mention--date で出力する", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: {
					type: "date",
					date: { start: "2024-01-01", end: null, time_zone: null },
				},
				annotations: defaultAnnotations,
				plain_text: "2024-01-01",
				href: null,
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-mention nhc-mention--date"');
			expect(result).toContain("2024-01-01");
		});

		it("date range を → で区切る", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: {
					type: "date",
					date: { start: "2024-01-01", end: "2024-01-31", time_zone: null },
				},
				annotations: defaultAnnotations,
				plain_text: "2024-01-01 → 2024-01-31",
				href: null,
			};
			const result = await renderRichText([item]);
			expect(result).toContain("2024-01-01 → 2024-01-31");
		});

		it("user mention を @名前 で出力する", async () => {
			const item: RichTextItemResponse = {
				type: "mention",
				mention: {
					type: "user",
					user: {
						object: "user",
						id: "uid-1",
						name: "Alice",
						avatar_url: null,
						type: "person",
						person: { email: "alice@example.com" },
					},
				},
				annotations: defaultAnnotations,
				plain_text: "Alice",
				href: null,
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-mention nhc-mention--user"');
			expect(result).toContain("@Alice");
		});
	});

	describe("equation", () => {
		it("数式を nhc-equation クラスの code で出力する", async () => {
			const item: RichTextItemResponse = {
				type: "equation",
				equation: { expression: "E = mc^2" },
				annotations: defaultAnnotations,
				plain_text: "E = mc^2",
				href: null,
			};
			const result = await renderRichText([item]);
			expect(result).toContain('class="nhc-equation"');
			expect(result).toContain("E = mc^2");
		});
	});
});
