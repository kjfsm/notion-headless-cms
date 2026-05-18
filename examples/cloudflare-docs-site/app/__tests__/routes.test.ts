import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeCms = {
  docs: {
    list: vi.fn(),
    find: vi.fn(),
    peekVersion: vi.fn(),
    cache: {
      warm: vi.fn(),
    },
  },
  pages: {
    list: vi.fn(),
    find: vi.fn(),
    peekVersion: vi.fn(),
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
const { loader: layoutLoader } = await import("../routes/docs/_layout.js");
const { loader: docLoader } = await import("../routes/docs/$slug.js");
const { action: warmAction } = await import("../routes/api/warm.js");

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
    const result = await indexLoader({ context: fakeContext } as never);
    expect((result as Response).status).toBe(302);
  });

  it("home ページが存在する場合は markdown を返す", async () => {
    fakeCms.pages.find.mockResolvedValue({
      id: "id-1",
      slug: "home",
      title: "ホーム",
      lastEditedTime: "2024-01-01T00:00:00Z",
      markdown: async () => "# ホーム",
    });
    const result = await indexLoader({ context: fakeContext } as never);
    expect((result as { markdown: string }).markdown).toBe("# ホーム");
  });
});

describe("docs layout loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ドキュメント一覧を返す", async () => {
    fakeCms.docs.list.mockResolvedValue([
      {
        slug: "installation",
        name: "インストール",
        section: "はじめに",
        order: 3,
      },
    ]);
    const result = await layoutLoader({ context: fakeContext } as never);
    const docs = (result as { docs: { slug: string }[] }).docs;
    expect(docs).toHaveLength(1);
    expect(docs[0].slug).toBe("installation");
  });
});

describe("doc loader()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ドキュメントの詳細と markdown を返す", async () => {
    fakeCms.docs.find.mockResolvedValue({
      id: "id-1",
      slug: "quickstart",
      title: "クイックスタート",
      section: "はじめに",
      description: "5 分で始める",
      lastEditedTime: "2024-01-01T00:00:00Z",
      markdown: async () => "# クイックスタート",
    });
    const result = await docLoader({
      params: { slug: "quickstart" },
      context: fakeContext,
    } as never);
    expect((result as { markdown: string }).markdown).toBe(
      "# クイックスタート",
    );
  });

  it("存在しないスラグは例外を投げる", async () => {
    fakeCms.docs.find.mockResolvedValue(null);
    await expect(
      docLoader({
        params: { slug: "not-found" },
        context: fakeContext,
      } as never),
    ).rejects.toBeDefined();
  });
});

describe("warm action()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ウォームアップ結果を JSON で返す", async () => {
    fakeCms.docs.cache.warm.mockResolvedValue({ ok: 3, failed: [] });
    const result = await warmAction({ context: fakeContext } as never);
    const json = await (result as Response).json();
    expect(json).toEqual({ ok: 3, failed: [] });
  });
});
