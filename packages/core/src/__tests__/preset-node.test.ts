import { describe, expect, it } from "vitest";
import { memoryCache } from "../cache/memory";
import { nodePreset } from "../preset-node";

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
