import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBookmark } from "../../handlers/bookmark";
import { clearOgpCache } from "../../ogp";

function makeBlock(
	url: string,
	caption: BookmarkBlockObjectResponse["bookmark"]["caption"] = [],
): BookmarkBlockObjectResponse {
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
		type: "bookmark",
		bookmark: { url, caption },
	};
}

describe("renderBookmark", () => {
	beforeEach(() => clearOgpCache());
	afterEach(() => {
		vi.restoreAllMocks();
		clearOgpCache();
	});

	it("nhc-bookmark クラスの <a> タグを返す", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html></html>", { status: 200 }),
		);
		const html = await renderBookmark(makeBlock("https://example.com"));
		expect(html).toContain('class="nhc-bookmark"');
		expect(html).toContain('href="https://example.com"');
	});

	it("OGP が取得できれば title / description / image を表示する", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				`<html><head>
					<meta property="og:title" content="OGP Title" />
					<meta property="og:description" content="OGP Desc" />
					<meta property="og:image" content="https://example.com/img.png" />
					<meta property="og:site_name" content="My Site" />
				</head></html>`,
				{ status: 200 },
			),
		);
		const html = await renderBookmark(makeBlock("https://example.com"));
		expect(html).toContain("OGP Title");
		expect(html).toContain("OGP Desc");
		expect(html).toContain("https://example.com/img.png");
		expect(html).toContain("My Site");
		expect(html).toContain('class="nhc-bookmark__cover"');
	});

	it("OGP 画像がなければ cover セクションを出力しない", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				`<html><head><meta property="og:title" content="No Image" /></head></html>`,
				{ status: 200 },
			),
		);
		const html = await renderBookmark(makeBlock("https://example.com/no-img"));
		expect(html).not.toContain("nhc-bookmark__cover");
	});

	it("ogpOptions=false のとき OGP を取得しない (fetch を呼ばない)", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const html = await renderBookmark(makeBlock("https://example.com"), false);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(html).toContain("nhc-bookmark");
	});

	it("OGP が失敗したとき URL をタイトルとして使う", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
		const html = await renderBookmark(makeBlock("https://example.com/fail"));
		expect(html).toContain("example.com/fail");
	});

	it("nhc-bookmark__url に短縮 URL を表示する", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html></html>", { status: 200 }),
		);
		const html = await renderBookmark(makeBlock("https://example.com/path"));
		expect(html).toContain('class="nhc-bookmark__url"');
		expect(html).toContain("example.com/path");
	});

	it("target=_blank と rel=noopener noreferrer を付与する", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html></html>", { status: 200 }),
		);
		const html = await renderBookmark(makeBlock("https://example.com"));
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it("XSS インジェクションをエスケープする", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				`<html><head><meta property="og:title" content='<script>alert(1)</script>' /></head></html>`,
				{ status: 200 },
			),
		);
		const html = await renderBookmark(makeBlock("https://example.com/xss"));
		expect(html).not.toContain("<script>");
	});
});
