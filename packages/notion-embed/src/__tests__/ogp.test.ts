import { describe, expect, it, vi } from "vitest";
import { createOgpFetcher, fetchOgp } from "../ogp";

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
    vi.restoreAllMocks();
  });

  it("og:title がなければ <title> タグにフォールバックする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(makeHtml({ title: "Page Title" }), { status: 200 }),
    );

    const result = await fetchOgp("https://example.com");
    expect(result.title).toBe("Page Title");
    vi.restoreAllMocks();
  });

  it("HTTP エラーは Error を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await expect(fetchOgp("https://example.com/404")).rejects.toThrow(
      "HTTP 404",
    );
    vi.restoreAllMocks();
  });

  it("fetch が throw した場合はそのまま伝播する", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));

    await expect(fetchOgp("https://unreachable.example.com")).rejects.toThrow(
      "network error",
    );
    vi.restoreAllMocks();
  });

  it("HTML エンティティをデコードする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(makeHtml({ ogTitle: "Hello &amp; World" }), {
        status: 200,
      }),
    );

    const result = await fetchOgp("https://example.com/entities");
    expect(result.title).toBe("Hello & World");
    vi.restoreAllMocks();
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
    vi.restoreAllMocks();
  });
});

describe("createOgpFetcher", () => {
  it("TTL 内はキャッシュを返す (fetch を 1 回しか呼ばない)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(makeHtml({ ogTitle: "Cached Title" }), { status: 200 }),
      );

    const fetcher = createOgpFetcher();
    await fetcher("https://example.com/cached");
    await fetcher("https://example.com/cached");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
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

    const fetcher = createOgpFetcher({ ttlMs: 100 });
    await fetcher("https://example.com/ttl");
    vi.advanceTimersByTime(200);
    await fetcher("https://example.com/ttl");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("インスタンス間でキャッシュを共有しない", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(() =>
        Promise.resolve(
          new Response(makeHtml({ ogTitle: "Title" }), { status: 200 }),
        ),
      );

    const a = createOgpFetcher();
    const b = createOgpFetcher();
    await a("https://example.com/shared");
    await b("https://example.com/shared");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it("HTTP エラーは Error を投げる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );
    const fetcher = createOgpFetcher();
    await expect(fetcher("https://example.com/err")).rejects.toThrow(
      "HTTP 500",
    );
    vi.restoreAllMocks();
  });
});
