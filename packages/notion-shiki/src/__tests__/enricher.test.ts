import type { NotionBlockTreeNode } from "@notion-headless-cms/notion-orm";
import { describe, expect, it } from "vitest";
import { highlightCodeBlocks, notionShiki } from "../index";

function codeBlock(
  id: string,
  text: string,
  language: string,
  caption: string[] = [],
): NotionBlockTreeNode {
  return {
    id,
    type: "code",
    code: {
      rich_text: text.split("\n").map((line) => ({ plain_text: line })),
      caption: caption.map((c) => ({ plain_text: c })),
      language,
    },
  } as unknown as NotionBlockTreeNode;
}

function getCachedHtml(
  block: NotionBlockTreeNode | undefined,
): string | undefined {
  return (block as { code?: { __cachedHtml?: string } } | undefined)?.code
    ?.__cachedHtml;
}

describe("notionShiki", () => {
  it("ContentExtension オブジェクトを返す", () => {
    const ext = notionShiki();
    expect(typeof ext.getMarkdownPlugins).toBe("function");
  });

  it("getMarkdownPlugins が rehypePlugins を含む", () => {
    const plugins = notionShiki().getMarkdownPlugins?.();
    expect(Array.isArray(plugins?.rehypePlugins)).toBe(true);
    expect((plugins?.rehypePlugins ?? []).length).toBeGreaterThan(0);
  });

  it("remarkPlugins は返さない", () => {
    const plugins = notionShiki().getMarkdownPlugins?.();
    expect(plugins?.remarkPlugins).toBeUndefined();
  });
});

describe("highlightCodeBlocks", () => {
  it("code ブロックに公式 rehype-pretty-code 構造の __cachedHtml を埋める", async () => {
    const out = await highlightCodeBlocks([
      codeBlock("c1", "const x = 1;\nconsole.log(x);", "typescript"),
    ]);
    const html = getCachedHtml(out[0]) ?? "";
    expect(html).toContain("data-rehype-pretty-code-figure");
    expect(html).toContain("data-line-numbers");
    expect(html).toContain("data-line");
  });

  it("figcaption（title）は出さない（ファイル名は Code 側で描画）", async () => {
    const out = await highlightCodeBlocks([
      codeBlock("c1", "const x = 1;", "typescript", ["example.ts"]),
    ]);
    const html = getCachedHtml(out[0]) ?? "";
    expect(html).not.toContain("data-rehype-pretty-code-title");
  });

  it("showLineNumbers: false で行番号を出さない", async () => {
    const out = await highlightCodeBlocks(
      [codeBlock("c1", "const x = 1;", "typescript")],
      { showLineNumbers: false },
    );
    const html = getCachedHtml(out[0]) ?? "";
    expect(html).not.toContain("data-line-numbers");
  });

  it("未知言語でも throw せずツリーを返す", async () => {
    const out = await highlightCodeBlocks([
      codeBlock("c1", "echo hi", "totally-unknown-lang"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("入力をミューテートせず、非 code ブロックは素通しする", async () => {
    const input: NotionBlockTreeNode[] = [
      { id: "p1", type: "paragraph" } as unknown as NotionBlockTreeNode,
      codeBlock("c1", "const x = 1;", "typescript"),
    ];
    const out = await highlightCodeBlocks(input);
    expect(getCachedHtml(input[1])).toBeUndefined();
    expect(getCachedHtml(out[1])).toBeDefined();
    expect(out[0]).toBe(input[0]);
  });

  it("children 内の code ブロックも再帰処理する", async () => {
    const parent = {
      id: "t1",
      type: "toggle",
      toggle: { rich_text: [] },
      children: [codeBlock("c1", "const x = 1;", "typescript")],
    } as unknown as NotionBlockTreeNode;
    const out = await highlightCodeBlocks([parent]);
    const child = (out[0] as { children?: NotionBlockTreeNode[] })
      .children?.[0];
    expect(child && getCachedHtml(child)).toBeDefined();
  });
});
