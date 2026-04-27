import { describe, expect, it, vi } from "vitest";
import { extractIframeSrc, fetchOembed } from "../oembed";

describe("fetchOembed", () => {
	it("oEmbed エンドポイントに url / format=json を付けてリクエストする", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ title: "Test" }), {
				headers: { "content-type": "application/json" },
			}),
		);
		try {
			const result = await fetchOembed(
				"https://www.youtube.com/watch?v=abc",
				"https://www.youtube.com/oembed",
			);
			expect(result.title).toBe("Test");
			const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
			expect(calledUrl.searchParams.get("url")).toBe(
				"https://www.youtube.com/watch?v=abc",
			);
			expect(calledUrl.searchParams.get("format")).toBe("json");
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("opts.width / opts.height が maxwidth / maxheight として付加される", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({}), {
				headers: { "content-type": "application/json" },
			}),
		);
		try {
			await fetchOembed(
				"https://vimeo.com/1",
				"https://vimeo.com/api/oembed.json",
				{
					width: 640,
					height: 360,
				},
			);
			const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
			expect(calledUrl.searchParams.get("maxwidth")).toBe("640");
			expect(calledUrl.searchParams.get("maxheight")).toBe("360");
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("レスポンスが ok でない場合は空オブジェクトを返す", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("Not Found", { status: 404 }));
		try {
			const result = await fetchOembed(
				"https://example.com/404",
				"https://example.com/oembed",
			);
			expect(result).toEqual({});
		} finally {
			fetchSpy.mockRestore();
		}
	});

	it("fetch がネットワークエラーで例外を投げても空オブジェクトを返す", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValue(new Error("network error"));
		try {
			const result = await fetchOembed(
				"https://example.com/x",
				"https://example.com/oembed",
			);
			expect(result).toEqual({});
		} finally {
			fetchSpy.mockRestore();
		}
	});
});

describe("extractIframeSrc", () => {
	it("iframe の src 属性値を返す", () => {
		const html =
			'<iframe src="https://player.vimeo.com/video/123" width="640"></iframe>';
		expect(extractIframeSrc(html)).toBe("https://player.vimeo.com/video/123");
	});

	it("src 属性がなければ null を返す", () => {
		expect(extractIframeSrc("<div></div>")).toBeNull();
	});

	it("空文字列は null を返す", () => {
		expect(extractIframeSrc("")).toBeNull();
	});
});
