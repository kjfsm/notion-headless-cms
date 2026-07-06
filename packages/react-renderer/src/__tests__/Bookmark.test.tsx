import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Bookmark } from "../blocks/Bookmark.js";
import { NotionContext } from "../context.js";

function bookmarkBlock(url: string, ogp?: { title?: string }): BookmarkBlockObjectResponse {
  return {
    object: "block",
    id: "bm-1",
    type: "bookmark",
    has_children: false,
    bookmark: { url, caption: [] },
    ...(ogp ? { ogp } : {}),
  } as unknown as BookmarkBlockObjectResponse;
}

describe("Bookmark", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("block.ogp が事前付与されていればそれを使い fetch しない", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <NotionContext.Provider value={{ components: {}, ogpEndpoint: "/api/cms/ogp" }}>
        <Bookmark block={bookmarkBlock("https://example.com", { title: "Preloaded" })} />
      </NotionContext.Provider>,
    );
    expect(container.textContent).toContain("Preloaded");
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("block.ogp が無く ogpEndpoint があれば useOgp で取得して描画する", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ogp: { title: "Hydrated" } }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { container } = render(
      <NotionContext.Provider value={{ components: {}, ogpEndpoint: "/api/cms/ogp" }}>
        <Bookmark block={bookmarkBlock("https://example.com")} />
      </NotionContext.Provider>,
    );
    expect(fetchSpy).toHaveBeenCalledWith("/api/cms/ogp?url=https%3A%2F%2Fexample.com");
    await waitFor(() => {
      expect(container.textContent).toContain("Hydrated");
    });
  });

  it("ogpEndpoint も block.ogp も無ければホスト名だけのシェルのまま", async () => {
    const { container } = render(<Bookmark block={bookmarkBlock("https://example.com")} />);
    expect(container.textContent).toContain("example.com");
  });
});
