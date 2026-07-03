import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotionContext } from "../context.js";
import { useOgp } from "../embeds/useOgp.js";

function Probe({ url }: { url: string | null }) {
  const ogp = useOgp(url);
  return <div data-testid="result">{ogp ? JSON.stringify(ogp) : "none"}</div>;
}

describe("useOgp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ogpEndpoint が無ければ fetch しない", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Probe url="https://example.com" />);
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("url が null なら fetch しない(block.ogp 事前付与済みのケース)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(
      <NotionContext.Provider
        value={{ components: {}, ogpEndpoint: "/api/cms/ogp" }}
      >
        <Probe url={null} />
      </NotionContext.Provider>,
    );
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ogpEndpoint と url があれば fetch し、結果を反映する", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, ogp: { title: "Fetched" } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(
      <NotionContext.Provider
        value={{ components: {}, ogpEndpoint: "/api/cms/ogp" }}
      >
        <Probe url="https://example.com/article" />
      </NotionContext.Provider>,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/cms/ogp?url=https%3A%2F%2Fexample.com%2Farticle",
    );
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="result"]')?.textContent,
      ).toContain("Fetched");
    });
  });

  it("fetch が失敗しても例外を投げず undefined のまま", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const { container } = render(
      <NotionContext.Provider
        value={{ components: {}, ogpEndpoint: "/api/cms/ogp" }}
      >
        <Probe url="https://example.com" />
      </NotionContext.Provider>,
    );
    await Promise.resolve();
    expect(container.querySelector('[data-testid="result"]')?.textContent).toBe(
      "none",
    );
  });
});
