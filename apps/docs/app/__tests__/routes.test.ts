import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  pages: {
    find: vi.fn(),
  },
};

vi.mock("../lib/cms.js", () => ({
  makeCms: vi.fn().mockReturnValue(fakeCms),
}));

const { loader: indexLoader } = await import("../routes/index.js");
const { loader: slugLoader } = await import("../routes/$slug.js");

const fakeContext = {
  cloudflare: {
    env: { NOTION_TOKEN: "test-token" },
    ctx: { waitUntil: vi.fn() },
  },
};

const fakeEntry = {
  id: "id-1",
  slug: "home",
  version: "2024-01-01T00:00:00Z",
  blocks: [{ id: "b1", type: "paragraph", data: {} }],
  images: {},
  links: {},
  meta: {
    id: "id-1",
    slug: "home",
    lastEditedTime: "2024-01-01T00:00:00Z",
    name: "ホーム",
    description: null,
    status: "完了" as const,
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

  it("home ページが存在する場合は blocks を返す", async () => {
    fakeCms.pages.find.mockResolvedValue(fakeEntry);
    const result = await indexLoader({
      request: new Request("https://example.com/"),
      context: fakeContext,
    } as never);
    const r = result as { blocks: unknown[]; item: { name: string | null } };
    expect(r.blocks).toHaveLength(1);
    expect(r.item.name).toBe("ホーム");
  });
});

describe("$slug loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ページが存在しない場合は 404", async () => {
    fakeCms.pages.find.mockResolvedValue(null);
    await expect(
      slugLoader({
        params: { slug: "missing" },
        context: fakeContext,
      } as never),
    ).rejects.toMatchObject({ init: { status: 404 } });
  });

  it("ページが存在する場合は blocks を返す", async () => {
    fakeCms.pages.find.mockResolvedValue({
      ...fakeEntry,
      slug: "about",
      meta: { ...fakeEntry.meta, slug: "about", name: "About" },
    });
    const result = await slugLoader({
      params: { slug: "about" },
      context: fakeContext,
    } as never);
    const r = result as { blocks: unknown[]; item: { name: string | null } };
    expect(r.blocks).toHaveLength(1);
    expect(r.item.name).toBe("About");
  });
});
