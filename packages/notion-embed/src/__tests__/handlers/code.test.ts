import type {
  CodeBlockObjectResponse,
  EquationBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderCode, renderEquation } from "../../handlers/code";

const blockBase = {
  object: "block" as const,
  id: "id",
  parent: { type: "page_id" as const, page_id: "p" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

const text = (s: string) => ({
  type: "text" as const,
  text: { content: s, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default" as const,
  },
  plain_text: s,
  href: null,
});

describe("renderCode", () => {
  it("language クラス付きの <pre><code> を出す", async () => {
    const block: CodeBlockObjectResponse = {
      ...blockBase,
      type: "code",
      code: {
        rich_text: [text("const x = 1;")],
        caption: [],
        language: "typescript",
      },
    };
    const html = await renderCode(block);
    expect(html).toContain('<pre><code class="language-typescript">');
    expect(html).toContain("const x = 1;");
  });

  it("HTML 特殊文字をエスケープする", async () => {
    const block: CodeBlockObjectResponse = {
      ...blockBase,
      type: "code",
      code: {
        rich_text: [text("<script>alert(1)</script>")],
        caption: [],
        language: "html",
      },
    };
    const html = await renderCode(block);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("caption があれば figcaption を出す", async () => {
    const block: CodeBlockObjectResponse = {
      ...blockBase,
      type: "code",
      code: {
        rich_text: [text("a")],
        caption: [text("注釈")],
        language: "plain text",
      },
    };
    const html = await renderCode(block);
    expect(html).toContain('class="nhc-code__caption"');
    expect(html).toContain("注釈");
  });
});

describe("renderEquation", () => {
  it("$$...$$ で囲んだ div を出す", () => {
    const block: EquationBlockObjectResponse = {
      ...blockBase,
      type: "equation",
      equation: { expression: "E = mc^2" },
    };
    const html = renderEquation(block);
    expect(html).toContain('class="nhc-equation"');
    expect(html).toContain("$$E = mc^2$$");
  });

  it("HTML 特殊文字をエスケープする", () => {
    const block: EquationBlockObjectResponse = {
      ...blockBase,
      type: "equation",
      equation: { expression: "a < b > c" },
    };
    const html = renderEquation(block);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;");
  });
});
