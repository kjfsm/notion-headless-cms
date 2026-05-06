import type {
  BreadcrumbBlockObjectResponse,
  DividerBlockObjectResponse,
  TabBlockObjectResponse,
  TableOfContentsBlockObjectResponse,
  UnsupportedBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it } from "vitest";
import {
  renderBreadcrumb,
  renderDivider,
  renderTab,
  renderTableOfContents,
  renderUnsupported,
} from "../../handlers/structural";

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

describe("renderDivider", () => {
  it("<hr> を出す", () => {
    const block: DividerBlockObjectResponse = {
      ...blockBase,
      type: "divider",
      divider: {},
    };
    expect(renderDivider(block)).toBe('<hr class="nhc-divider" />');
  });
});

describe("renderBreadcrumb", () => {
  it("空の breadcrumb nav を出す", () => {
    const block: BreadcrumbBlockObjectResponse = {
      ...blockBase,
      type: "breadcrumb",
      breadcrumb: {},
    };
    const html = renderBreadcrumb(block);
    expect(html).toContain('class="nhc-breadcrumb"');
    expect(html).toContain('aria-label="breadcrumb"');
  });
});

describe("renderTableOfContents", () => {
  it("デフォルト色なら基本クラスのみ", () => {
    const block: TableOfContentsBlockObjectResponse = {
      ...blockBase,
      type: "table_of_contents",
      table_of_contents: { color: "default" },
    };
    const html = renderTableOfContents(block);
    expect(html).toContain('class="nhc-toc"');
  });

  it("背景色なら nhc-color-bg-- クラスを追加する", () => {
    const block: TableOfContentsBlockObjectResponse = {
      ...blockBase,
      type: "table_of_contents",
      table_of_contents: { color: "blue_background" },
    };
    const html = renderTableOfContents(block);
    expect(html).toContain("nhc-color-bg--blue");
  });

  it("文字色なら nhc-color-- クラスを追加する", () => {
    const block: TableOfContentsBlockObjectResponse = {
      ...blockBase,
      type: "table_of_contents",
      table_of_contents: { color: "red" },
    };
    const html = renderTableOfContents(block);
    expect(html).toContain("nhc-color--red");
  });
});

describe("renderTab", () => {
  it("空の tab div を出す", () => {
    const block: TabBlockObjectResponse = {
      ...blockBase,
      type: "tab",
      tab: {},
    };
    expect(renderTab(block)).toBe('<div class="nhc-tab"></div>');
  });
});

describe("renderUnsupported", () => {
  it("コメントとして block_type を残す", () => {
    const block: UnsupportedBlockObjectResponse = {
      ...blockBase,
      type: "unsupported",
      unsupported: { block_type: "future_block" },
    };
    expect(renderUnsupported(block)).toBe(
      "<!-- nhc:unsupported future_block -->",
    );
  });
});
