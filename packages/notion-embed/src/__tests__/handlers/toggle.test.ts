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
  it("<details><summary> を出す", async () => {
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
    expect(html).toContain('<details class="nhc-toggle">');
    expect(html).toContain('class="nhc-toggle__summary"');
    expect(html).toContain("詳細");
    expect(html).toContain("</details>");
  });
});
