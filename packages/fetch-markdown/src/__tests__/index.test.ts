import { afterEach, describe, expect, it, vi } from "vitest";
import { markdownFetcher } from "../index";

describe("markdownFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("kind は 'markdown' で loadNotionBlocks は未実装", () => {
    const f = markdownFetcher();
    expect(f.kind).toBe("markdown");
    expect(f.loadNotionBlocks).toBeUndefined();
  });

  it("loadMarkdown は Notion Markdown export API を 1 リクエストで叩く", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("# title\n\nbody", {
          status: 200,
          headers: { "content-type": "text/markdown" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const f = markdownFetcher();
    const md = await f.loadMarkdown({} as never, "abc-page-id", {
      token: "test-token",
    });

    expect(md).toBe("# title\n\nbody");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.notion.com/v1/pages/abc-page-id.md");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
    expect((init.headers as Record<string, string>)["Notion-Version"]).toBe(
      "2025-09-03",
    );
  });

  it("notionVersion オプションで Notion-Version ヘッダを上書きできる", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("ok", {
          status: 200,
          headers: { "content-type": "text/markdown" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const f = markdownFetcher({ notionVersion: "2026-01-01" });
    await f.loadMarkdown({} as never, "x", { token: "t" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["Notion-Version"]).toBe(
      "2026-01-01",
    );
  });

  it("HTTP エラー時は source/load_markdown_failed を throw する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    const f = markdownFetcher();
    await expect(
      f.loadMarkdown({} as never, "missing", { token: "t" }),
    ).rejects.toMatchObject({ code: "source/load_markdown_failed" });
  });
});
