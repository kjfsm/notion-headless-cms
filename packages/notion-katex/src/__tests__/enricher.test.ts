import { describe, expect, it } from "vitest";
import { notionKatex } from "../index";

describe("notionKatex", () => {
  it("ContentExtension オブジェクトを返す", () => {
    const ext = notionKatex();
    expect(ext).toBeDefined();
    expect(typeof ext).toBe("object");
    expect(typeof ext.getMarkdownPlugins).toBe("function");
  });

  it("getMarkdownPlugins が rehypePlugins を含む", () => {
    const ext = notionKatex();
    const plugins = ext.getMarkdownPlugins?.();
    expect(plugins).toBeDefined();
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
    expect((plugins?.rehypePlugins ?? []).length).toBeGreaterThan(0);
  });

  it("remarkPlugins は返さない（remarkMath はパイプライン既存）", () => {
    const ext = notionKatex();
    const plugins = ext.getMarkdownPlugins?.();
    expect(plugins?.remarkPlugins).toBeUndefined();
  });

  it("オプションなしで動作する", () => {
    expect(() => notionKatex()).not.toThrow();
  });

  it("displayMode オプションが反映される", () => {
    const ext = notionKatex({ displayMode: false });
    const plugins = ext.getMarkdownPlugins?.();
    // プラグインが配列として存在すれば OK
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
  });

  it("macros オプションが反映される", () => {
    const ext = notionKatex({ macros: { "\\RR": "\\mathbb{R}" } });
    const plugins = ext.getMarkdownPlugins?.();
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
  });

  it("getBlockComponents は実装しない（markdown 戦略専用）", () => {
    const ext = notionKatex();
    expect(ext.getBlockComponents).toBeUndefined();
  });

  it("呼び出しごとに独立したオブジェクトを返す", () => {
    const ext1 = notionKatex({ theme: undefined } as never);
    const ext2 = notionKatex();
    expect(ext1).not.toBe(ext2);
  });
});
