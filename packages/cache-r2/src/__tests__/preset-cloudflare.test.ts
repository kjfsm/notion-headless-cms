import type { BaseContentItem, DataSource } from "@notion-headless-cms/core";
import { isCMSError } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import {
	cloudflarePreset,
	createCloudflareFactory,
} from "../preset-cloudflare";

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

function fakeKV(): {
	get: () => Promise<string | null>;
	put: () => Promise<void>;
} {
	return {
		get: async () => null,
		put: async () => undefined,
	};
}

function fakeR2(): {
	get: () => Promise<null>;
	put: () => Promise<null>;
} {
	return {
		get: async () => null,
		put: async () => null,
	};
}

describe("cloudflarePreset", () => {
	it("NOTION_TOKEN / DOC_CACHE / IMG_BUCKET を env から解決する", () => {
		const preset = cloudflarePreset({
			env: {
				NOTION_TOKEN: "secret",
				DOC_CACHE: fakeKV() as never,
				IMG_BUCKET: fakeR2() as never,
			},
		});
		expect(preset.cache).toBeDefined();
		if (preset.cache && preset.cache !== "disabled") {
			expect(preset.cache.document?.name).toBe("kv");
			expect(preset.cache.image?.name).toBe("r2");
		}
	});

	it("NOTION_TOKEN 未設定時は core/config_invalid を throw する", () => {
		try {
			cloudflarePreset({
				env: {
					DOC_CACHE: fakeKV() as never,
				},
			});
			throw new Error("expected throw");
		} catch (err) {
			expect(isCMSError(err)).toBe(true);
			if (isCMSError(err)) {
				expect(err.code).toBe("core/config_invalid");
			}
		}
	});

	it("binding が未設定なら cache は undefined になる", () => {
		const preset = cloudflarePreset({
			env: { NOTION_TOKEN: "secret" },
		});
		expect(preset.cache).toBeUndefined();
	});

	it("旧 CACHE_KV / CACHE_BUCKET もフォールバックとして受け付ける", () => {
		const preset = cloudflarePreset({
			env: {
				NOTION_TOKEN: "secret",
				CACHE_KV: fakeKV() as never,
				CACHE_BUCKET: fakeR2() as never,
			},
		});
		expect(preset.cache).toBeDefined();
	});

	it("bindings オプションで binding 名をカスタムできる", () => {
		const preset = cloudflarePreset({
			env: {
				NOTION_TOKEN: "secret",
				MY_KV: fakeKV() as never,
				MY_R2: fakeR2() as never,
			} as never,
			bindings: { docCache: "MY_KV", imgBucket: "MY_R2" },
		});
		expect(preset.cache).toBeDefined();
		if (preset.cache && preset.cache !== "disabled") {
			expect(preset.cache.document?.name).toBe("kv");
			expect(preset.cache.image?.name).toBe("r2");
		}
	});

	it("ttlMs を cache に伝搬する", () => {
		const preset = cloudflarePreset({
			env: {
				NOTION_TOKEN: "secret",
				DOC_CACHE: fakeKV() as never,
			},
			ttlMs: 30_000,
		});
		if (preset.cache && preset.cache !== "disabled") {
			expect(preset.cache.ttlMs).toBe(30_000);
		}
	});
});

describe("createCloudflareFactory", () => {
	const dataSources = { posts: fakeDataSource() };

	it("env を受け取って CMSClient を返す関数を生成する", () => {
		const factory = createCloudflareFactory({ dataSources, ttlMs: 5_000 });
		expect(typeof factory).toBe("function");

		const cms = factory({
			NOTION_TOKEN: "secret",
			DOC_CACHE: fakeKV() as never,
			IMG_BUCKET: fakeR2() as never,
		});
		expect(cms.$collections).toContain("posts");
	});

	it("NOTION_TOKEN 未設定時は CMSError を throw する", () => {
		const factory = createCloudflareFactory({ dataSources });
		try {
			factory({ DOC_CACHE: fakeKV() as never });
			throw new Error("expected throw");
		} catch (err) {
			expect(isCMSError(err)).toBe(true);
			if (isCMSError(err)) {
				expect(err.code).toBe("core/config_invalid");
			}
		}
	});

	it("binding が未設定でもクライアントを生成できる（キャッシュなし）", () => {
		const factory = createCloudflareFactory({ dataSources });
		const cms = factory({ NOTION_TOKEN: "secret" });
		expect(cms.$collections).toContain("posts");
	});

	it("ttlMs が cloudflarePreset に伝搬する", () => {
		const factory = createCloudflareFactory({ dataSources, ttlMs: 30_000 });
		const cms = factory({
			NOTION_TOKEN: "secret",
			DOC_CACHE: fakeKV() as never,
		});
		expect(cms.$collections).toContain("posts");
	});

	it("明示的な cache は cloudflarePreset のキャッシュより優先される", () => {
		const factory = createCloudflareFactory({
			dataSources,
			cache: undefined,
		});
		const cms = factory({ NOTION_TOKEN: "secret" });
		expect(cms.$collections).toContain("posts");
	});

	it("bindings オプションで binding 名をカスタムできる", () => {
		const factory = createCloudflareFactory({
			dataSources,
			bindings: { docCache: "MY_KV", imgBucket: "MY_R2" },
		});
		const cms = factory({
			NOTION_TOKEN: "secret",
			MY_KV: fakeKV() as never,
			MY_R2: fakeR2() as never,
		} as never);
		expect(cms.$collections).toContain("posts");
	});
});
