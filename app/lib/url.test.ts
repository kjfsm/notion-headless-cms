import { describe, expect, it } from "vitest";
import { blogPostUrl, resolveSiteUrl, SITE_URL } from "./url";

describe("url helpers", () => {
	it("returns SITE_URL when request is not provided", () => {
		expect(resolveSiteUrl()).toBe(SITE_URL);
	});

	it("resolves origin from request URL", () => {
		const request = new Request("https://euphoric.example/blog/hello?utm=1");
		expect(resolveSiteUrl(request)).toBe("https://euphoric.example");
	});

	it("builds blog post URL from slug and request origin", () => {
		const request = new Request("https://news.example/latest");
		expect(blogPostUrl("my-post", request)).toBe(
			"https://news.example/blog/my-post",
		);
	});

	it("builds blog post URL from SITE_URL without request", () => {
		expect(blogPostUrl("my-post")).toBe(`${SITE_URL}/blog/my-post`);
	});
});
