import type { ToggleBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderToggle } from "../../handlers/toggle";

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

describe("renderToggle", () => {
  it("サマリーの rich text HTML を返す（<details> は含まない）", async () => {
    const block: ToggleBlockObjectResponse = {
      ...blockBase,
      type: "toggle",
      toggle: {
        color: "default",
        rich_text: [
          {
            type: "text",
            text: { content: "詳細", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "詳細",
            href: null,
          },
        ],
      },
    };
    const html = await renderToggle(block);
    // notion-to-md が md.toggle(summary, children) で <details> を生成するため
    // ハンドラーは summary 部分のみを返す
    expect(html).not.toContain("<details");
    expect(html).not.toContain("</details>");
    expect(html).toContain("詳細");
  });

  it("bold アノテーションが <strong> として出力される", async () => {
    const block: ToggleBlockObjectResponse = {
      ...blockBase,
      type: "toggle",
      toggle: {
        color: "default",
        rich_text: [
          {
            type: "text",
            text: { content: "太字", link: null },
            annotations: {
              bold: true,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "太字",
            href: null,
          },
        ],
      },
    };
    const html = await renderToggle(block);
    expect(html).toContain("<strong>");
    expect(html).toContain("太字");
  });
});
