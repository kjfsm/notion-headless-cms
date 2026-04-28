import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearOgpCache, fetchOgp } from "../ogp";

const makeHtml = (parts: {
  title?: string;
  ogTitle?: string;
  ogDesc?: string;
  ogImage?: string;
  ogSite?: string;
}) => `
<html>
<head>
${parts.ogTitle ? `<meta property="og:title" content="${parts.ogTitle}" />` : ""}
${parts.ogDesc ? `<meta property="og:description" content="${parts.ogDesc}" />` : ""}
${parts.ogImage ? `<meta property="og:image" content="${parts.ogImage}" />` : ""}
${parts.ogSite ? `<meta property="og:site_name" content="${parts.ogSite}" />` : ""}
${parts.title ? `<title>${parts.title}</title>` : ""}
</head>
<body></body>
</html>
`;

describe("fetchOgp", () => {
  beforeEach(() => {
    clearOgpCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearOgpCache();
  });

  it("og:title / og:description / og:image / og:site_name を取得する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        makeHtml({
          ogTitle: "Test Title",
          ogDesc: "Test Description",
          ogImage: "https://example.com/image.png",
          ogSite: "Example Site",
        }),
        { status: 200 },
      ),
    );

    const result = await fetchOgp("https://example.com");
    expect(result.title).toBe("Test Title");
    expect(result.description).toBe("Test Description");
    expect(result.image).toBe("https://example.com/image.png");
    expect(result.siteName).toBe("Example Site");
  });

  it("og:title がなければ <title> タグにフォールバックする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(makeHtml({ title: "Page Title" }), { status: 200 }),
    );

    const result = await fetchOgp("https://example.com");
    expect(result.title).toBe("Page Title");
  });

  it("HTTP エラーは空オブジェクトを返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchOgp("https://example.com/404");
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("fetch が throw しても空オブジェクトを返す", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchOgp("https://unreachable.example.com");
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it("TTL 内はキャッシュを返す (fetch を 1 回しか呼ばない)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(makeHtml({ ogTitle: "Cached Title" }), { status: 200 }),
      );

    await fetchOgp("https://example.com/cached");
    await fetchOgp("https://example.com/cached");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("TTL 切れ後は再フェッチする", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(makeHtml({ ogTitle: "Title" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(makeHtml({ ogTitle: "Title" }), { status: 200 }),
      );

    await fetchOgp("https://example.com/ttl", { ttlMs: 100 });
    vi.advanceTimersByTime(200);
    await fetchOgp("https://example.com/ttl", { ttlMs: 100 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("HTML エンティティをデコードする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(makeHtml({ ogTitle: "Hello &amp; World" }), { status: 200 }),
    );

    const result = await fetchOgp("https://example.com/entities");
    expect(result.title).toBe("Hello & World");
  });

  it("content-first バリアントの meta タグも読める", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head><meta content="Alt Title" property="og:title" /></head></html>`,
        { status: 200 },
      ),
    );

    const result = await fetchOgp("https://example.com/alt");
    expect(result.title).toBe("Alt Title");
  });
});
