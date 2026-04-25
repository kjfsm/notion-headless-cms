import { beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();

vi.mock("@notionhq/client", () => ({
	Client: class {
		search = searchMock;
		dataSources = { retrieve: vi.fn() };
	},
}));

// biome-ignore lint/suspicious/noExplicitAny: テスト用モックのため型アサーションを許容
function makeDataSource(id: string, title: string): any {
	return {
		object: "data_source",
		id,
		title: [{ plain_text: title }],
	};
}

describe("createNotionCLIClient.resolveId", () => {
	beforeEach(() => {
		searchMock.mockReset();
	});

	it("完全一致する dbName の id を返す", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		searchMock.mockResolvedValue({
			results: [
				makeDataSource("id-other", "ブログ記事DB 旧版"),
				makeDataSource("id-target", "ブログ記事DB"),
			],
		});

		const client = createNotionCLIClient("test-token");
		const id = await client.resolveId("ブログ記事DB");
		expect(id).toBe("id-target");
	});

	it("完全一致が無い場合は null を返す（部分一致は採用しない）", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		searchMock.mockResolvedValue({
			results: [
				makeDataSource("id-1", "ブログ記事DB 旧版"),
				makeDataSource("id-2", "ブログ記事DB Archive"),
			],
		});

		const client = createNotionCLIClient("test-token");
		const id = await client.resolveId("ブログ記事DB");
		expect(id).toBeNull();
	});

	it("検索結果が空なら null を返す", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		searchMock.mockResolvedValue({ results: [] });

		const client = createNotionCLIClient("test-token");
		const id = await client.resolveId("存在しないDB");
		expect(id).toBeNull();
	});

	it("data_source 以外のオブジェクトは無視する", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		searchMock.mockResolvedValue({
			results: [
				{ object: "page", id: "page-1", title: [{ plain_text: "DB 名" }] },
				makeDataSource("ds-1", "DB 名"),
			],
		});

		const client = createNotionCLIClient("test-token");
		const id = await client.resolveId("DB 名");
		expect(id).toBe("ds-1");
	});
});
