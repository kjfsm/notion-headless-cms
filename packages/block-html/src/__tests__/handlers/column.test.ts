import type {
  ColumnBlockObjectResponse,
  ColumnListBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderColumn, renderColumnList } from "../../handlers/column";

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

describe("renderColumnList", () => {
  it("空の column-list div を出す", () => {
    const block: ColumnListBlockObjectResponse = {
      ...blockBase,
      type: "column_list",
      column_list: {},
    };
    expect(renderColumnList(block)).toBe('<div class="nhc-column-list"></div>');
  });
});

describe("renderColumn", () => {
  it("width_ratio が無いと style 属性無し", () => {
    const block: ColumnBlockObjectResponse = {
      ...blockBase,
      type: "column",
      column: {},
    };
    expect(renderColumn(block)).toBe('<div class="nhc-column"></div>');
  });

  it("width_ratio があれば flex を付ける", () => {
    const block: ColumnBlockObjectResponse = {
      ...blockBase,
      type: "column",
      column: { width_ratio: 0.3333 },
    };
    const html = renderColumn(block);
    expect(html).toContain('style="flex:0.3333"');
  });
});
