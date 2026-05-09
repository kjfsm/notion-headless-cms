import { describe, expect, it } from "vitest";
import type { NotionShikiOptions } from "../index";
import { notionShiki } from "../index";

type MinimalBlock = {
  object: "block";
  id: string;
  type: string;
  has_children: boolean;
  children?: MinimalBlock[];
  code?: {
    rich_text: Array<{ plain_text: string }>;
    language: string;
    __cachedHtml?: string;
  };
};

const makeCodeBlock = (
  source: string,
  language = "typescript",
  id = "code-1",
): MinimalBlock => ({
  object: "block",
  id,
  type: "code",
  has_children: false,
  code: { rich_text: [{ plain_text: source }], language },
});

const makeParagraphBlock = (id = "para-1"): MinimalBlock => ({
  object: "block",
  id,
  type: "paragraph",
  has_children: false,
});

describe("notionShiki", () => {
  it("code ブロックに __cachedHtml を付与する", async () => {
    const enricher = notionShiki();
    const blocks = [makeCodeBlock("const x = 1;")];
    const result = await enricher(blocks as never);

    const code = (result[0] as MinimalBlock).code;
    expect(code?.__cachedHtml).toBeDefined();
    expect(typeof code?.__cachedHtml).toBe("string");
    expect(code?.__cachedHtml?.length).toBeGreaterThan(0);
  });

  it("出力 HTML に shiki のクラスが含まれる", async () => {
    const enricher = notionShiki();
    const blocks = [makeCodeBlock("print('hello')", "python")];
    const result = await enricher(blocks as never);

    const html = (result[0] as MinimalBlock).code?.__cachedHtml ?? "";
    expect(html).toContain("shiki");
  });

  it("code 以外のブロックは変更しない", async () => {
    const enricher = notionShiki();
    const blocks = [makeParagraphBlock()];
    const result = await enricher(blocks as never);

    expect(result[0]).not.toHaveProperty("code");
  });

  it("子ブロックを再帰的に処理する", async () => {
    const enricher = notionShiki();
    const child = makeCodeBlock("let y = 2;", "javascript", "code-child");
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
    expect(childResult?.code?.__cachedHtml).toBeDefined();
  });

  it("theme オプションが適用される", async () => {
    const opts: NotionShikiOptions = { theme: "github-light" };
    const enricher = notionShiki(opts);
    const blocks = [makeCodeBlock("x = 1", "python")];
    const result = await enricher(blocks as never);

    const html = (result[0] as MinimalBlock).code?.__cachedHtml ?? "";
    expect(html.length).toBeGreaterThan(0);
  });

  it("サポート外の言語は fallbackLang にフォールバックする", async () => {
    const enricher = notionShiki({ fallbackLang: "text" });
    const blocks = [makeCodeBlock("some code", "unknown_language_xyz")];
    await expect(enricher(blocks as never)).resolves.toBeDefined();
  });

  it("plain text 言語は text にマップされる", async () => {
    const enricher = notionShiki();
    const blocks = [makeCodeBlock("just plain text", "plain text")];
    const result = await enricher(blocks as never);

    const code = (result[0] as MinimalBlock).code;
    expect(code?.__cachedHtml).toBeDefined();
  });

  it("language が空文字列の場合は fallbackLang を使う", async () => {
    const enricher = notionShiki({ fallbackLang: "text" });
    const block: MinimalBlock = {
      object: "block",
      id: "code-no-lang",
      type: "code",
      has_children: false,
      code: { rich_text: [{ plain_text: "hello world" }], language: "" },
    };
    const result = await enricher([block] as never);
    const code = (result[0] as MinimalBlock).code;
    expect(code?.__cachedHtml).toBeDefined();
  });

  it("language が undefined の場合も fallbackLang を使う", async () => {
    const enricher = notionShiki({ fallbackLang: "text" });
    const block = {
      object: "block",
      id: "code-undef-lang",
      type: "code",
      has_children: false,
      code: {
        rich_text: [{ plain_text: "hello" }],
        language: undefined as unknown as string,
      },
    };
    const result = await enricher([block] as never);
    const code = (result[0] as typeof block).code;
    expect((code as { __cachedHtml?: string }).__cachedHtml).toBeDefined();
  });

  it("元のブロック配列を返す（同一参照）", async () => {
    const enricher = notionShiki();
    const blocks = [makeCodeBlock("const a = 1;")];
    const result = await enricher(blocks as never);
    expect(result).toBe(blocks);
  });
});
