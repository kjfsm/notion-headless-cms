import type { CacheAdapter } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

// core / notion-source / fetcher を全てモックし、createCMS が組み立てる
// createClient / notionSource への引数（配線）だけを検証する。
// vi.mock は巻き上げられるため、参照する spy は vi.hoisted で先に確保する。
const { createClientMock, nodePresetMock, notionSourceMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn((opts: Record<string, unknown>) => ({
      __opts: opts,
    })),
    nodePresetMock: vi.fn(() => ({
      cache: ["MEMORY"],
      swr: { ttlMs: 300_000 },
    })),
    notionSourceMock: vi.fn((cfg: Record<string, unknown>) => ({
      collections: {},
      __cfg: cfg,
    })),
  }),
);

vi.mock("@notion-headless-cms/core", () => ({
  createClient: createClientMock,
  nodePreset: nodePresetMock,
}));
vi.mock("@notion-headless-cms/notion-source", () => ({
  notionSource: notionSourceMock,
}));
vi.mock("@notion-headless-cms/fetch-markdown", () => ({
  markdownFetcher: () => ({ kind: "markdown" }),
  notionMarkdownRenderer: vi.fn(),
}));
vi.mock("@notion-headless-cms/fetch-blocks", () => ({
  blocksFetcher: () => ({ kind: "blocks" }),
}));

import { createCMS } from "../index";

const schema = {
  posts: {
    dataSourceId: "ds_1",
    properties: {
      slug: { type: "richText", notion: "URL" },
      status: {
        type: "status",
        notion: "ステータス",
        options: ["下書き", "公開済み"],
      },
    },
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;

const lastCall = (mock: { mock: { calls: unknown[][] } }) =>
  mock.mock.calls.at(-1)?.[0] as Record<string, unknown>;

describe("createCMS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("html モードは markdownFetcher を選び renderer を結線する", () => {
    createCMS({ schema, token: "t", content: "html" });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "markdown",
    );
    expect(lastCall(createClientMock).renderer).toBeDefined();
  });

  it("react モードは blocksFetcher を選び renderer を渡さない", () => {
    createCMS({ schema, token: "t", content: "react" });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "blocks",
    );
    expect(lastCall(createClientMock).renderer).toBeUndefined();
  });

  it("content 省略時は html 既定になる", () => {
    createCMS({ schema, token: "t" });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "markdown",
    );
  });

  it("collections の published/accessible を publishOptions へ写す", () => {
    createCMS({
      schema,
      token: "t",
      collections: {
        posts: { published: ["公開済み"], accessible: ["下書き", "公開済み"] },
      },
    });
    expect(
      (lastCall(notionSourceMock).publishOptions as Record<string, unknown>)
        .posts,
    ).toEqual({
      publishedStatuses: ["公開済み"],
      accessibleStatuses: ["下書き", "公開済み"],
    });
  });

  it("token と schema を notionSource にそのまま渡す", () => {
    createCMS({ schema, token: "secret-token" });
    expect(lastCall(notionSourceMock).token).toBe("secret-token");
    expect(lastCall(notionSourceMock).schema).toBe(schema);
  });

  it("runtime 省略時は nodePreset の cache/swr を使う", () => {
    createCMS({ schema, token: "t" });
    expect(nodePresetMock).toHaveBeenCalledTimes(1);
    expect(lastCall(createClientMock).cache).toEqual(["MEMORY"]);
    expect(lastCall(createClientMock).swr).toEqual({ ttlMs: 300_000 });
  });

  it("runtime 指定時はその cache/swr/waitUntil を使い nodePreset を呼ばない", () => {
    const waitUntil = vi.fn();
    const cache = ["KV"] as unknown as readonly CacheAdapter[];
    createCMS({
      schema,
      token: "t",
      runtime: { cache, swr: { ttlMs: 5 }, waitUntil },
    });
    expect(nodePresetMock).not.toHaveBeenCalled();
    const opts = lastCall(createClientMock);
    expect(opts.cache).toEqual(["KV"]);
    expect(opts.swr).toEqual({ ttlMs: 5 });
    expect(opts.waitUntil).toBe(waitUntil);
  });

  it("imageProxyBase を指定すると createClient に渡る", () => {
    createCMS({ schema, token: "t", imageProxyBase: "/api/cms/images" });
    expect(lastCall(createClientMock).imageProxyBase).toBe("/api/cms/images");
  });
});

// 型レベル検証（実行しない）: content モードで本文アクセサが切り替わり、
// 不整合な呼び出しが型エラーになる（フットガン排除）ことを tsc で保証する。
async function _typeChecks() {
  const html = createCMS({ schema, token: "t", content: "html" });
  const htmlPost = await html.posts.find("s");
  if (htmlPost) {
    await htmlPost.html();
    await htmlPost.markdown();
    // @ts-expect-error html モードに notionBlocks は存在しない
    await htmlPost.notionBlocks();
  }

  const react = createCMS({ schema, token: "t", content: "react" });
  const reactPost = await react.posts.find("s");
  if (reactPost) {
    const blocks: unknown[] = await reactPost.notionBlocks();
    void blocks;
    // @ts-expect-error react モードに html は存在しない
    await reactPost.html();
  }

  // published/accessible は schema の status options で型付けされる
  createCMS({
    schema,
    token: "t",
    collections: { posts: { published: ["公開済み"], accessible: ["下書き"] } },
  });
  createCMS({
    schema,
    token: "t",
    // @ts-expect-error "存在しない" は status options に無い
    collections: { posts: { published: ["存在しない"] } },
  });
}
void _typeChecks;
