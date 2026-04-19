import { describe, expect, it } from "vitest";
import { noopDocumentCache, noopImageCache } from "../cache/noop";

const makeCachedItem = (slug: string) => ({
	html: `<p>${slug}</p>`,
	item: {
		id: `id-${slug}`,
		slug,
		status: "公開",
		publishedAt: "2024-01-01",
		updatedAt: "2024-01-01",
	},
	notionUpdatedAt: "2024-01-01T00:00:00.000Z",
	cachedAt: Date.now(),
});

describe("noopDocumentCache", () => {
	const cache = noopDocumentCache();

	it("getList は常に null を返す", async () => {
		expect(await cache.getList()).toBeNull();
	});

	it("setList は何もせず解決する", async () => {
		await expect(
			cache.setList({ items: [], cachedAt: 0 }),
		).resolves.toBeUndefined();
	});

	it("getItem は常に null を返す（setItem 後も）", async () => {
		await cache.setItem("slug", makeCachedItem("slug"));
		expect(await cache.getItem("slug")).toBeNull();
	});

	it("invalidate は何もせず解決する", async () => {
		await expect(cache.invalidate?.("all")).resolves.toBeUndefined();
	});
});

describe("noopImageCache", () => {
	const cache = noopImageCache();

	it("get は常に null を返す", async () => {
		expect(await cache.get("hash")).toBeNull();
	});

	it("set は何もせず解決する", async () => {
		const data = new ArrayBuffer(4);
		await expect(cache.set("hash", data, "image/png")).resolves.toBeUndefined();
	});
});
