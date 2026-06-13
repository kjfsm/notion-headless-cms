import type { CacheAdapter } from "@notion-headless-cms/core";
import type { SchemaMap } from "@notion-headless-cms/notion-source";
import { beforeEach, describe, expect, it, vi } from "vitest";

// core / notion-source / fetcher を全てモックし、createCMS が組み立てる
// createClient / notionSource への引数（配線）だけを検証する。
// vi.mock は巻き上げられるため、参照する spy は vi.hoisted で先に確保する。
const {
  createClientMock,
  nodePresetMock,
  notionSourceMock,
  blocksFetcherMock,
} = vi.hoisted(() => ({
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
  blocksFetcherMock: vi.fn((opts?: Record<string, unknown>) => ({
    kind: "blocks",
    __opts: opts,
  })),
}));

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
  blocksFetcher: blocksFetcherMock,
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
    createCMS({ notion: { schema, token: "t" }, render: { content: "html" } });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "markdown",
    );
    expect(lastCall(createClientMock).renderer).toBeDefined();
  });

  it("react モードは blocksFetcher を選び renderer を渡さない", () => {
    createCMS({ notion: { schema, token: "t" }, render: { content: "react" } });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "blocks",
    );
    expect(lastCall(createClientMock).renderer).toBeUndefined();
  });

  it("react モードは OGP を既定オンで blocksFetcher に渡す", () => {
    createCMS({ notion: { schema, token: "t" }, render: { content: "react" } });
    expect(lastCall(blocksFetcherMock)).toEqual({ ogp: { enabled: true } });
  });

  it("ogp: false で OGP 取得を無効化する", () => {
    createCMS({
      notion: { schema, token: "t" },
      render: { content: "react", ogp: false },
    });
    expect(lastCall(blocksFetcherMock)).toEqual({ ogp: { enabled: false } });
  });

  it("ogp にオブジェクトを渡すとそのまま blocksFetcher へ届く", () => {
    const imageCache = { kind: "r2" } as never;
    createCMS({
      notion: { schema, token: "t" },
      render: { content: "react", ogp: { enabled: true, imageCache } },
    });
    expect(lastCall(blocksFetcherMock)).toEqual({
      ogp: { enabled: true, imageCache },
    });
  });

  it("html モードでは blocksFetcher を呼ばず ogp を無視する", () => {
    createCMS({
      notion: { schema, token: "t" },
      render: { content: "html", ogp: false },
    });
    expect(blocksFetcherMock).not.toHaveBeenCalled();
  });

  it("render/content 省略時は html 既定になる", () => {
    createCMS({ notion: { schema, token: "t" } });
    expect((lastCall(notionSourceMock).fetch as { kind: string }).kind).toBe(
      "markdown",
    );
  });

  it("notion.collections の published/accessible を publishOptions へ写す", () => {
    createCMS({
      notion: {
        schema,
        token: "t",
        collections: {
          posts: {
            published: ["公開済み"],
            accessible: ["下書き", "公開済み"],
          },
        },
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

  it("published のみ指定なら accessibleStatuses は省略される", () => {
    createCMS({
      notion: {
        schema,
        token: "t",
        collections: { posts: { published: ["公開済み"] } },
      },
    });
    expect(
      (lastCall(notionSourceMock).publishOptions as Record<string, unknown>)
        .posts,
    ).toEqual({ publishedStatuses: ["公開済み"] });
  });

  it("accessible のみ指定なら publishedStatuses は省略される", () => {
    createCMS({
      notion: {
        schema,
        token: "t",
        collections: { posts: { accessible: ["下書き", "公開済み"] } },
      },
    });
    expect(
      (lastCall(notionSourceMock).publishOptions as Record<string, unknown>)
        .posts,
    ).toEqual({ accessibleStatuses: ["下書き", "公開済み"] });
  });

  it("token と schema を notionSource にそのまま渡す", () => {
    createCMS({ notion: { schema, token: "secret-token" } });
    expect(lastCall(notionSourceMock).token).toBe("secret-token");
    expect(lastCall(notionSourceMock).schema).toBe(schema);
  });

  it("cache 省略時は nodePreset の cache/swr を使い waitUntil は渡らない", () => {
    createCMS({ notion: { schema, token: "t" } });
    expect(nodePresetMock).toHaveBeenCalledTimes(1);
    const opts = lastCall(createClientMock);
    expect(opts.cache).toEqual(["MEMORY"]);
    expect(opts.swr).toEqual({ ttlMs: 300_000 });
    expect(opts.waitUntil).toBeUndefined();
  });

  it("cache.document/image を document→image の順で配列へ畳む", () => {
    const document = "KV" as unknown as CacheAdapter;
    const image = "R2" as unknown as CacheAdapter;
    createCMS({
      notion: { schema, token: "t" },
      cache: { document, image },
    });
    expect(nodePresetMock).not.toHaveBeenCalled();
    expect(lastCall(createClientMock).cache).toEqual(["KV", "R2"]);
  });

  it("cache.document のみ指定なら image は配列に入らない", () => {
    const document = "KV" as unknown as CacheAdapter;
    createCMS({ notion: { schema, token: "t" }, cache: { document } });
    expect(lastCall(createClientMock).cache).toEqual(["KV"]);
  });

  it("cache 指定時 swr 省略なら 5 分の既定を使う", () => {
    const document = "KV" as unknown as CacheAdapter;
    createCMS({ notion: { schema, token: "t" }, cache: { document } });
    expect(lastCall(createClientMock).swr).toEqual({ ttlMs: 300_000 });
  });

  it("cache.swr/waitUntil を createClient へ渡す", () => {
    const waitUntil = vi.fn();
    const document = "KV" as unknown as CacheAdapter;
    createCMS({
      notion: { schema, token: "t" },
      cache: { document, swr: { ttlMs: 5 }, waitUntil },
    });
    const opts = lastCall(createClientMock);
    expect(opts.swr).toEqual({ ttlMs: 5 });
    expect(opts.waitUntil).toBe(waitUntil);
  });

  it("render.imageProxyBase を指定すると createClient に渡る", () => {
    createCMS({
      notion: { schema, token: "t" },
      render: { imageProxyBase: "/api/cms/images" },
    });
    expect(lastCall(createClientMock).imageProxyBase).toBe("/api/cms/images");
  });
});

// 型レベル検証（実行しない）: content モードで本文アクセサが切り替わり、
// 不整合な呼び出しが型エラーになる（フットガン排除）ことを tsc で保証する。
async function _typeChecks() {
  const html = createCMS({
    notion: { schema, token: "t" },
    render: { content: "html" },
  });
  const htmlPost = await html.posts.find("s");
  if (htmlPost) {
    await htmlPost.html();
    await htmlPost.markdown();
    // @ts-expect-error html モードに notionBlocks は存在しない
    await htmlPost.notionBlocks();
  }

  const react = createCMS({
    notion: { schema, token: "t" },
    render: { content: "react" },
  });
  const reactPost = await react.posts.find("s");
  if (reactPost) {
    const blocks: unknown[] = await reactPost.notionBlocks();
    void blocks;
    // @ts-expect-error react モードに html は存在しない
    await reactPost.html();
  }

  // render 省略時は html 既定。html() が生え、notionBlocks() は型エラーになる。
  const defaulted = createCMS({ notion: { schema, token: "t" } });
  const defaultedPost = await defaulted.posts.find("s");
  if (defaultedPost) {
    await defaultedPost.html();
    // @ts-expect-error 既定（html）モードに notionBlocks は存在しない
    await defaultedPost.notionBlocks();
  }

  // published/accessible は schema の status options で型付けされる
  createCMS({
    notion: {
      schema,
      token: "t",
      collections: {
        posts: { published: ["公開済み"], accessible: ["下書き"] },
      },
    },
  });
  createCMS({
    notion: {
      schema,
      token: "t",
      // @ts-expect-error "存在しない" は status options に無い
      collections: { posts: { published: ["存在しない"] } },
    },
  });
}
void _typeChecks;
