import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
// biome-ignore lint/suspicious/noExplicitAny: コンストラクタ引数を捕捉するための型アサーション
let capturedClientOptions:
	| { auth?: string; fetch?: (...args: any[]) => any }
	| undefined;

vi.mock("@notionhq/client", () => ({
	Client: class {
		// biome-ignore lint/suspicious/noExplicitAny: コンストラクタ引数を捕捉するための型アサーション
		constructor(opts: { auth?: string; fetch?: (...args: any[]) => any }) {
			capturedClientOptions = opts;
		}
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

describe("createNotionCLIClient: no-cache fetch", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		capturedClientOptions = undefined;
		fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("Notion Client に cache: no-store 付きカスタム fetch を渡す", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		createNotionCLIClient("test-token");

		expect(capturedClientOptions).toBeDefined();
		expect(typeof capturedClientOptions?.fetch).toBe("function");
	});

	it("カスタム fetch は元の init に cache: no-store を付与して呼ぶ", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		createNotionCLIClient("test-token");

		const customFetch = capturedClientOptions?.fetch;
		expect(customFetch).toBeDefined();

		await customFetch!("https://api.notion.com/v1/test", {
			method: "GET",
			headers: { Authorization: "Bearer token" },
		});

		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.notion.com/v1/test",
			expect.objectContaining({
				method: "GET",
				cache: "no-store",
			}),
		);
	});

	it("init が未指定でも cache: no-store を付与する", async () => {
		const { createNotionCLIClient } = await import("../notion-client.js");
		createNotionCLIClient("test-token");

		const customFetch = capturedClientOptions?.fetch;
		await customFetch!("https://api.notion.com/v1/test", undefined);

		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.notion.com/v1/test",
			expect.objectContaining({ cache: "no-store" }),
		);
	});
});
