import { describe, expect, it, vi } from "vitest";
import {
	createImageRouteHandler,
	createRevalidateRouteHandler,
} from "../route-handlers";

const makeMockCMS = () => ({
	$getCachedImage: vi.fn(),
	$revalidate: vi.fn().mockResolvedValue(undefined),
});

describe("createImageRouteHandler", () => {
	it("画像が存在する場合は Response を返す", async () => {
		const cms = makeMockCMS();
		cms.$getCachedImage.mockResolvedValue({
			data: new ArrayBuffer(4),
			contentType: "image/png",
		});

		const handler = createImageRouteHandler(cms as never);
		const res = await handler(new Request("http://localhost"), {
			params: Promise.resolve({ hash: "abc123" }),
		});

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/png");
		expect(cms.$getCachedImage).toHaveBeenCalledWith("abc123");
	});

	it("画像が存在しない場合は 404 を返す", async () => {
		const cms = makeMockCMS();
		cms.$getCachedImage.mockResolvedValue(null);

		const handler = createImageRouteHandler(cms as never);
		const res = await handler(new Request("http://localhost"), {
			params: Promise.resolve({ hash: "notfound" }),
		});

		expect(res.status).toBe(404);
	});
});

describe("createRevalidateRouteHandler", () => {
	it("正しい secret で $revalidate をスコープ付きで呼ぶ", async () => {
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
			body: JSON.stringify({ collection: "posts", slug: "post-a" }),
		});

		const res = await handler(request);
		expect(res.status).toBe(200);
		expect(cms.$revalidate).toHaveBeenCalledWith({
			collection: "posts",
			slug: "post-a",
		});
	});

	it("body なしの場合は全体を revalidate する", async () => {
		const cms = makeMockCMS();
		const handler = createRevalidateRouteHandler(cms as never, {
			secret: "my-secret",
		});

		const request = new Request("http://localhost", {
			method: "POST",
			headers: { Authorization: "Bearer my-secret" },
		});

		const res = await handler(request);
		expect(res.status).toBe(200);
		expect(cms.$revalidate).toHaveBeenCalledWith("all");
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
		expect(cms.$revalidate).not.toHaveBeenCalled();
	});
});
