import { describe, expect, it } from "vitest";
import { markdownToBlocks } from "../internal/md-to-blocks";

describe("markdownToBlocks", () => {
  describe("基本ブロック", () => {
    it("空文字列は空配列を返す", () => {
      expect(markdownToBlocks("")).toEqual([]);
    });

    it("空行のみの文字列は空配列を返す", () => {
      expect(markdownToBlocks("\n\n\n")).toEqual([]);
    });

    it("# 見出し → heading block (level=1)", () => {
      const blocks = markdownToBlocks("# Hello");
      expect(blocks).toEqual([
        {
          type: "heading",
          level: 1,
          children: [{ type: "text", value: "Hello" }],
        },
      ]);
    });

    it("## 見出し → heading block (level=2)", () => {
      const blocks = markdownToBlocks("## Subheading");
      expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
    });

    it("### 見出し → heading block (level=3)", () => {
      const blocks = markdownToBlocks("### Deep");
      expect(blocks[0]).toMatchObject({ type: "heading", level: 3 });
    });

    it("段落 → paragraph block", () => {
      const blocks = markdownToBlocks("Hello World");
      expect(blocks).toEqual([
        {
          type: "paragraph",
          children: [{ type: "text", value: "Hello World" }],
        },
      ]);
    });

    it("--- → divider block", () => {
      expect(markdownToBlocks("---")).toEqual([{ type: "divider" }]);
    });

    it("*** → divider block", () => {
      expect(markdownToBlocks("***")).toEqual([{ type: "divider" }]);
    });

    it("___ → divider block", () => {
      expect(markdownToBlocks("___")).toEqual([{ type: "divider" }]);
    });

    it("---- (4文字) → divider block", () => {
      expect(markdownToBlocks("----")).toEqual([{ type: "divider" }]);
    });

    it("画像 → image block", () => {
      const blocks = markdownToBlocks(
        "![alt text](https://example.com/img.png)",
      );
      expect(blocks).toEqual([
        {
          type: "image",
          alt: "alt text",
          src: "https://example.com/img.png",
        },
      ]);
    });

    it("alt なし画像 → alt が空文字", () => {
      const blocks = markdownToBlocks("![](https://example.com/img.png)");
      expect(blocks[0]).toMatchObject({ type: "image", alt: "" });
    });

    it("引用 → quote block（再帰的に children を持つ）", () => {
      const blocks = markdownToBlocks("> quote text");
      expect(blocks[0]).toMatchObject({ type: "quote" });
      const quote = blocks[0] as { type: "quote"; children: unknown[] };
      expect(quote.children).toBeDefined();
    });

    it("複数行引用 → 一つの quote block になる", () => {
      const blocks = markdownToBlocks("> line1\n> line2");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({ type: "quote" });
    });
  });

  describe("リスト", () => {
    it("- リスト → unordered list block", () => {
      const blocks = markdownToBlocks("- item1\n- item2");
      expect(blocks).toEqual([
        {
          type: "list",
          ordered: false,
          items: [
            [
              {
                type: "paragraph",
                children: [{ type: "text", value: "item1" }],
              },
            ],
            [
              {
                type: "paragraph",
                children: [{ type: "text", value: "item2" }],
              },
            ],
          ],
        },
      ]);
    });

    it("* リスト → unordered list block", () => {
      const blocks = markdownToBlocks("* item");
      expect(blocks[0]).toMatchObject({ type: "list", ordered: false });
    });

    it("+ リスト → unordered list block", () => {
      const blocks = markdownToBlocks("+ item");
      expect(blocks[0]).toMatchObject({ type: "list", ordered: false });
    });

    it("1. リスト → ordered list block", () => {
      const blocks = markdownToBlocks("1. first\n2. second");
      expect(blocks[0]).toMatchObject({ type: "list", ordered: true });
    });
  });

  describe("コードブロック", () => {
    it("言語指定ありコードブロック → lang が設定される", () => {
      const blocks = markdownToBlocks("```ts\nconst x = 1;\n```");
      expect(blocks).toEqual([
        {
          type: "code",
          lang: "ts",
          value: "const x = 1;",
        },
      ]);
    });

    it("言語指定なしコードブロック → lang が undefined", () => {
      const blocks = markdownToBlocks("```\ncode here\n```");
      expect(blocks[0]).toMatchObject({ type: "code", lang: undefined });
    });

    it("複数行コードブロック → 全行が value に含まれる", () => {
      const blocks = markdownToBlocks("```\nline1\nline2\nline3\n```");
      const code = blocks[0] as { type: "code"; value: string };
      expect(code.value).toBe("line1\nline2\nline3");
    });

    it("閉じのないコードブロックでもクラッシュしない", () => {
      const blocks = markdownToBlocks("```ts\nconst x = 1;");
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toMatchObject({ type: "code" });
    });
  });

  describe("インラインパース", () => {
    it("**bold** → bold: true の text node", () => {
      const blocks = markdownToBlocks("**bold text**");
      expect(blocks[0]).toMatchObject({
        type: "paragraph",
        children: expect.arrayContaining([
          { type: "text", value: "bold text", bold: true },
        ]),
      });
    });

    it("*italic* → italic: true の text node", () => {
      const blocks = markdownToBlocks("*italic*");
      expect(blocks[0]).toMatchObject({
        type: "paragraph",
        children: expect.arrayContaining([
          { type: "text", value: "italic", italic: true },
        ]),
      });
    });

    it("`code` → code: true の text node", () => {
      const blocks = markdownToBlocks("`inline code`");
      expect(blocks[0]).toMatchObject({
        type: "paragraph",
        children: expect.arrayContaining([
          { type: "text", value: "inline code", code: true },
        ]),
      });
    });

    it("[link](url) → link node", () => {
      const blocks = markdownToBlocks("[click](https://example.com)");
      expect(blocks[0]).toMatchObject({
        type: "paragraph",
        children: expect.arrayContaining([
          {
            type: "link",
            url: "https://example.com",
            children: expect.any(Array),
          },
        ]),
      });
    });

    it("プレーンテキストはそのまま text node になる", () => {
      const blocks = markdownToBlocks("plain text");
      const para = blocks[0] as { children: { type: string; value: string }[] };
      expect(para.children.some((n) => n.type === "text")).toBe(true);
    });
  });

  describe("インラインパース - エッジケース", () => {
    it("閉じのない [ は plain text として扱われる", () => {
      const blocks = markdownToBlocks("text [no close");
      expect(blocks).toHaveLength(1);
      const para = blocks[0] as { children: { type: string; value: string }[] };
      expect(para.children.some((n) => n.type === "text")).toBe(true);
    });

    it("[ と ] はあるが ( がない場合は plain text として扱われる", () => {
      const blocks = markdownToBlocks("[text] not link");
      expect(blocks).toHaveLength(1);
    });

    it("[ ] ( はあるが ) がない場合は plain text として扱われる", () => {
      const blocks = markdownToBlocks("[text](no-close");
      expect(blocks).toHaveLength(1);
    });

    it("閉じのない ` は plain text として扱われる", () => {
      const blocks = markdownToBlocks("text ` no close");
      expect(blocks).toHaveLength(1);
    });

    it("閉じのない * は plain text として扱われる", () => {
      const blocks = markdownToBlocks("text * lone star");
      expect(blocks).toHaveLength(1);
    });
  });

  describe("改行・空行処理", () => {
    it("空行はスキップする", () => {
      const blocks = markdownToBlocks("\n\nHello\n\n");
      expect(blocks).toHaveLength(1);
    });

    it("CRLF 改行も正しく処理する", () => {
      const blocks = markdownToBlocks("line1\r\n\r\nline2");
      expect(blocks).toHaveLength(2);
    });

    it("複数ブロックが正しい順序で返る", () => {
      const md = "# Title\n\nparagraph\n\n---";
      const blocks = markdownToBlocks(md);
      expect(blocks[0]).toMatchObject({ type: "heading" });
      expect(blocks[1]).toMatchObject({ type: "paragraph" });
      expect(blocks[2]).toMatchObject({ type: "divider" });
    });
  });
});
