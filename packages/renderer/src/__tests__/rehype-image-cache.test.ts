import { describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../render";

describe("rehypeImageCache プラグイン", () => {
  it("cacheImage が未指定の場合は img src を変換しない", async () => {
    const result = await renderMarkdown("![test](https://example.com/img.png)");
    expect(result).toContain('src="https://example.com/img.png"');
  });

  it("cacheImage が指定された場合は img src をプロキシ URL に変換する", async () => {
    const cacheImage = vi.fn().mockResolvedValue("/api/images/abc123");
    const result = await renderMarkdown(
      "![test](https://example.com/img.png)",
      { cacheImage },
    );
    expect(result).toContain('src="/api/images/abc123"');
    expect(cacheImage).toHaveBeenCalledWith("https://example.com/img.png");
  });

  it("同一 URL の img が複数ある場合は cacheImage を一度だけ呼ぶ", async () => {
    const cacheImage = vi.fn().mockResolvedValue("/api/images/dedup");
    const md = [
      "![a](https://example.com/same.png)",
      "",
      "![b](https://example.com/same.png)",
    ].join("\n");
    await renderMarkdown(md, { cacheImage });
    expect(cacheImage).toHaveBeenCalledTimes(1);
  });

  it("複数の異なる URL が並んでいる場合はそれぞれ cacheImage を呼ぶ", async () => {
    const cacheImage = vi
      .fn()
      .mockResolvedValueOnce("/api/images/hash1")
      .mockResolvedValueOnce("/api/images/hash2");
    const md = [
      "![a](https://example.com/img1.png)",
      "",
      "![b](https://example.com/img2.png)",
    ].join("\n");
    const result = await renderMarkdown(md, { cacheImage });
    expect(cacheImage).toHaveBeenCalledTimes(2);
    expect(result).toContain("/api/images/hash1");
    expect(result).toContain("/api/images/hash2");
  });

  it("http で始まらない src は cacheImage を呼ばずそのまま残す", async () => {
    const cacheImage = vi.fn().mockResolvedValue("/proxy/foo");
    const result = await renderMarkdown("![local](/local/image.png)", {
      cacheImage,
    });
    expect(cacheImage).not.toHaveBeenCalled();
    expect(result).toContain('src="/local/image.png"');
  });

  it("img 要素がない場合は cacheImage を呼ばない", async () => {
    const cacheImage = vi.fn().mockResolvedValue("/proxy/unused");
    await renderMarkdown("no images here", { cacheImage });
    expect(cacheImage).not.toHaveBeenCalled();
  });

  it("cacheImage を渡した場合でも変換後の HTML に alt が保持される", async () => {
    const cacheImage = vi.fn().mockResolvedValue("/api/images/abc");
    const result = await renderMarkdown(
      "![my alt text](https://example.com/img.png)",
      { cacheImage },
    );
    expect(result).toContain('alt="my alt text"');
  });
});
