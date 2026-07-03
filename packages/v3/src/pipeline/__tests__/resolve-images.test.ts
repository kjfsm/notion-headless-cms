import { describe, expect, it } from "vitest";
import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import { imageCacheKeySource, sha256Hex } from "../images.js";
import { resolveImageUrls } from "../resolve-images.js";

describe("resolveImageUrls", () => {
  it("image ブロックの file/external url を {imagesPath}/{hash} に書き換える", async () => {
    const url = "https://example.com/a.png";
    const hash = await sha256Hex(imageCacheKeySource(url));
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "image",
        data: { type: "external", external: { url }, caption: [] },
      },
    ];
    const resolved = await resolveImageUrls(
      blocks,
      { [hash]: { hash, width: 100, height: 50, contentType: "image/png" } },
      "/images",
    );
    const data = resolved[0]?.data as {
      external: { url: string };
      _dimensions: { width: number; height: number };
    };
    expect(data.external.url).toBe(`/images/${hash}`);
    expect(data._dimensions).toEqual({ width: 100, height: 50 });
  });

  it("images マップに無いハッシュは寸法無しで URL だけ書き換える", async () => {
    const url = "https://example.com/unknown.png";
    const hash = await sha256Hex(imageCacheKeySource(url));
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "image",
        data: { type: "external", external: { url }, caption: [] },
      },
    ];
    const resolved = await resolveImageUrls(blocks, {}, "/images");
    const data = resolved[0]?.data as {
      external: { url: string };
      _dimensions?: unknown;
    };
    expect(data.external.url).toBe(`/images/${hash}`);
    expect(data._dimensions).toBeUndefined();
  });

  it("image 以外の file 系ブロック(video 等)は寸法を付与しない", async () => {
    const url = "https://example.com/a.mp4";
    const hash = await sha256Hex(imageCacheKeySource(url));
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "video",
        data: { type: "external", external: { url }, caption: [] },
      },
    ];
    const resolved = await resolveImageUrls(
      blocks,
      { [hash]: { hash, width: 10, height: 10, contentType: "video/mp4" } },
      "/images",
    );
    const data = resolved[0]?.data as {
      external: { url: string };
      _dimensions?: unknown;
    };
    expect(data.external.url).toBe(`/images/${hash}`);
    expect(data._dimensions).toBeUndefined();
  });

  it("file 参照を持たないブロックはそのまま", async () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        data: { rich_text: [], color: "default" },
      },
    ];
    const resolved = await resolveImageUrls(blocks, {});
    expect(resolved[0]).toEqual(blocks[0]);
  });

  it("children を再帰的に解決する", async () => {
    const url = "https://example.com/a.png";
    const hash = await sha256Hex(imageCacheKeySource(url));
    const blocks: NormalizedBlock[] = [
      {
        id: "parent",
        type: "column",
        data: {},
        children: [
          {
            id: "child",
            type: "image",
            data: { type: "external", external: { url }, caption: [] },
          },
        ],
      },
    ];
    const resolved = await resolveImageUrls(blocks, {
      [hash]: { hash, width: 1, height: 1, contentType: "image/png" },
    });
    const childData = resolved[0]?.children?.[0]?.data as {
      external: { url: string };
    };
    expect(childData.external.url).toBe(`/images/${hash}`);
  });
});
