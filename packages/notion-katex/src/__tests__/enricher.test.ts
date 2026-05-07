import { describe, expect, it } from "vitest";
import type { NotionKatexOptions } from "../index";
import { notionKatex } from "../index";

// テスト用の最小ブロック型
type MinimalBlock = {
  object: "block";
  id: string;
  type: string;
  has_children: boolean;
  children?: MinimalBlock[];
  equation?: { expression: string; __cachedHtml?: string };
};

const makeEquationBlock = (expression: string, id = "eq-1"): MinimalBlock => ({
  object: "block",
  id,
  type: "equation",
  has_children: false,
  equation: { expression },
});

const makeParagraphBlock = (id = "para-1"): MinimalBlock => ({
  object: "block",
  id,
  type: "paragraph",
  has_children: false,
});

describe("notionKatex", () => {
  it("equation ブロックに __cachedHtml を付与する", async () => {
    const enricher = notionKatex();
    const blocks = [makeEquationBlock("E = mc^2")];
    const result = await enricher(blocks as never);

    const eq = (result[0] as MinimalBlock).equation;
    expect(eq?.__cachedHtml).toBeDefined();
    expect(typeof eq?.__cachedHtml).toBe("string");
    expect(eq?.__cachedHtml?.length).toBeGreaterThan(0);
  });

  it("出力 HTML に katex クラスが含まれる", async () => {
    const enricher = notionKatex();
    const blocks = [makeEquationBlock("x^2 + y^2 = z^2")];
    const result = await enricher(blocks as never);

    const html = (result[0] as MinimalBlock).equation?.__cachedHtml ?? "";
    expect(html).toContain("katex");
  });

  it("equation 以外のブロックは変更しない", async () => {
    const enricher = notionKatex();
    const blocks = [makeParagraphBlock()];
    const result = await enricher(blocks as never);

    expect(result[0]).not.toHaveProperty("equation");
  });

  it("子ブロックを再帰的に処理する", async () => {
    const enricher = notionKatex();
    const child = makeEquationBlock("\\alpha + \\beta", "eq-child");
    const parent: MinimalBlock = {
      object: "block",
      id: "toggle-1",
      type: "toggle",
      has_children: true,
      children: [child],
    };
    const result = await enricher([parent] as never);

    const childResult = (result[0] as MinimalBlock)
      .children?.[0] as MinimalBlock;
    expect(childResult?.equation?.__cachedHtml).toBeDefined();
  });

  it("displayMode: false でインライン数式をレンダリングする", async () => {
    const opts: NotionKatexOptions = { displayMode: false };
    const enricher = notionKatex(opts);
    const blocks = [makeEquationBlock("E=mc^2")];
    const result = await enricher(blocks as never);

    const html = (result[0] as MinimalBlock).equation?.__cachedHtml ?? "";
    // display mode でない場合、span ベースのインライン要素になる
    expect(html).toContain("katex");
  });

  it("macros オプションが適用される", async () => {
    const opts: NotionKatexOptions = {
      macros: { "\\RR": "\\mathbb{R}" },
    };
    const enricher = notionKatex(opts);
    const blocks = [makeEquationBlock("\\RR")];
    // macros が適用されてもエラーにならない
    const result = await enricher(blocks as never);
    const eq = (result[0] as MinimalBlock).equation;
    expect(eq?.__cachedHtml).toBeDefined();
  });

  it("不正な LaTeX はエラーを投げずに __cachedHtml を設定しない", async () => {
    const enricher = notionKatex({ throwOnError: false });
    // 不正な LaTeX 文字列
    const blocks = [makeEquationBlock("\\invalid{{{")];
    // throwOnError: false なのでエラーにならない
    await expect(enricher(blocks as never)).resolves.toBeDefined();
  });

  it("元のブロック配列を返す（同一参照）", async () => {
    const enricher = notionKatex();
    const blocks = [makeEquationBlock("a = b")];
    const result = await enricher(blocks as never);
    expect(result).toBe(blocks);
  });
});
