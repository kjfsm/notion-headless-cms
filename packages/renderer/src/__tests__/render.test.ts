import { describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../render";

describe("renderMarkdown", () => {
  it("見出しを HTML に変換する", async () => {
    const result = await renderMarkdown("# Hello\n\nWorld");
    expect(result).toContain("<h1>Hello</h1>");
    expect(result).toContain("<p>World</p>");
  });

  it("GFM の太字を変換する", async () => {
    const result = await renderMarkdown("**Bold**");
    expect(result).toContain("<strong>Bold</strong>");
  });

  it("GFM のリンクを変換する", async () => {
    const result = await renderMarkdown("[link](https://example.com)");
    expect(result).toContain('<a href="https://example.com">link</a>');
  });

  it("GFM のコードブロックを変換する", async () => {
    const result = await renderMarkdown("```\nconst x = 1;\n```");
    expect(result).toContain("<code>");
  });

  it("空文字列でも文字列を返す", async () => {
    const result = await renderMarkdown("");
    expect(typeof result).toBe("string");
  });

  it("カスタム render 関数を使う", async () => {
    const customRender = vi.fn().mockResolvedValue("<custom>HTML</custom>");
    const result = await renderMarkdown("# Test", { render: customRender });
    expect(customRender).toHaveBeenCalledWith(
      "# Test",
      expect.objectContaining({ imageProxyBase: "/api/images" }),
    );
    expect(result).toBe("<custom>HTML</custom>");
  });

  it("デフォルトの imageProxyBase は /api/images", async () => {
    const customRender = vi.fn().mockResolvedValue("");
    await renderMarkdown("", { render: customRender });
    expect(customRender).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ imageProxyBase: "/api/images" }),
    );
  });

  it("imageProxyBase を上書きできる", async () => {
    const customRender = vi.fn().mockResolvedValue("");
    await renderMarkdown("", {
      render: customRender,
      imageProxyBase: "/custom/images",
    });
    expect(customRender).toHaveBeenCalledWith(
      "",
      expect.objectContaining({ imageProxyBase: "/custom/images" }),
    );
  });

  it("cacheImage が未指定の場合はデフォルト関数が渡される", async () => {
    const customRender = vi.fn().mockResolvedValue("");
    await renderMarkdown("", { render: customRender });
    const [, ctx] = customRender.mock.calls[0];
    expect(typeof ctx.cacheImage).toBe("function");
    const url = await ctx.cacheImage("https://example.com/img.png");
    expect(url).toBe("https://example.com/img.png");
  });
});
