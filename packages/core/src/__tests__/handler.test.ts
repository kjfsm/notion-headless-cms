import { describe, expect, it, vi } from "vitest";
import { CMSError } from "../errors";
import type { HandlerAdapter } from "../handler";
import { createHandler } from "../handler";

// HandlerAdapter.imageCache は ImageCacheOps（name フィールドなし）
function makeAdapter(overrides: Partial<HandlerAdapter> = {}): HandlerAdapter {
  return {
    imageCache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
    parseWebhookFor: vi.fn().mockResolvedValue({ collection: "posts" }),
    revalidate: vi.fn().mockResolvedValue(undefined),
    peekVersionFor: vi.fn().mockResolvedValue(null),
    checkFor: vi.fn().mockResolvedValue({ stale: false }),
    warmByPageId: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

/** X-Notion-Signature と同じ HMAC-SHA256(hex) を計算する。 */
async function signNotion(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return `sha256=${hex}`;
}

describe("createHandler", () => {
  describe("GET {basePath}/images/:hash — 画像プロキシ", () => {
    it("キャッシュヒット時は 200 と画像データを返す", async () => {
      const data = new ArrayBuffer(8);
      const adapter = makeAdapter({
        imageCache: {
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

    it("キャッシュミス時に logger.warn でハッシュ未ヒットを記録する", async () => {
      const warn = vi.fn();
      const handler = createHandler(makeAdapter({ logger: { warn } }));
      const res = await handler(
        new Request("http://localhost/api/cms/images/notexist"),
      );
      expect(res.status).toBe(404);
      expect(warn).toHaveBeenCalledWith(
        "画像プロキシ: ハッシュ未ヒット",
        expect.objectContaining({
          operation: "handler.image",
          imageHash: "notexist",
          status: 404,
        }),
      );
    });

    it("ハッシュが空の場合は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/images/"),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("POST {basePath}/revalidate/:collection — Webhook 受信", () => {
    it("有効な Webhook は 200 と { ok: true, scope } を返す", async () => {
      const scope = { collection: "posts" as const };
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockResolvedValue(scope),
        revalidate: vi.fn().mockResolvedValue(undefined),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      const body = (await res.json()) as { ok: boolean; scope: unknown };
      expect(body.ok).toBe(true);
      expect(body.scope).toEqual(scope);
    });

    it("有効な Webhook 時に adapter.revalidate が scope で呼ばれる", async () => {
      const scope = { collection: "posts" as const };
      const revalidate = vi.fn().mockResolvedValue(undefined);
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockResolvedValue(scope),
        revalidate,
      });
      const handler = createHandler(adapter);
      await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(revalidate).toHaveBeenCalledWith(scope);
    });

    it("webhookSecret を parseWebhookFor に渡す", async () => {
      const parseWebhookFor = vi
        .fn()
        .mockResolvedValue({ collection: "posts" });
      const adapter = makeAdapter({ parseWebhookFor });
      const handler = createHandler(adapter, { webhookSecret: "my-secret" });
      await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(parseWebhookFor).toHaveBeenCalledWith(
        "posts",
        expect.any(Request),
        "my-secret",
      );
    });

    it("collection なし (revalidate/ のみ) は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/", { method: "POST" }),
      );
      expect(res.status).toBe(400);
    });

    it("webhook/unknown_collection CMSError は 404 を返す", async () => {
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "webhook/unknown_collection",
            message: "Unknown",
            context: { operation: "parseWebhookFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/unknown", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { ok: boolean; code: string };
      expect(body.ok).toBe(false);
      expect(body.code).toBe("webhook/unknown_collection");
    });

    it("webhook/signature_invalid CMSError は 401 を返す", async () => {
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "webhook/signature_invalid",
            message: "Invalid",
            context: { operation: "parseWebhookFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(401);
    });

    it("webhook/not_implemented CMSError は 501 を返す", async () => {
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "webhook/not_implemented",
            message: "Not implemented",
            context: { operation: "parseWebhookFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(501);
    });

    it("webhook/payload_invalid CMSError は 400 を返す", async () => {
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "webhook/payload_invalid",
            message: "Invalid payload",
            context: { operation: "parseWebhookFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("未知の CMSError は再スローされる", async () => {
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "cache/io_failed",
            message: "IO failed",
            context: { operation: "parseWebhookFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      await expect(
        handler(
          new Request("http://localhost/api/cms/revalidate/posts", {
            method: "POST",
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("GET {basePath}/versions/:collection/:slug — バージョン照会", () => {
    it("peekVersion の結果を 200 + JSON で返す", async () => {
      const version = {
        notionUpdatedAt: "2024-01-01T00:00:00.000Z",
        cachedAt: 123,
      };
      const adapter = makeAdapter({
        peekVersionFor: vi.fn().mockResolvedValue(version),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/versions/posts/my-slug"),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/json");
      expect(await res.json()).toEqual(version);
    });

    it("collection と slug を peekVersionFor に渡す", async () => {
      const peekVersionFor = vi.fn().mockResolvedValue(null);
      const handler = createHandler(makeAdapter({ peekVersionFor }));
      await handler(
        new Request("http://localhost/api/cms/versions/posts/my-slug"),
      );
      expect(peekVersionFor).toHaveBeenCalledWith("posts", "my-slug");
    });

    it("キャッシュ未登録 (null) でも 200 + null を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/versions/posts/my-slug"),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it("slug が欠ける場合は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/versions/posts"),
      );
      expect(res.status).toBe(400);
    });

    it("collection が欠ける場合は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/versions/"),
      );
      expect(res.status).toBe(400);
    });

    it("handler/unknown_collection CMSError は 404 を返す", async () => {
      const adapter = makeAdapter({
        peekVersionFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "handler/unknown_collection",
            message: "Unknown",
            context: { operation: "peekVersionFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/versions/unknown/my-slug"),
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { ok: boolean; code: string };
      expect(body.ok).toBe(false);
      expect(body.code).toBe("handler/unknown_collection");
    });

    it("POST /api/cms/versions/:collection/:slug は 404 を返す（GET のみ有効）", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/versions/posts/my-slug", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(404);
    });

    it("versionsPath を変更できる", async () => {
      const version = {
        notionUpdatedAt: "2024-01-01T00:00:00.000Z",
        cachedAt: 1,
      };
      const adapter = makeAdapter({
        peekVersionFor: vi.fn().mockResolvedValue(version),
      });
      const handler = createHandler(adapter, { versionsPath: "/peek" });
      const res = await handler(
        new Request("http://localhost/api/cms/peek/posts/my-slug"),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(version);
    });
  });

  describe("GET|POST {basePath}/check/:collection/:slug — 更新チェック", () => {
    it("差分なし (stale: false) を 200 で返す", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockResolvedValue({ stale: false }),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts/my-slug?v=v1"),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ stale: false });
    });

    it("差分あり (stale: true) を 200 で返す", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockResolvedValue({ stale: true }),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts/my-slug?v=v1"),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ stale: true });
    });

    it("collection / slug / ?v= を checkFor に渡す", async () => {
      const checkFor = vi.fn().mockResolvedValue({ stale: false });
      const handler = createHandler(makeAdapter({ checkFor }));
      await handler(
        new Request("http://localhost/api/cms/check/posts/my-slug?v=abc"),
      );
      expect(checkFor).toHaveBeenCalledWith("posts", "my-slug", "abc");
    });

    it("POST でも動作する", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockResolvedValue({ stale: true }),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts/my-slug?v=v1", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("アイテム未存在 (null) は 404 を返す", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockResolvedValue(null),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts/missing?v=v1"),
      );
      expect(res.status).toBe(404);
    });

    it("?v= が無い場合は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts/my-slug"),
      );
      expect(res.status).toBe(400);
    });

    it("slug が欠ける場合は 400 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/check/posts?v=v1"),
      );
      expect(res.status).toBe(400);
    });

    it("handler/unknown_collection CMSError は 404 を返す", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockRejectedValue(
          new CMSError({
            code: "handler/unknown_collection",
            message: "Unknown",
            context: { operation: "checkFor" },
          }),
        ),
      });
      const handler = createHandler(adapter);
      const res = await handler(
        new Request("http://localhost/api/cms/check/unknown/my-slug?v=v1"),
      );
      expect(res.status).toBe(404);
    });

    it("checkPath を変更できる", async () => {
      const adapter = makeAdapter({
        checkFor: vi.fn().mockResolvedValue({ stale: false }),
      });
      const handler = createHandler(adapter, {
        checkPath: "/revalidate-check",
      });
      const res = await handler(
        new Request(
          "http://localhost/api/cms/revalidate-check/posts/my-slug?v=v1",
        ),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("POST {basePath}/notion-webhook — 公式 Notion webhook", () => {
    const SECRET = "verification-token-xyz";

    it("verification_token を含む POST は secret 未設定でも 200 + token を echo する", async () => {
      const onVerificationToken = vi.fn();
      const handler = createHandler(makeAdapter(), {
        notionWebhook: { onVerificationToken },
      });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          body: JSON.stringify({ verification_token: "abc-123" }),
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verification_token: string };
      expect(body.verification_token).toBe("abc-123");
      expect(onVerificationToken).toHaveBeenCalledWith("abc-123");
    });

    it("secret 未設定のイベントは 503 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          body: JSON.stringify({ entity: { id: "page-1", type: "page" } }),
        }),
      );
      expect(res.status).toBe(503);
    });

    it("署名が無い / 不一致なら 401 を返す", async () => {
      const handler = createHandler(makeAdapter(), {
        notionWebhook: { secret: SECRET },
      });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": "sha256=deadbeef" },
          body: JSON.stringify({ entity: { id: "page-1", type: "page" } }),
        }),
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("webhook/signature_invalid");
    });

    it("正しい署名 + page entity で warmByPageId が呼ばれ 200 を返す", async () => {
      const warmByPageId = vi
        .fn()
        .mockResolvedValue({ collection: "posts", slug: "hello" });
      const handler = createHandler(makeAdapter({ warmByPageId }), {
        notionWebhook: { secret: SECRET },
      });
      const raw = JSON.stringify({
        type: "page.content_updated",
        entity: { id: "page-42", type: "page" },
      });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": await signNotion(SECRET, raw) },
          body: raw,
        }),
      );
      expect(res.status).toBe(200);
      expect(warmByPageId).toHaveBeenCalledWith("page-42");
    });

    it("adapter.notionWebhookSecret を既定 secret として使う", async () => {
      const warmByPageId = vi.fn().mockResolvedValue(null);
      const handler = createHandler(
        makeAdapter({ warmByPageId, notionWebhookSecret: SECRET }),
      );
      const raw = JSON.stringify({ entity: { id: "p1", type: "page" } });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": await signNotion(SECRET, raw) },
          body: raw,
        }),
      );
      expect(res.status).toBe(200);
      expect(warmByPageId).toHaveBeenCalledWith("p1");
    });

    it("page 以外の entity は warm せず 200 を返す", async () => {
      const warmByPageId = vi.fn().mockResolvedValue(null);
      const handler = createHandler(makeAdapter({ warmByPageId }), {
        notionWebhook: { secret: SECRET },
      });
      const raw = JSON.stringify({
        entity: { id: "ds-1", type: "data_source" },
      });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": await signNotion(SECRET, raw) },
          body: raw,
        }),
      );
      expect(res.status).toBe(200);
      expect(warmByPageId).not.toHaveBeenCalled();
    });

    it("scheduleBackground があればウォームを待たず 200 を返す", async () => {
      const schedule = vi.fn();
      const warmByPageId = vi.fn().mockReturnValue(new Promise(() => {}));
      const handler = createHandler(
        makeAdapter({
          warmByPageId,
          notionWebhookSecret: SECRET,
          scheduleBackground: schedule,
        }),
      );
      const raw = JSON.stringify({ entity: { id: "p1", type: "page" } });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          headers: { "X-Notion-Signature": await signNotion(SECRET, raw) },
          body: raw,
        }),
      );
      expect(res.status).toBe(200);
      expect(schedule).toHaveBeenCalledOnce();
    });

    it("不正な JSON は 400 を返す", async () => {
      const handler = createHandler(makeAdapter(), {
        notionWebhook: { secret: SECRET },
      });
      const res = await handler(
        new Request("http://localhost/api/cms/notion-webhook", {
          method: "POST",
          body: "{not json",
        }),
      );
      expect(res.status).toBe(400);
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

    it("GET /api/cms/revalidate/:collection は 404 を返す（POST のみ有効）", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "GET",
        }),
      );
      expect(res.status).toBe(404);
    });

    it("PUT /api/cms/revalidate/:collection は 404 を返す", async () => {
      const handler = createHandler(makeAdapter());
      const res = await handler(
        new Request("http://localhost/api/cms/revalidate/posts", {
          method: "PUT",
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
        parseWebhookFor: vi.fn().mockResolvedValue(scope),
      });
      const handler = createHandler(adapter, { basePath: "/cms" });
      const res = await handler(
        new Request("http://localhost/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("末尾スラッシュ付き basePath は正規化される", async () => {
      const scope = { collection: "posts" as const };
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockResolvedValue(scope),
      });
      const handler = createHandler(adapter, { basePath: "/cms/" });
      const res = await handler(
        new Request("http://localhost/cms/revalidate/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("revalidatePath を変更できる", async () => {
      const scope = { collection: "posts" as const };
      const adapter = makeAdapter({
        parseWebhookFor: vi.fn().mockResolvedValue(scope),
      });
      const handler = createHandler(adapter, {
        revalidatePath: "/webhook",
      });
      const res = await handler(
        new Request("http://localhost/api/cms/webhook/posts", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
    });

    it("imagesPath を変更できる", async () => {
      const data = new ArrayBuffer(4);
      const adapter = makeAdapter({
        imageCache: {
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
