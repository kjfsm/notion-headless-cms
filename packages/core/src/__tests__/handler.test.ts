import { describe, expect, it, vi } from "vitest";
import type { HandlerAdapter } from "../handler";
import { createHandler } from "../handler";

function makeAdapter(overrides: Partial<HandlerAdapter> = {}): HandlerAdapter {
	return {
		imageCache: {
			name: "test",
			get: vi.fn().mockResolvedValue(null),
			set: vi.fn().mockResolvedValue(undefined),
		},
		parseWebhook: vi.fn().mockResolvedValue(null),
		revalidate: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

describe("createHandler", () => {
	describe("GET {basePath}/images/:hash — 画像プロキシ", () => {
		it("キャッシュヒット時は 200 と画像データを返す", async () => {
			const data = new ArrayBuffer(8);
			const adapter = makeAdapter({
				imageCache: {
					name: "test",
					get: vi.fn().mockResolvedValue({ data, contentType: "image/png" }),
					set: vi.fn().mockResolvedValue(undefined),
				},
			});
			const handler = createHandler(adapter);
			const res = await handler(
				new Request("http://localhost/api/cms/images/abc123"),
			);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("image/png");
			expect(res.headers.get("cache-control")).toBe(
				"public, max-age=31536000, immutable",
			);
		});

		it("contentType がない画像は content-type ヘッダを含まない", async () => {
			const adapter = makeAdapter({
				imageCache: {
					name: "test",
					get: vi.fn().mockResolvedValue({ data: new ArrayBuffer(4) }),
					set: vi.fn().mockResolvedValue(undefined),
				},
			});
			const handler = createHandler(adapter);
			const res = await handler(
				new Request("http://localhost/api/cms/images/abc123"),
			);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBeNull();
		});

		it("キャッシュミス時は 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/images/notexist"),
			);
			expect(res.status).toBe(404);
		});

		it("ハッシュが空の場合は 400 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/images/"),
			);
			expect(res.status).toBe(400);
		});
	});

	describe("POST {basePath}/revalidate — Webhook 受信", () => {
		it("有効な Webhook は 200 と { ok: true, scope } を返す", async () => {
			const scope = { collection: "posts" as const };
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(scope),
				revalidate: vi.fn().mockResolvedValue(undefined),
			});
			const handler = createHandler(adapter);
			const res = await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "POST" }),
			);
			expect(res.status).toBe(200);
			expect(res.headers.get("content-type")).toBe("application/json");
			const body = (await res.json()) as { ok: boolean; scope: unknown };
			expect(body.ok).toBe(true);
			expect(body.scope).toEqual(scope);
		});

		it("無効な Webhook（null）は 400 と { ok: false } を返す", async () => {
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(null),
			});
			const handler = createHandler(adapter);
			const res = await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "POST" }),
			);
			expect(res.status).toBe(400);
			const body = (await res.json()) as { ok: boolean };
			expect(body.ok).toBe(false);
		});

		it("有効な Webhook 時に adapter.revalidate が scope で呼ばれる", async () => {
			const scope = { collection: "posts" as const };
			const revalidate = vi.fn().mockResolvedValue(undefined);
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(scope),
				revalidate,
			});
			const handler = createHandler(adapter);
			await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "POST" }),
			);
			expect(revalidate).toHaveBeenCalledWith(scope);
		});

		it("webhookSecret を parseWebhook に渡す", async () => {
			const parseWebhook = vi.fn().mockResolvedValue(null);
			const adapter = makeAdapter({ parseWebhook });
			const handler = createHandler(adapter, { webhookSecret: "my-secret" });
			await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "POST" }),
			);
			expect(parseWebhook).toHaveBeenCalledWith(
				expect.any(Request),
				"my-secret",
			);
		});
	});

	describe("404 レスポンス", () => {
		it("basePath に一致しないパスは 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(new Request("http://localhost/other/path"));
			expect(res.status).toBe(404);
		});

		it("basePath にマッチするが既知ルート以外は 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/unknown"),
			);
			expect(res.status).toBe(404);
		});

		it("basePath そのもの（trailing path なし）は 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(new Request("http://localhost/api/cms"));
			expect(res.status).toBe(404);
		});

		it("GET /api/cms/revalidate は 404 を返す（POST のみ有効）", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "GET" }),
			);
			expect(res.status).toBe(404);
		});

		it("PUT /api/cms/revalidate は 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/revalidate", { method: "PUT" }),
			);
			expect(res.status).toBe(404);
		});

		it("DELETE /api/cms/revalidate は 404 を返す", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/revalidate", {
					method: "DELETE",
				}),
			);
			expect(res.status).toBe(404);
		});

		it("POST /api/cms/images/:hash は 404 を返す（GET のみ有効）", async () => {
			const handler = createHandler(makeAdapter());
			const res = await handler(
				new Request("http://localhost/api/cms/images/abc123", {
					method: "POST",
				}),
			);
			expect(res.status).toBe(404);
		});
	});

	describe("カスタムパス設定", () => {
		it("basePath を変更できる", async () => {
			const scope = { collection: "posts" as const };
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(scope),
			});
			const handler = createHandler(adapter, { basePath: "/cms" });
			const res = await handler(
				new Request("http://localhost/cms/revalidate", { method: "POST" }),
			);
			expect(res.status).toBe(200);
		});

		it("末尾スラッシュ付き basePath は正規化される", async () => {
			const scope = { collection: "posts" as const };
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(scope),
			});
			const handler = createHandler(adapter, { basePath: "/cms/" });
			const res = await handler(
				new Request("http://localhost/cms/revalidate", { method: "POST" }),
			);
			expect(res.status).toBe(200);
		});

		it("revalidatePath を変更できる", async () => {
			const scope = { collection: "posts" as const };
			const adapter = makeAdapter({
				parseWebhook: vi.fn().mockResolvedValue(scope),
			});
			const handler = createHandler(adapter, { revalidatePath: "/webhook" });
			const res = await handler(
				new Request("http://localhost/api/cms/webhook", { method: "POST" }),
			);
			expect(res.status).toBe(200);
		});

		it("imagesPath を変更できる", async () => {
			const data = new ArrayBuffer(4);
			const adapter = makeAdapter({
				imageCache: {
					name: "test",
					get: vi.fn().mockResolvedValue({ data, contentType: "image/png" }),
					set: vi.fn().mockResolvedValue(undefined),
				},
			});
			const handler = createHandler(adapter, { imagesPath: "/img" });
			const res = await handler(
				new Request("http://localhost/api/cms/img/abc123"),
			);
			expect(res.status).toBe(200);
		});
	});
});
