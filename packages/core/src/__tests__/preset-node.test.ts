import { describe, expect, it } from "vitest";
import { memoryCache } from "../cache/memory";
import { createCMS } from "../cms";
import { nodePreset } from "../preset-node";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

function fakeDataSource(): DataSource<BaseContentItem> {
	return {
		name: "fake",
		async list() {
			return [];
		},
		async findBySlug() {
			return null;
		},
		async loadBlocks() {
			return [];
		},
		async loadMarkdown() {
			return "";
		},
		getLastModified(item) {
			return item.updatedAt;
		},
		getListVersion() {
			return "";
		},
	};
}

describe("nodePreset", () => {
	it("デフォルトで memory document/image cache を有効化する", () => {
		const preset = nodePreset();
		expect(preset.cache).toBeDefined();
		if (preset.cache && preset.cache !== "disabled") {
			expect(preset.cache.document?.name).toBe("memory-document");
			expect(preset.cache.image?.name).toBe("memory-image");
		}
	});

	it('cache: "disabled" でキャッシュを完全無効化する', () => {
		const preset = nodePreset({ cache: "disabled" });
		expect(preset.cache).toBeUndefined();
	});

	it("cache にユーザー指定のオブジェクトを渡すとそのまま使う", () => {
		const custom = memoryCache();
		const preset = nodePreset({ cache: { document: custom, ttlMs: 5_000 } });
		expect(preset.cache).toBeDefined();
		if (preset.cache && preset.cache !== "disabled") {
			expect(preset.cache.document).toBe(custom);
			expect(preset.cache.ttlMs).toBe(5_000);
		}
	});

	it("renderer はそのまま透過する", async () => {
		const marker: unknown[] = [];
		const renderer = async (md: string) => {
			marker.push(md);
			return "<p></p>";
		};
		const preset = nodePreset({ renderer });
		expect(preset.renderer).toBe(renderer);
	});
});

describe("createCMS の preset オプション", () => {
	const dataSources = { posts: fakeDataSource() };

	it('preset: "node" で有効なクライアントを生成できる', () => {
		const cms = createCMS({ dataSources, preset: "node", ttlMs: 5_000 });
		expect(cms.$collections).toContain("posts");
	});

	it('preset: "node" + ttlMs で spread パターンと同等に動作する', () => {
		const viaPreset = createCMS({ dataSources, preset: "node", ttlMs: 5_000 });
		const viaSpread = createCMS({
			...nodePreset({ ttlMs: 5_000 }),
			dataSources,
		});
		expect(viaPreset.$collections).toEqual(viaSpread.$collections);
	});

	it("preset 未指定でも既存の spread パターンが動作する（後方互換）", () => {
		const cms = createCMS({ ...nodePreset({ ttlMs: 5_000 }), dataSources });
		expect(cms.$collections).toContain("posts");
	});

	it('preset: "node" + 明示的な cache は cache が優先される', () => {
		const customCache = memoryCache();
		const cms = createCMS({
			dataSources,
			preset: "node",
			cache: { document: customCache },
		});
		expect(cms.$collections).toContain("posts");
	});

	it('preset: "disabled" でキャッシュなしのクライアントを生成できる', () => {
		const cms = createCMS({ dataSources, preset: "disabled" });
		expect(cms.$collections).toContain("posts");
	});
});
