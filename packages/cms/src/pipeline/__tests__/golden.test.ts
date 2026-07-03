import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, it } from "vitest";
import { prop } from "../../types/property.js";
import type { FetchedBlock } from "../blocks.js";
import { normalizeBlockTree } from "../blocks.js";
import {
  extractImageRefs,
  imageCacheKeySource,
  parseImageDimensions,
  sha256Hex,
} from "../images.js";
import { normalizePageId, resolvePageLinks } from "../links.js";
import { mapProperties } from "../properties.js";

const COMMON_BLOCK_FIELDS = {
  object: "block" as const,
  created_time: "2026-01-01T00:00:00.000Z",
  created_by: { object: "user" as const, id: "user_1" },
  last_edited_time: "2026-01-01T00:00:00.000Z",
  last_edited_by: { object: "user" as const, id: "user_1" },
  parent: { type: "page_id" as const, page_id: "page_1" },
  archived: false,
  in_trash: false,
  has_children: false,
};

function block(overrides: Record<string, unknown>): FetchedBlock {
  return { ...COMMON_BLOCK_FIELDS, ...overrides } as unknown as FetchedBlock;
}

describe("golden: properties.mapProperties", () => {
  const properties = {
    title: prop.title(),
    status: prop.status(["draft", "published"] as const),
    tags: prop.multiSelect(),
    views: prop.number(),
    featured: prop.checkbox(),
  };

  const rawProperties = {
    title: {
      id: "title",
      type: "title",
      title: [{ type: "text", plain_text: "Hello World" }],
    },
    status: {
      id: "s1",
      type: "status",
      status: { id: "st1", name: "published", color: "green" },
    },
    tags: {
      id: "t1",
      type: "multi_select",
      multi_select: [
        { id: "a", name: "tech", color: "blue" },
        { id: "b", name: "life", color: "red" },
      ],
    },
    views: { id: "v1", type: "number", number: 42 },
    featured: { id: "f1", type: "checkbox", checkbox: true },
  } as unknown as PageObjectResponse["properties"];

  it("プロパティを PropDef の kind に従って変換する", () => {
    const result = mapProperties(properties, rawProperties);
    expect(result).toEqual({
      title: "Hello World",
      status: "published",
      tags: ["tech", "life"],
      views: 42,
      featured: true,
    });
  });

  it("kind と一致しない raw.type は unsupported になる", () => {
    const mismatched = {
      title: { id: "title", type: "rich_text", rich_text: [] },
    } as unknown as PageObjectResponse["properties"];
    const result = mapProperties({ title: prop.title() }, mismatched);
    expect(result.title).toEqual({
      type: "unsupported",
      raw: mismatched.title,
    });
  });
});

describe("golden: blocks.normalizeBlockTree", () => {
  it("全ブロック種を正規化し、children を再帰的に保持する", () => {
    const tree = [
      block({
        id: "b1",
        type: "paragraph",
        has_children: true,
        paragraph: {
          rich_text: [{ type: "text", plain_text: "hi" }],
          color: "default",
        },
        children: [
          block({
            id: "b2",
            type: "image",
            image: {
              type: "external",
              external: { url: "https://example.com/a.png" },
              caption: [],
            },
          }),
        ],
      }),
      block({ id: "b3", type: "some_future_block_type" }),
    ];

    const result = normalizeBlockTree(tree);
    expect(result[0]?.id).toBe("b1");
    expect(result[0]?.type).toBe("paragraph");
    expect(result[0]?.children?.[0]?.id).toBe("b2");
    expect(result[1]?.data).toEqual({
      type: "unsupported",
      raw: expect.objectContaining({ id: "b3" }),
    });
  });
});

describe("golden: images", () => {
  it("imageCacheKeySource が Notion 署名ホストのクエリだけを落とす", () => {
    const signed =
      "https://prod-files-secure.s3.us-west-2.amazonaws.com/abc/def.png?X-Amz-Signature=xyz";
    expect(imageCacheKeySource(signed)).toBe(
      "https://prod-files-secure.s3.us-west-2.amazonaws.com/abc/def.png",
    );
    const external = "https://images.unsplash.com/photo?w=800";
    expect(imageCacheKeySource(external)).toBe(external);
  });

  it("同じキー源から常に同じハッシュが得られる", async () => {
    const a = await sha256Hex("https://example.com/a.png");
    const b = await sha256Hex("https://example.com/a.png");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("extractImageRefs が image/file ブロックの URL を抽出する", async () => {
    const tree = normalizeBlockTree([
      block({
        id: "img1",
        type: "image",
        image: {
          type: "external",
          external: { url: "https://example.com/a.png" },
          caption: [],
        },
      }),
      block({
        id: "p1",
        type: "paragraph",
        paragraph: { rich_text: [], color: "default" },
      }),
    ]);
    const refs = await extractImageRefs(tree);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.blockId).toBe("img1");
    expect(refs[0]?.url).toBe("https://example.com/a.png");
    expect(refs[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("PNG ヘッダから width/height を読む", () => {
    // 1x1 PNG (base64 デコード済みバイト列)。
    const base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dims = parseImageDimensions(bytes);
    expect(dims).toEqual({ width: 1, height: 1, contentType: "image/png" });
  });

  it("非対応フォーマットは width/height が null になる", () => {
    const dims = parseImageDimensions(new Uint8Array([1, 2, 3, 4]));
    expect(dims).toEqual({ width: null, height: null, contentType: null });
  });
});

describe("golden: links.resolvePageLinks", () => {
  it("link_to_page ブロックとインライン mention の両方を解決する", () => {
    const targetId = "11111111-1111-1111-1111-111111111111";
    const pageIndex = {
      [normalizePageId(targetId)]: {
        collection: "posts",
        slug: "hello",
        title: "Hello",
      },
    };
    const tree = normalizeBlockTree([
      block({
        id: "l1",
        type: "link_to_page",
        link_to_page: { type: "page_id", page_id: targetId },
      }),
      block({
        id: "p1",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "mention",
              plain_text: "Hello",
              mention: { type: "page", page: { id: targetId } },
            },
          ],
          color: "default",
        },
      }),
    ]);
    const links = resolvePageLinks(tree, pageIndex);
    expect(links[normalizePageId(targetId)]).toEqual({
      href: "/posts/hello",
      title: "Hello",
    });
  });

  it("pageIndex に無いリンクは解決結果に現れない", () => {
    const tree = normalizeBlockTree([
      block({
        id: "l1",
        type: "link_to_page",
        link_to_page: { type: "page_id", page_id: "unknown-page" },
      }),
    ]);
    const links = resolvePageLinks(tree, {});
    expect(Object.keys(links)).toHaveLength(0);
  });
});
