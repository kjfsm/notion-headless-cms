import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotionRenderer } from "../NotionRenderer.js";
import type { NotionBlock } from "../types.js";

function richText(text: string) {
  return [
    {
      type: "text",
      plain_text: text,
      href: null,
      text: { content: text, link: null },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    },
  ];
}

function numbered(id: string, text: string, children?: NotionBlock[]): NotionBlock {
  return {
    object: "block",
    id,
    type: "numbered_list_item",
    has_children: (children?.length ?? 0) > 0,
    children,
    numbered_list_item: { rich_text: richText(text), color: "default" },
  } as unknown as NotionBlock;
}

function callout(id: string, text: string, children?: NotionBlock[]): NotionBlock {
  return {
    object: "block",
    id,
    type: "callout",
    has_children: (children?.length ?? 0) > 0,
    children,
    callout: {
      rich_text: richText(text),
      icon: { type: "emoji", emoji: "💡" },
      color: "default",
    },
  } as unknown as NotionBlock;
}

describe("NotionBlocks: listDepth (<ol> style rotation)", () => {
  it("callout 等の非リストコンテナ経由でネストしても <ol> の style はローテートしない", () => {
    const nested = numbered("n1", "nested");
    const block = callout("c1", "wrap", [nested]);
    const { container } = render(<NotionRenderer blocks={[block]} />);
    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    expect(ol?.className).toContain("list-decimal");
    expect(ol?.className).not.toContain("list-[lower-alpha]");
  });

  it("callout を2段ネストしても <ol> の depth は最上位のまま(汎用コンテナはカウントしない)", () => {
    const nested = numbered("n1", "item");
    const inner = callout("c2", "inner-wrap", [nested]);
    const outer = callout("c1", "outer-wrap", [inner]);
    const { container } = render(<NotionRenderer blocks={[outer]} />);
    const ol = container.querySelector("ol");
    expect(ol?.className).toContain("list-decimal");
  });

  it("numbered_list_item の子として本当にネストした <ol> は list-style をローテートする", () => {
    const inner = numbered("n2", "inner");
    const outer = numbered("n1", "outer", [inner]);
    const { container } = render(<NotionRenderer blocks={[outer]} />);
    const ols = container.querySelectorAll("ol");
    expect(ols).toHaveLength(2);
    expect(ols[0]?.className).toContain("list-decimal");
    expect(ols[1]?.className).toContain("list-[lower-alpha]");
  });

  it("3 段ネストした numbered_list_item は decimal → lower-alpha → lower-roman を循環する", () => {
    const depth2 = numbered("n3", "depth2");
    const depth1 = numbered("n2", "depth1", [depth2]);
    const depth0 = numbered("n1", "depth0", [depth1]);
    const { container } = render(<NotionRenderer blocks={[depth0]} />);
    const ols = container.querySelectorAll("ol");
    expect(ols).toHaveLength(3);
    expect(ols[0]?.className).toContain("list-decimal");
    expect(ols[1]?.className).toContain("list-[lower-alpha]");
    expect(ols[2]?.className).toContain("list-[lower-roman]");
  });
});
