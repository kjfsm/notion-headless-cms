import { describe, expect, it, vi } from "vitest";
import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import { createKatexTransform } from "../katex.js";

describe("createKatexTransform", () => {
  it("equation ブロックに __cachedHtml を焼き込む(displayMode: true)", async () => {
    const render = vi.fn().mockResolvedValue("<span class='katex-display'/>");
    const transform = createKatexTransform({ render });
    const blocks: NormalizedBlock[] = [
      { id: "eq-1", type: "equation", data: { expression: "x^2" } },
    ];

    const result = await transform.transform(blocks);

    expect(render).toHaveBeenCalledWith("x^2", true);
    expect((result[0]?.data as { __cachedHtml?: string }).__cachedHtml).toBe(
      "<span class='katex-display'/>",
    );
  });

  it("rich_text 内の inline equation item に __cachedHtml を焼き込む(displayMode: false)", async () => {
    const render = vi.fn().mockResolvedValue("<span class='katex-inline'/>");
    const transform = createKatexTransform({ render });
    const blocks: NormalizedBlock[] = [
      {
        id: "p-1",
        type: "paragraph",
        data: {
          rich_text: [{ type: "equation", equation: { expression: "y" } }],
        },
      },
    ];

    const result = await transform.transform(blocks);

    expect(render).toHaveBeenCalledWith("y", false);
    const richText = (
      result[0]?.data as {
        rich_text: { equation: { __cachedHtml?: string } }[];
      }
    ).rich_text;
    expect(richText[0]?.equation.__cachedHtml).toBe(
      "<span class='katex-inline'/>",
    );
  });

  it("caption・table_row cells 等の深部にある inline equation も対象にする", async () => {
    const render = vi.fn().mockResolvedValue("<span/>");
    const transform = createKatexTransform({ render });
    const blocks: NormalizedBlock[] = [
      {
        id: "code-1",
        type: "code",
        data: {
          caption: [{ type: "equation", equation: { expression: "cap" } }],
        },
      },
      {
        id: "row-1",
        type: "table_row",
        data: {
          cells: [[{ type: "equation", equation: { expression: "cell" } }]],
        },
      },
    ];

    await transform.transform(blocks);

    expect(render).toHaveBeenCalledWith("cap", false);
    expect(render).toHaveBeenCalledWith("cell", false);
  });

  it("render が null を返した数式は素通しする(失敗フォールバック)", async () => {
    const render = vi.fn().mockResolvedValue(null);
    const transform = createKatexTransform({ render });
    const blocks: NormalizedBlock[] = [
      { id: "eq-1", type: "equation", data: { expression: "broken" } },
    ];
    const result = await transform.transform(blocks);
    expect(result[0]).toBe(blocks[0]);
  });

  it("既に __cachedHtml がある equation は再組版しない", async () => {
    const render = vi.fn();
    const transform = createKatexTransform({ render });
    const blocks: NormalizedBlock[] = [
      {
        id: "eq-1",
        type: "equation",
        data: { expression: "x", __cachedHtml: "<span/>" },
      },
    ];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    expect(render).not.toHaveBeenCalled();
  });

  it("macros オプションを render に渡せる(既定 render 経由の katex 実レンダリング)", async () => {
    const transform = createKatexTransform();
    const blocks: NormalizedBlock[] = [
      { id: "eq-1", type: "equation", data: { expression: "x^2 + y^2" } },
    ];
    const result = await transform.transform(blocks);
    const html = (result[0]?.data as { __cachedHtml?: string }).__cachedHtml;
    expect(html).toContain("katex-display");
  });

  it("katex 未インストール環境では動的 import が失敗し全ブロックを素通しする", async () => {
    vi.doMock("katex", () => {
      throw new Error("Cannot find module 'katex'");
    });
    const transform = createKatexTransform();
    const blocks: NormalizedBlock[] = [
      { id: "eq-1", type: "equation", data: { expression: "x" } },
    ];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    vi.doUnmock("katex");
  });
});
