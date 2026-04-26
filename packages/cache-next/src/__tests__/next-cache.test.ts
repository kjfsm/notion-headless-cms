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

	it("getItemMeta は null を返す", async () => {
		const cache = nextCache();
		expect(await cache.getItemMeta("any")).toBeNull();
	});

	it("getItemContent は null を返す", async () => {
		const cache = nextCache();
		expect(await cache.getItemContent("any")).toBeNull();
	});

	it("setList は何もしない", async () => {
		const cache = nextCache();
		await expect(
			cache.setList({ items: [], cachedAt: 0 }),
		).resolves.toBeUndefined();
	});

	it("setItemMeta は何もしない", async () => {
		const cache = nextCache();
		await expect(
			cache.setItemMeta("slug", {
				item: makeItem("slug"),
				notionUpdatedAt: "",
				cachedAt: 0,
			}),
		).resolves.toBeUndefined();
	});

	it("setItemContent は何もしない", async () => {
		const cache = nextCache();
		await expect(
			cache.setItemContent("slug", {
				html: "",
				markdown: "",
				blocks: [],
				notionUpdatedAt: "",
				cachedAt: 0,
			}),
		).resolves.toBeUndefined();
	});

	describe("invalidate()", () => {
		it("'all' でユーザー指定タグを全て revalidateTag する", async () => {
			const cache = nextCache({ tags: ["posts", "pages"] });
			await cache.invalidate?.("all");
			expect(revalidateTag).toHaveBeenCalledWith("posts");
			expect(revalidateTag).toHaveBeenCalledWith("pages");
		});

		it("{ collection } でコレクション規約タグを revalidateTag する", async () => {
			const cache = nextCache();
			await cache.invalidate?.({ collection: "posts" });
			expect(revalidateTag).toHaveBeenCalledWith("nhc:col:posts");
		});

		it("{ collection, slug } でメタ・本文タグを両方 revalidateTag する", async () => {
			const cache = nextCache();
			await cache.invalidate?.({ collection: "posts", slug: "my-post" });
			expect(revalidateTag).toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:meta",
			);
			expect(revalidateTag).toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:content",
			);
		});

		it("{ collection, slug, kind: 'content' } で本文タグのみ revalidateTag する", async () => {
			const cache = nextCache();
			await cache.invalidate?.({
				collection: "posts",
				slug: "my-post",
				kind: "content",
			});
			expect(revalidateTag).toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:content",
			);
			expect(revalidateTag).not.toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:meta",
			);
		});

		it("{ collection, slug, kind: 'meta' } でメタタグのみ revalidateTag する", async () => {
			const cache = nextCache();
			await cache.invalidate?.({
				collection: "posts",
				slug: "my-post",
				kind: "meta",
			});
			expect(revalidateTag).toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:meta",
			);
			expect(revalidateTag).not.toHaveBeenCalledWith(
				"nhc:col:posts:slug:my-post:content",
			);
		});
	});
});
