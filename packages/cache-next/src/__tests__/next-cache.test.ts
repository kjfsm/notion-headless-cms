import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextCache } from "../next-cache";

vi.mock("next/cache", () => ({
	revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";

const makeItem = (slug: string) => ({
	id: `id-${slug}`,
	slug,
	status: "公開",
	publishedAt: "2024-01-01",
	updatedAt: "2024-01-01",
});

describe("nextCache", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("name が 'next-cache' である", () => {
		expect(nextCache().name).toBe("next-cache");
	});

	it("getList は null を返す", async () => {
		const cache = nextCache();
		expect(await cache.getList()).toBeNull();
	});

	it("getItem は null を返す", async () => {
		const cache = nextCache();
		expect(await cache.getItem("any")).toBeNull();
	});

	it("setList は何もしない", async () => {
		const cache = nextCache();
		await expect(
			cache.setList({ items: [], cachedAt: 0 }),
		).resolves.toBeUndefined();
	});

	it("setItem は何もしない", async () => {
		const cache = nextCache();
		await expect(
			cache.setItem("slug", {
				html: "",
				item: makeItem("slug"),
				notionUpdatedAt: "",
				cachedAt: 0,
			}),
		).resolves.toBeUndefined();
	});

	describe("invalidate()", () => {
		it("'all' で全タグを revalidateTag する", async () => {
			const cache = nextCache({ tags: ["posts", "pages"] });
			await cache.invalidate?.("all");
			expect(revalidateTag).toHaveBeenCalledWith("posts");
			expect(revalidateTag).toHaveBeenCalledWith("pages");
		});

		it("{ tag } で指定タグを revalidateTag する", async () => {
			const cache = nextCache({ tags: ["posts"] });
			await cache.invalidate?.({ tag: "custom-tag" });
			expect(revalidateTag).toHaveBeenCalledWith("custom-tag");
		});

		it("{ slug } で slug: プレフィックス付きタグを revalidateTag する", async () => {
			const cache = nextCache();
			await cache.invalidate?.({ slug: "my-post" });
			expect(revalidateTag).toHaveBeenCalledWith("slug:my-post");
		});
	});
});
