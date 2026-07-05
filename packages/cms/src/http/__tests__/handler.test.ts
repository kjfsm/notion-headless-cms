import { describe, expect, it, vi } from "vitest";
import { memoryBlobStore } from "../../store/memory.js";
import type { BlobStore } from "../../store/types.js";
import type { HttpHandlerAdapter } from "../handler.js";
import { createFetchHandler } from "../handler.js";
import { hmacSha256Hex } from "../webhook.js";

const ROUTES = "/api/cms";

function makeAdapter(
  overrides: Partial<HttpHandlerAdapter> = {},
): HttpHandlerAdapter {
  return {
    images: memoryBlobStore(),
    ...overrides,
  };
}

describe("createFetchHandler", () => {
  it("routes 配下でなければ 404", async () => {
    const handler = createFetchHandler(makeAdapter(), { routes: ROUTES });
    const res = await handler(new Request("https://x/other"));
    expect(res.status).toBe(404);
  });

  it("画像を immutable キャッシュヘッダ付きで配信する", async () => {
    const images = memoryBlobStore();
    await images.put("image/abc123", new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    });
    const handler = createFetchHandler(makeAdapter({ images }), {
      routes: ROUTES,
    });

    const res = await handler(new Request(`https://x${ROUTES}/images/abc123`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("存在しない画像ハッシュは 404", async () => {
    const handler = createFetchHandler(makeAdapter(), { routes: ROUTES });
    const res = await handler(new Request(`https://x${ROUTES}/images/missing`));
    expect(res.status).toBe(404);
  });

  it("画像配信は getWithMetadata で 1 回の読み取りに抑える(get/head は呼ばない)", async () => {
    const images = memoryBlobStore();
    await images.put("image/abc123", new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    });
    let legacyReads = 0;
    const originalGet = images.get.bind(images);
    const originalHead = images.head.bind(images);
    images.get = async (key) => {
      legacyReads++;
      return originalGet(key);
    };
    images.head = async (key) => {
      legacyReads++;
      return originalHead(key);
    };
    const handler = createFetchHandler(makeAdapter({ images }), {
      routes: ROUTES,
    });

    const res = await handler(new Request(`https://x${ROUTES}/images/abc123`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(legacyReads).toBe(0);
  });

  it("getWithMetadata を持たない実装でも get+head にフォールバックして配信する", async () => {
    const base = memoryBlobStore();
    await base.put("image/abc123", new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    });
    const legacy: BlobStore = {
      get: (key) => base.get(key),
      put: (key, value, opts) => base.put(key, value, opts),
      head: (key) => base.head(key),
      delete: (key) => base.delete(key),
    };
    const handler = createFetchHandler(makeAdapter({ images: legacy }), {
      routes: ROUTES,
    });

    const res = await handler(new Request(`https://x${ROUTES}/images/abc123`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("realtime は onRealtimeUpgrade に委譲する", async () => {
    // 実際の Workers ランタイムでは WebSocket アップグレード時に 101 を返すが、
    // Node/undici の Response は 101 を許可しないため、委譲そのものをテストする。
    const onRealtimeUpgrade = vi
      .fn()
      .mockResolvedValue(new Response("upgraded", { status: 200 }));
    const handler = createFetchHandler(makeAdapter({ onRealtimeUpgrade }), {
      routes: ROUTES,
    });
    const res = await handler(new Request(`https://x${ROUTES}/realtime`));
    expect(await res.text()).toBe("upgraded");
    expect(onRealtimeUpgrade).toHaveBeenCalledTimes(1);
  });

  it("onRealtimeUpgrade 未設定なら realtime は 404", async () => {
    const handler = createFetchHandler(makeAdapter(), { routes: ROUTES });
    const res = await handler(new Request(`https://x${ROUTES}/realtime`));
    expect(res.status).toBe(404);
  });

  it("preview は onPreview に rel パスを渡して委譲する", async () => {
    const onPreview = vi.fn().mockResolvedValue(new Response("preview ok"));
    const handler = createFetchHandler(makeAdapter({ onPreview }), {
      routes: ROUTES,
    });
    const res = await handler(
      new Request(`https://x${ROUTES}/preview/posts/hello?sig=abc`),
    );
    expect(await res.text()).toBe("preview ok");
    expect(onPreview).toHaveBeenCalledWith(expect.any(Request), "posts/hello");
  });

  it("verification_token を含む webhook は echo してコールバックを呼ぶ", async () => {
    const onVerificationToken = vi.fn();
    const handler = createFetchHandler(makeAdapter({ onVerificationToken }), {
      routes: ROUTES,
    });
    const res = await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        body: JSON.stringify({ verification_token: "tok123" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      verification_token: "tok123",
    });
    expect(onVerificationToken).toHaveBeenCalledWith("tok123");
  });

  it("webhookSecret 未設定なら 503", async () => {
    const handler = createFetchHandler(makeAdapter(), { routes: ROUTES });
    const res = await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        body: JSON.stringify({ entity: { type: "page", id: "p1" } }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("署名不正なら 401", async () => {
    const handler = createFetchHandler(
      makeAdapter({ webhookSecret: "s3cr3t" }),
      { routes: ROUTES },
    );
    const res = await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        headers: { "X-Notion-Signature": "sha256=bogus" },
        body: JSON.stringify({ entity: { type: "page", id: "p1" } }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("署名が正しければ onWebhookEvent が pageId で呼ばれる", async () => {
    const secret = "s3cr3t";
    const body = JSON.stringify({ entity: { type: "page", id: "page-123" } });
    const signature = `sha256=${await hmacSha256Hex(secret, body)}`;
    const onWebhookEvent = vi.fn();
    const handler = createFetchHandler(
      makeAdapter({ webhookSecret: secret, onWebhookEvent }),
      { routes: ROUTES },
    );

    const res = await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        headers: { "X-Notion-Signature": signature },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(onWebhookEvent).toHaveBeenCalledWith("page-123");
  });

  it("waitUntil があればレスポンスを待たずに返し、バックグラウンドで処理を渡す", async () => {
    const secret = "s3cr3t";
    const body = JSON.stringify({ entity: { type: "page", id: "page-123" } });
    const signature = `sha256=${await hmacSha256Hex(secret, body)}`;
    const waitUntil = vi.fn();
    const onWebhookEvent = vi.fn();
    const handler = createFetchHandler(
      {
        images: memoryBlobStore(),
        webhookSecret: secret,
        onWebhookEvent,
        waitUntil,
      },
      { routes: ROUTES },
    );

    await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        headers: { "X-Notion-Signature": signature },
        body,
      }),
    );
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("ogp は onOgp に委譲する", async () => {
    const onOgp = vi.fn().mockResolvedValue(new Response("ogp ok"));
    const handler = createFetchHandler(makeAdapter({ onOgp }), {
      routes: ROUTES,
    });
    const res = await handler(
      new Request(`https://x${ROUTES}/ogp?url=https://example.com`),
    );
    expect(await res.text()).toBe("ogp ok");
    expect(onOgp).toHaveBeenCalledWith(expect.any(Request));
  });

  it("onOgp 未設定なら ogp は 404", async () => {
    const handler = createFetchHandler(makeAdapter(), { routes: ROUTES });
    const res = await handler(new Request(`https://x${ROUTES}/ogp?url=x`));
    expect(res.status).toBe(404);
  });

  it("page entity を含まない webhook はスキップする", async () => {
    const secret = "s3cr3t";
    const body = JSON.stringify({ entity: { type: "database", id: "db-1" } });
    const signature = `sha256=${await hmacSha256Hex(secret, body)}`;
    const onWebhookEvent = vi.fn();
    const handler = createFetchHandler(
      makeAdapter({ webhookSecret: secret, onWebhookEvent }),
      { routes: ROUTES },
    );

    const res = await handler(
      new Request(`https://x${ROUTES}/webhook`, {
        method: "POST",
        headers: { "X-Notion-Signature": signature },
        body,
      }),
    );
    expect(res.status).toBe(200);
    expect(onWebhookEvent).not.toHaveBeenCalled();
  });
});
