import type {
  TableBlockObjectResponse,
  TableRowBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderTable, renderTableRow } from "../../handlers/table";

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

describe("renderTable", () => {
  it("基本クラスのみの空 table", () => {
    const block: TableBlockObjectResponse = {
      ...blockBase,
      type: "table",
      table: {
        table_width: 2,
        has_column_header: false,
        has_row_header: false,
      },
    };
    expect(renderTable(block)).toBe('<table class="nhc-table"></table>');
  });

  it("ヘッダ指定があるとモディファイアクラスが付く", () => {
    const block: TableBlockObjectResponse = {
      ...blockBase,
      type: "table",
      table: {
        table_width: 2,
        has_column_header: true,
        has_row_header: true,
      },
    };
    const html = renderTable(block);
    expect(html).toContain("nhc-table--col-header");
    expect(html).toContain("nhc-table--row-header");
  });
});

describe("renderTableRow", () => {
  it("各セルを <td> に展開する", async () => {
    const block: TableRowBlockObjectResponse = {
      ...blockBase,
      type: "table_row",
      table_row: { cells: [[text("a")], [text("b")], [text("c")]] },
    };
    const html = await renderTableRow(block);
    expect(html).toBe("<tr><td>a</td><td>b</td><td>c</td></tr>");
  });

  it("空セル配列でも <tr></tr> を返す", async () => {
    const block: TableRowBlockObjectResponse = {
      ...blockBase,
      type: "table_row",
      table_row: { cells: [] },
    };
    const html = await renderTableRow(block);
    expect(html).toBe("<tr></tr>");
  });
});
