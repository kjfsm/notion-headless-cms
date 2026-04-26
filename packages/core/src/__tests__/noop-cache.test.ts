import { describe, expect, it } from "vitest";
import { noopDocumentCache, noopImageCache } from "../cache/noop";

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

	it("getItemMeta は常に null を返す（setItemMeta 後も）", async () => {
		await cache.setItemMeta("slug", {
			item: { id: "id", slug: "slug", updatedAt: "2024-01-01" },
			notionUpdatedAt: "2024-01-01",
			cachedAt: 0,
		});
		expect(await cache.getItemMeta("slug")).toBeNull();
	});

	it("getItemContent は常に null を返す（setItemContent 後も）", async () => {
		await cache.setItemContent("slug", {
			html: "<p>x</p>",
			markdown: "x",
			blocks: [],
			notionUpdatedAt: "2024-01-01",
			cachedAt: 0,
		});
		expect(await cache.getItemContent("slug")).toBeNull();
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
