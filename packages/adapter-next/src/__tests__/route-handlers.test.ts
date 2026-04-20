import { describe, expect, it, vi } from "vitest";
import {
	createImageRouteHandler,
	createRevalidateRouteHandler,
} from "../route-handlers";

const makeMockCMS = () => ({
	createCachedImageResponse: vi.fn(),
	cache: {
		sync: vi.fn().mockResolvedValue({ updated: ["post-a"] }),
	},
});

describe("createImageRouteHandler", () => {
	it("画像が存在する場合は Response を返す", async () => {
		const cms = makeMockCMS();
		const mockResponse = new Response("image-data", {
			headers: { "content-type": "image/png" },
		});
		cms.createCachedImageResponse.mockResolvedValue(mockResponse);

		const handler = createImageRouteHandler(cms as never);
		const res = await handler(new Request("http://localhost"), {
			params: Promise.resolve({ hash: "abc123" }),
		});

		expect(res.status).toBe(200);
		expect(cms.createCachedImageResponse).toHaveBeenCalledWith("abc123");
	});

	it("画像が存在しない場合は 404 を返す", async () => {
		const cms = makeMockCMS();
		cms.createCachedImageResponse.mockResolvedValue(null);

		const handler = createImageRouteHandler(cms as never);
		const res = await handler(new Request("http://localhost"), {
			params: Promise.resolve({ hash: "notfound" }),
		});

		expect(res.status).toBe(404);
	});
});

describe("createRevalidateRouteHandler", () => {
	it("正しい secret で syncFromWebhook を呼ぶ", async () => {
		const cms = makeMockCMS();
		const handler = createRevalidateRouteHandler(cms as never, {
			secret: "my-secret",
		});

		const request = new Request("http://localhost", {
			method: "POST",
			headers: {
				Authorization: "Bearer my-secret",
				"content-type": "application/json",
			},
			body: JSON.stringify({ slug: "post-a" }),
		});

		const res = await handler(request);
		expect(res.status).toBe(200);
		expect(cms.cache.sync).toHaveBeenCalledWith({ slug: "post-a" });
		const body = await res.json();
		expect(body.updated).toEqual(["post-a"]);
	});

	it("secret が不正の場合は 401 を返す", async () => {
		const cms = makeMockCMS();
		const handler = createRevalidateRouteHandler(cms as never, {
			secret: "my-secret",
		});

		const request = new Request("http://localhost", {
			method: "POST",
			headers: { Authorization: "Bearer wrong-secret" },
		});

		const res = await handler(request);
		expect(res.status).toBe(401);
		expect(cms.cache.sync).not.toHaveBeenCalled();
	});
});
