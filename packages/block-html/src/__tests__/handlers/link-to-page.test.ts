import type { LinkToPageBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it, vi } from "vitest";
import { renderLinkToPage } from "../../handlers/link-to-page";

const blockBase = {
  object: "block" as const,
  id: "block-id",
  parent: { type: "page_id" as const, page_id: "parent-id" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

describe("renderLinkToPage", () => {
  it("page_id タイプで nhc-link-to-page クラスの <a> を返す", async () => {
    const block: LinkToPageBlockObjectResponse = {
      ...blockBase,
      type: "link_to_page",
      link_to_page: { type: "page_id", page_id: "page-abc" },
    };
    const html = await renderLinkToPage(block);
    expect(html).toContain('class="nhc-link-to-page"');
    expect(html).toContain("📋");
    expect(html).toContain('href="#"');
  });

  it("database_id タイプで 🗄️ アイコンを使う", async () => {
    const block: LinkToPageBlockObjectResponse = {
      ...blockBase,
      type: "link_to_page",
      link_to_page: { type: "database_id", database_id: "db-abc" },
    };
    const html = await renderLinkToPage(block);
    expect(html).toContain("🗄️");
    expect(html).toContain('class="nhc-link-to-page"');
  });

  it("resolvePageTitle が提供された場合はタイトルを表示する", async () => {
    const block: LinkToPageBlockObjectResponse = {
      ...blockBase,
      type: "link_to_page",
      link_to_page: { type: "page_id", page_id: "page-xyz" },
    };
    const resolvePageTitle = vi.fn().mockResolvedValue("テストページ");
    const html = await renderLinkToPage(block, { resolvePageTitle });
    expect(resolvePageTitle).toHaveBeenCalledWith("page-xyz");
    expect(html).toContain("テストページ");
    expect(html).not.toContain("page-xyz");
  });

  it("resolvePageTitle がない場合はページ ID を表示する", async () => {
    const block: LinkToPageBlockObjectResponse = {
      ...blockBase,
      type: "link_to_page",
      link_to_page: { type: "page_id", page_id: "page-fallback" },
    };
    const html = await renderLinkToPage(block);
    expect(html).toContain("page-fallback");
  });

  it("タイトルに含まれる HTML 特殊文字をエスケープする", async () => {
    const block: LinkToPageBlockObjectResponse = {
      ...blockBase,
      type: "link_to_page",
      link_to_page: { type: "page_id", page_id: "page-xss" },
    };
    const resolvePageTitle = vi
      .fn()
      .mockResolvedValue('<script>alert("xss")</script>');
    const html = await renderLinkToPage(block, { resolvePageTitle });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
