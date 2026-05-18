import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksFetcher } from "../index";

const ctx = { token: "test-token" };

const transformMock = vi.fn(
  async (_client: unknown, pageId: string) => `# md:${pageId}`,
);
const TransformerCtor = vi.fn();

vi.mock("@notion-headless-cms/markdown-html", () => ({
  Transformer: class {
    constructor(cfg?: unknown) {
      TransformerCtor(cfg);
    }
    transform = transformMock;
  },
}));

const fetchBlockTreeMock = vi.fn(
  async (_client: unknown, pageId: string, _opts?: unknown) => [
    { id: `${pageId}-root`, type: "paragraph" } as unknown as { id: string },
  ],
);

vi.mock("@notion-headless-cms/notion-orm", () => ({
  fetchBlockTree: (...args: unknown[]) =>
    fetchBlockTreeMock(...(args as Parameters<typeof fetchBlockTreeMock>)),
}));

describe("blocksFetcher", () => {
  beforeEach(() => {
    transformMock.mockClear();
    TransformerCtor.mockClear();
    fetchBlockTreeMock.mockClear();
  });

  it("kind は 'blocks' で loadNotionBlocks を実装する", () => {
    const f = blocksFetcher();
    expect(f.kind).toBe("blocks");
    expect(typeof f.loadNotionBlocks).toBe("function");
    expect(typeof f.loadMarkdown).toBe("function");
  });

  it("オプションを保持し factory として複数回呼び出せる", () => {
    const a = blocksFetcher({ concurrency: 5 });
    const b = blocksFetcher({ concurrency: 1 });
    expect(a).not.toBe(b);
    expect(a.kind).toBe("blocks");
    expect(b.kind).toBe("blocks");
  });

  it("loadMarkdown は Transformer.transform に委譲する（blocks 未指定時は引数なしで生成）", async () => {
    const f = blocksFetcher();
    const client = {} as never;
    const md = await f.loadMarkdown(client, "page-1", ctx);
    expect(md).toBe("# md:page-1");
    expect(TransformerCtor).toHaveBeenCalledWith(undefined);
    expect(transformMock).toHaveBeenCalledWith(client, "page-1");
  });

  it("loadMarkdown は blocks オプションを Transformer に渡す", async () => {
    const blocks = { custom: (async () => "") as never };
    const f = blocksFetcher({ blocks });
    await f.loadMarkdown({} as never, "page-2", ctx);
    expect(TransformerCtor).toHaveBeenCalledWith({ blocks });
  });

  it("loadNotionBlocks は fetchBlockTree に ogp / concurrency を引き渡す", async () => {
    const ogp = { enabled: true } as never;
    const f = blocksFetcher({ ogp, concurrency: 2 });
    const client = {} as never;
    const tree = await f.loadNotionBlocks?.(client, "page-3", ctx);
    expect(tree).toEqual([{ id: "page-3-root", type: "paragraph" }]);
    expect(fetchBlockTreeMock).toHaveBeenCalledWith(client, "page-3", {
      ogp,
      concurrency: 2,
    });
  });

  it("loadNotionBlocks はオプション未指定なら空オブジェクトを渡す", async () => {
    const f = blocksFetcher();
    await f.loadNotionBlocks?.({} as never, "page-4", ctx);
    expect(fetchBlockTreeMock).toHaveBeenCalledWith({}, "page-4", {});
  });
});
