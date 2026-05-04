import { describe, expect, it, vi } from "vitest";
import { resolveBlockImageUrls } from "../resolve-image-urls";
import type { NotionBlock } from "../types";

function makeImage(
  url: string,
  type: "file" | "external" = "file",
): NotionBlock {
  return {
    object: "block",
    id: "img-1",
    type: "image",
    image:
      type === "file"
        ? { type: "file", file: { url, expiry_time: "2099" }, caption: [] }
        : { type: "external", external: { url }, caption: [] },
    has_children: false,
  } as unknown as NotionBlock;
}

function makeFile(
  blockType: "video" | "audio" | "file" | "pdf",
  url: string,
  fileType: "file" | "external" = "file",
): NotionBlock {
  const payload =
    fileType === "file"
      ? { type: "file", file: { url, expiry_time: "2099" }, caption: [] }
      : { type: "external", external: { url }, caption: [] };
  return {
    object: "block",
    id: `${blockType}-1`,
    type: blockType,
    [blockType]: payload,
    has_children: false,
  } as unknown as NotionBlock;
}

describe("resolveBlockImageUrls", () => {
  it("cacheImage 未指定なら入力をそのまま返す", async () => {
    const blocks = [makeImage("https://notion.so/img.png")];
    const result = await resolveBlockImageUrls(blocks, undefined);
    expect(result).toBe(blocks);
  });

  it("image (file 型) の URL をプロキシ URL へ書き換える", async () => {
    const cacheImage = vi.fn(async (url: string) => `/api/images/h-${url}`);
    const blocks = [makeImage("https://notion.so/img.png")];
    const result = await resolveBlockImageUrls(blocks, cacheImage);
    expect(cacheImage).toHaveBeenCalledWith("https://notion.so/img.png");
    const out = result[0] as unknown as {
      image: { file?: { url: string }; type: string };
    };
    expect(out.image.type).toBe("file");
    expect(out.image.file?.url).toBe("/api/images/h-https://notion.so/img.png");
  });

  it("external 型の image は書き換えない", async () => {
    const cacheImage = vi.fn(async (url: string) => `/api/images/x-${url}`);
    const blocks = [makeImage("https://example.com/external.png", "external")];
    const result = await resolveBlockImageUrls(blocks, cacheImage);
    expect(cacheImage).not.toHaveBeenCalled();
    expect(result[0]).toBe(blocks[0]);
  });

  it("video / audio / file / pdf の file 型を書き換える", async () => {
    const cacheImage = vi.fn(async (url: string) => `/api/images/h-${url}`);
    const blocks: NotionBlock[] = [
      makeFile("video", "https://notion.so/v.mp4"),
      makeFile("audio", "https://notion.so/a.mp3"),
      makeFile("file", "https://notion.so/f.zip"),
      makeFile("pdf", "https://notion.so/p.pdf"),
    ];
    const result = await resolveBlockImageUrls(blocks, cacheImage);
    expect(cacheImage).toHaveBeenCalledTimes(4);
    for (const [i, key] of (
      ["video", "audio", "file", "pdf"] as const
    ).entries()) {
      const out = result[i] as unknown as Record<
        string,
        { file?: { url: string } }
      >;
      expect(out[key]?.file?.url).toMatch(/^\/api\/images\/h-/);
    }
  });

  it("video の external 型は書き換えない", async () => {
    const cacheImage = vi.fn(async (url: string) => `proxied:${url}`);
    const blocks = [
      makeFile("video", "https://www.youtube.com/watch?v=abc", "external"),
    ];
    const result = await resolveBlockImageUrls(blocks, cacheImage);
    expect(cacheImage).not.toHaveBeenCalled();
    expect(result[0]).toBe(blocks[0]);
  });

  it("children を再帰的に書き換える", async () => {
    const cacheImage = vi.fn(async (url: string) => `proxied:${url}`);
    const child = makeImage("https://notion.so/child.png");
    const parent = {
      object: "block",
      id: "toggle-1",
      type: "toggle",
      toggle: { rich_text: [], color: "default" },
      has_children: true,
      children: [child],
    } as unknown as NotionBlock;
    const result = await resolveBlockImageUrls([parent], cacheImage);
    expect(cacheImage).toHaveBeenCalledWith("https://notion.so/child.png");
    const childOut = (result[0]?.children?.[0] ?? null) as unknown as {
      image: { file?: { url: string } };
    };
    expect(childOut.image.file?.url).toBe(
      "proxied:https://notion.so/child.png",
    );
  });

  it("入力ツリーを破壊しない", async () => {
    const cacheImage = vi.fn(async (url: string) => `proxied:${url}`);
    const original = makeImage("https://notion.so/img.png");
    await resolveBlockImageUrls([original], cacheImage);
    const orig = original as unknown as { image: { file?: { url: string } } };
    expect(orig.image.file?.url).toBe("https://notion.so/img.png");
  });
});
