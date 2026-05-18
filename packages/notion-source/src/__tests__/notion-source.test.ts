import { describe, expect, it, vi } from "vitest";

vi.mock("@notion-headless-cms/notion-orm", () => ({
  createNotionCollection: vi.fn((opts: unknown) => ({
    name: "notion",
    __opts: opts,
    list: vi.fn(),
    loadMarkdown: vi.fn(),
  })),
}));

import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import { notionSource } from "../index.js";
import type { SchemaMap } from "../schema-types.js";

const schema = {
  posts: {
    dataSourceId: "ds-posts",
    properties: {
      slug: { type: "title", notion: "Slug" },
      body: { type: "richText", notion: "Body" },
      status: { type: "status", notion: "Status" },
    },
    slugField: "slug",
    statusField: "status",
  },
} as const satisfies SchemaMap;

describe("notionSource", () => {
  it("schema を CollectionDef にマップする", () => {
    const adapter = notionSource({
      schema,
      token: "tk",
    });
    expect(adapter.collections.posts.slugField).toBe("slug");
    expect(adapter.collections.posts.statusField).toBe("status");
    expect(adapter.collections.posts.publishedStatuses).toEqual([]);
  });

  it("publishOptions を反映する", () => {
    const adapter = notionSource({
      schema,
      token: "tk",
      publishOptions: {
        posts: {
          publishedStatuses: ["公開済み"],
          accessibleStatuses: ["公開済み", "下書き"],
        },
      },
    });
    expect(adapter.collections.posts.publishedStatuses).toEqual(["公開済み"]);
    expect(adapter.collections.posts.accessibleStatuses).toEqual([
      "公開済み",
      "下書き",
    ]);
  });

  it("blocks / ogp を createNotionCollection に渡す", () => {
    const blocks = {};
    const ogp = { enabled: true } as const;
    notionSource({
      schema,
      token: "tk",
      blocks,
      ogp,
    });
    const lastCall = vi.mocked(createNotionCollection).mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({
      token: "tk",
      dataSourceId: "ds-posts",
      blocks,
      ogp,
    });
  });
});
