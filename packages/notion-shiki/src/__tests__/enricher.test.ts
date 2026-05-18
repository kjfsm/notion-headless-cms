import { describe, expect, it } from "vitest";
import { notionShiki } from "../index";

describe("notionShiki", () => {
  it("ContentExtension オブジェクトを返す", () => {
    const ext = notionShiki();
    expect(ext).toBeDefined();
    expect(typeof ext).toBe("object");
    expect(typeof ext.getMarkdownPlugins).toBe("function");
  });

  it("getMarkdownPlugins が rehypePlugins を含む", () => {
    const ext = notionShiki();
    const plugins = ext.getMarkdownPlugins?.();
    expect(plugins).toBeDefined();
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
    expect((plugins?.rehypePlugins ?? []).length).toBeGreaterThan(0);
  });

  it("remarkPlugins は返さない", () => {
    const ext = notionShiki();
    const plugins = ext.getMarkdownPlugins?.();
    expect(plugins?.remarkPlugins).toBeUndefined();
  });

  it("オプションなしで動作する", () => {
    expect(() => notionShiki()).not.toThrow();
  });

  it("theme オプションが反映される", () => {
    const ext = notionShiki({ theme: "github-light" });
    const plugins = ext.getMarkdownPlugins?.();
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
  });

  it("getBlockComponents は実装しない（markdown 戦略専用）", () => {
    const ext = notionShiki();
    expect(ext.getBlockComponents).toBeUndefined();
  });

  it("呼び出しごとに独立したオブジェクトを返す", () => {
    const ext1 = notionShiki({ theme: "github-dark" });
    const ext2 = notionShiki({ theme: "github-light" });
    expect(ext1).not.toBe(ext2);
  });
});
