import { describe, expect, it, vi } from "vitest";
import {
  createCollectionRevalidateRouteHandler,
  createImageRouteHandler,
  createInvalidateAllRouteHandler,
  createNextHandler,
} from "../route-handlers";

const makeMockCMS = () => ({
  getCachedImage: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  handler: vi.fn().mockReturnValue(async () => new Response("ok")),
});

describe("createImageRouteHandler", () => {
  it("画像が存在する場合は Response を返す", async () => {
    const cms = makeMockCMS();
    cms.getCachedImage.mockResolvedValue({
      data: new ArrayBuffer(4),
      contentType: "image/png",
    });

    const handler = createImageRouteHandler(cms as never);
    const res = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ hash: "abc123" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(cms.getCachedImage).toHaveBeenCalledWith("abc123");
  });

  it("画像が存在しない場合は 404 を返す", async () => {
    const cms = makeMockCMS();
    cms.getCachedImage.mockResolvedValue(null);

    const handler = createImageRouteHandler(cms as never);
    const res = await handler(new Request("http://localhost"), {
      params: Promise.resolve({ hash: "notfound" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("createCollectionRevalidateRouteHandler", () => {
  it("正しい secret で invalidate をコレクション単位で呼ぶ", async () => {
    const cms = makeMockCMS();
    const handler = createCollectionRevalidateRouteHandler(cms as never, {
      secret: "my-secret",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer my-secret" },
    });

    const res = await handler(request, {
      params: Promise.resolve({ collection: "posts" }),
    });
    expect(res.status).toBe(200);
    expect(cms.invalidate).toHaveBeenCalledWith({ collection: "posts" });
  });

  it("body に slug を渡すとスラッグ単位で invalidate を呼ぶ", async () => {
    const cms = makeMockCMS();
    const handler = createCollectionRevalidateRouteHandler(cms as never, {
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

    const res = await handler(request, {
      params: Promise.resolve({ collection: "posts" }),
    });
    expect(res.status).toBe(200);
    expect(cms.invalidate).toHaveBeenCalledWith({
      collection: "posts",
      slug: "post-a",
    });
  });

  it("JSON パース失敗は 400 を返す (握りつぶさない)", async () => {
    const cms = makeMockCMS();
    const handler = createCollectionRevalidateRouteHandler(cms as never, {
      secret: "my-secret",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer my-secret",
        "content-type": "application/json",
      },
      body: "not valid json",
    });

    const res = await handler(request, {
      params: Promise.resolve({ collection: "posts" }),
    });
    expect(res.status).toBe(400);
    expect(cms.invalidate).not.toHaveBeenCalled();
  });

  it("secret が不正の場合は 401 を返す", async () => {
    const cms = makeMockCMS();
    const handler = createCollectionRevalidateRouteHandler(cms as never, {
      secret: "my-secret",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await handler(request, {
      params: Promise.resolve({ collection: "posts" }),
    });
    expect(res.status).toBe(401);
    expect(cms.invalidate).not.toHaveBeenCalled();
  });
});

describe("createNextHandler", () => {
  it("cms.handler() を呼び出してハンドラ関数を返す", () => {
    const cms = makeMockCMS();
    const handler = createNextHandler(cms as never, {
      webhookSecret: "secret",
    });
    expect(typeof handler).toBe("function");
    expect(cms.handler).toHaveBeenCalledWith({ webhookSecret: "secret" });
  });

  it("opts 省略時は webhookSecret なしで cms.handler() を呼ぶ", () => {
    const cms = makeMockCMS();
    createNextHandler(cms as never);
    expect(cms.handler).toHaveBeenCalledWith({ webhookSecret: undefined });
  });
});

describe("createInvalidateAllRouteHandler", () => {
  it("正しい secret で invalidate('all') を呼ぶ", async () => {
    const cms = makeMockCMS();
    const handler = createInvalidateAllRouteHandler(cms as never, {
      secret: "my-secret",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer my-secret" },
    });

    const res = await handler(request);
    expect(res.status).toBe(200);
    expect(cms.invalidate).toHaveBeenCalledWith("all");
  });

  it("secret が不正の場合は 401 を返す", async () => {
    const cms = makeMockCMS();
    const handler = createInvalidateAllRouteHandler(cms as never, {
      secret: "my-secret",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });

    const res = await handler(request);
    expect(res.status).toBe(401);
    expect(cms.invalidate).not.toHaveBeenCalled();
  });
});
