import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  pages: {
    list: vi.fn(),
    find: vi.fn(),
    check: vi.fn(),
    cache: {
      warm: vi.fn(),
      invalidate: vi.fn(),
    },
  },
  getCachedImage: vi.fn(),
  cacheImage: vi.fn(),
};

vi.mock("../lib/cms.js", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
}));

vi.mock("@notionhq/client", () => ({
  Client: class FakeClient {},
}));
vi.mock("@notion-headless-cms/notion-orm", () => ({
  fetchBlockTree: vi
    .fn()
    .mockResolvedValue([{ object: "block", id: "b1", type: "paragraph" }]),
}));
vi.mock("@notion-headless-cms/react-renderer/server", () => ({
  resolveBlockImageUrls: vi
    .fn()
    .mockImplementation((blocks: unknown[]) => blocks),
}));

const { loader: indexLoader } = await import("../routes/index.js");
const { action: warmAction } = await import("../routes/api/warm.js");
const { action: pageCheckAction } = await import(
  "../routes/api/pages/$slug/check.js"
);

const fakeContext = {
  cloudflare: {
    env: { NOTION_TOKEN: "test-token" },
    ctx: { waitUntil: vi.fn() },
  },
};

describe("index loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("home ページが存在しない場合はリダイレクト", async () => {
    fakeCms.pages.find.mockResolvedValue(null);
    const result = await indexLoader({
      request: new Request("https://example.com/"),
      context: fakeContext,
    } as never);
    expect((result as Response).status).toBe(302);
  });

  it("home ページが存在する場合は notionBlocks を返す", async () => {
    fakeCms.pages.find.mockResolvedValue({
      id: "id-1",
      slug: "home",
      title: "ホーム",
      lastEditedTime: "2024-01-01T00:00:00Z",
      notionBlocks: async () => [
        { object: "block", id: "b1", type: "paragraph" },
      ],
    });
    const result = await indexLoader({
      request: new Request("https://example.com/"),
      context: fakeContext,
    } as never);
    const r = result as { blocks: unknown[] };
    expect(r.blocks).toHaveLength(1);
  });
});

describe("warm action()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ウォームアップ結果を JSON で返す (pages コレクション)", async () => {
    fakeCms.pages.cache.warm.mockResolvedValue({ ok: 3, failed: [] });
    const result = await warmAction({ context: fakeContext } as never);
    const json = await (result as Response).json();
    expect(json).toEqual({ ok: 3, failed: [] });
  });
});

describe("api/pages/:slug/check action()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fresh（stale:false）のときは受け取った v をそのまま返す", async () => {
    fakeCms.pages.check.mockResolvedValue({ stale: false });
    const result = await pageCheckAction({
      params: { slug: "home" },
      request: new Request(
        "https://example.com/api/pages/home/check?v=2024-01-01T00:00:00Z",
        { method: "POST" },
      ),
      context: fakeContext,
    } as never);
    expect(fakeCms.pages.check).toHaveBeenCalledWith(
      "home",
      "2024-01-01T00:00:00Z",
    );
    const json = await (result as Response).json();
    expect(json).toEqual({ stale: false, version: "2024-01-01T00:00:00Z" });
  });

  it("stale（stale:true）のときは最新アイテムの lastEditedTime を返す", async () => {
    fakeCms.pages.check.mockResolvedValue({
      stale: true,
      item: { slug: "home", lastEditedTime: "2024-02-02T00:00:00Z" },
    });
    const result = await pageCheckAction({
      params: { slug: "home" },
      request: new Request(
        "https://example.com/api/pages/home/check?v=2024-01-01T00:00:00Z",
        { method: "POST" },
      ),
      context: fakeContext,
    } as never);
    const json = await (result as Response).json();
    expect(json).toEqual({ stale: true, version: "2024-02-02T00:00:00Z" });
  });

  it("見つからない場合は 404", async () => {
    fakeCms.pages.check.mockResolvedValue(null);
    const result = await pageCheckAction({
      params: { slug: "missing" },
      request: new Request("https://example.com/api/pages/missing/check?v=x", {
        method: "POST",
      }),
      context: fakeContext,
    } as never);
    expect((result as Response).status).toBe(404);
  });
});
