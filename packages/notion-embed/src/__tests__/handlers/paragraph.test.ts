import type {
  BulletedListItemBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  QuoteBlockObjectResponse,
  RichTextItemResponse,
  ToDoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import {
  plainText,
  renderBulletedListItem,
  renderHeading1,
  renderHeading2,
  renderHeading3,
  renderNumberedListItem,
  renderParagraph,
  renderQuote,
  renderToDo,
} from "../../handlers/paragraph";

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

const text = (s: string): RichTextItemResponse => ({
  type: "text",
  text: { content: s, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default",
  },
  plain_text: s,
  href: null,
});

describe("renderParagraph", () => {
  it("シンプルな <p> を出す", async () => {
    const block: ParagraphBlockObjectResponse = {
      ...blockBase,
      type: "paragraph",
      paragraph: { rich_text: [text("hello")], color: "default", icon: null },
    };
    expect(await renderParagraph(block)).toBe("<p>hello</p>");
  });

  it("背景色クラスを付ける", async () => {
    const block: ParagraphBlockObjectResponse = {
      ...blockBase,
      type: "paragraph",
      paragraph: {
        rich_text: [text("x")],
        color: "blue_background",
        icon: null,
      },
    };
    const html = await renderParagraph(block);
    expect(html).toContain('class="nhc-color-bg--blue"');
  });
});

describe("renderHeading1/2/3", () => {
  it("h1 を出す", async () => {
    const block: Heading1BlockObjectResponse = {
      ...blockBase,
      type: "heading_1",
      heading_1: {
        rich_text: [text("H1")],
        color: "default",
        is_toggleable: false,
      },
    };
    expect(await renderHeading1(block)).toBe("<h1>H1</h1>");
  });

  it("h2 を出す", async () => {
    const block: Heading2BlockObjectResponse = {
      ...blockBase,
      type: "heading_2",
      heading_2: {
        rich_text: [text("H2")],
        color: "default",
        is_toggleable: false,
      },
    };
    expect(await renderHeading2(block)).toBe("<h2>H2</h2>");
  });

  it("h3 を出す", async () => {
    const block: Heading3BlockObjectResponse = {
      ...blockBase,
      type: "heading_3",
      heading_3: {
        rich_text: [text("H3")],
        color: "default",
        is_toggleable: false,
      },
    };
    expect(await renderHeading3(block)).toBe("<h3>H3</h3>");
  });
});

describe("renderBulletedListItem / renderNumberedListItem", () => {
  it("<li> を出す (bulleted)", async () => {
    const block: BulletedListItemBlockObjectResponse = {
      ...blockBase,
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [text("a")], color: "default" },
    };
    expect(await renderBulletedListItem(block)).toBe("<li>a</li>");
  });

  it("<li> を出す (numbered)", async () => {
    const block: NumberedListItemBlockObjectResponse = {
      ...blockBase,
      type: "numbered_list_item",
      numbered_list_item: { rich_text: [text("b")], color: "default" },
    };
    expect(await renderNumberedListItem(block)).toBe("<li>b</li>");
  });
});

describe("renderQuote", () => {
  it('<blockquote class="nhc-quote"> を出す', async () => {
    const block: QuoteBlockObjectResponse = {
      ...blockBase,
      type: "quote",
      quote: { rich_text: [text("名言")], color: "default" },
    };
    const html = await renderQuote(block);
    expect(html).toContain('class="nhc-quote"');
    expect(html).toContain("名言");
  });
});

describe("renderToDo", () => {
  it("未チェック", async () => {
    const block: ToDoBlockObjectResponse = {
      ...blockBase,
      type: "to_do",
      to_do: { rich_text: [text("やる")], checked: false, color: "default" },
    };
    const html = await renderToDo(block);
    expect(html).toContain('<input type="checkbox" disabled />');
    expect(html).not.toContain("nhc-todo--checked");
  });

  it("チェック済み", async () => {
    const block: ToDoBlockObjectResponse = {
      ...blockBase,
      type: "to_do",
      to_do: { rich_text: [text("済")], checked: true, color: "default" },
    };
    const html = await renderToDo(block);
    expect(html).toContain("checked");
    expect(html).toContain("nhc-todo--checked");
  });
});

describe("plainText", () => {
  it("rich_text を plain_text で連結する", () => {
    expect(plainText([text("a"), text("b"), text("c")])).toBe("abc");
  });

  it("空配列は空文字", () => {
    expect(plainText([])).toBe("");
  });
});
