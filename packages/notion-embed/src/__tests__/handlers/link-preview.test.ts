import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderLinkPreview } from "../../handlers/link-preview";

function makeBlock(url: string): LinkPreviewBlockObjectResponse {
	return {
		object: "block",
		id: "block-id",
		parent: { type: "page_id", page_id: "page-id" },
		created_time: "",
		last_edited_time: "",
		created_by: { object: "user", id: "user-id" },
		last_edited_by: { object: "user", id: "user-id" },
		has_children: false,
		archived: false,
		in_trash: false,
		type: "link_preview",
		link_preview: { url },
	};
}

describe("renderLinkPreview", () => {
	it("nhc-link-preview クラスの <a> タグを返す", () => {
		const html = renderLinkPreview(makeBlock("https://example.com"));
		expect(html).toContain('class="nhc-link-preview"');
		expect(html).toContain('href="https://example.com"');
	});

	it("🔗 アイコンを含む", () => {
		const html = renderLinkPreview(makeBlock("https://example.com"));
		expect(html).toContain("🔗");
	});

	it("ラベルはプロトコル部分を除いた URL", () => {
		const html = renderLinkPreview(makeBlock("https://example.com/path"));
		// label テキストにプロトコルが含まれないことを確認（href は含んでよい）
		expect(html).toContain(
			'<span class="nhc-link-preview__label">example.com/path</span>',
		);
	});

	it("target=_blank と rel=noopener noreferrer を付与する", () => {
		const html = renderLinkPreview(makeBlock("https://example.com"));
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it("プロトコル相対 URL を正規化する", () => {
		const html = renderLinkPreview(makeBlock("//example.com/path"));
		expect(html).toContain('href="https://example.com/path"');
	});

	it("XSS URL をエスケープする", () => {
		const html = renderLinkPreview(
			makeBlock("https://example.com/?a=1&b=<script>"),
		);
		expect(html).not.toContain("<script>");
	});
});
