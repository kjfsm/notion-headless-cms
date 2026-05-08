import type {
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import { renderChildDatabase, renderChildPage } from "../../handlers/child";

const blockBase = {
  object: "block" as const,
  id: "block-id",
  parent: { type: "page_id" as const, page_id: "p" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

describe("renderChildPage", () => {
  it("title と data-page-id を出す", () => {
    const block: ChildPageBlockObjectResponse = {
      ...blockBase,
      type: "child_page",
      child_page: { title: "サンプルページ" },
    };
    const html = renderChildPage(block);
    expect(html).toContain('data-page-id="block-id"');
    expect(html).toContain("サンプルページ");
    expect(html).toContain("nhc-child-page");
  });

  it("title が空なら Untitled になる", () => {
    const block: ChildPageBlockObjectResponse = {
      ...blockBase,
      type: "child_page",
      child_page: { title: "" },
    };
    expect(renderChildPage(block)).toContain("Untitled");
  });
});

describe("renderChildDatabase", () => {
  it("title と data-database-id を出す", () => {
    const block: ChildDatabaseBlockObjectResponse = {
      ...blockBase,
      type: "child_database",
      child_database: { title: "DB タイトル" },
    };
    const html = renderChildDatabase(block);
    expect(html).toContain('data-database-id="block-id"');
    expect(html).toContain("DB タイトル");
    expect(html).toContain("nhc-child-database");
  });
});
