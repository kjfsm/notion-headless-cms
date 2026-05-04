import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotionRenderer } from "../NotionRenderer";
import type { NotionBlock } from "../types";

const para = (id: string, text: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "paragraph",
    has_children: false,
    paragraph: {
      rich_text: [
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
      ],
      color: "default",
    },
  }) as unknown as NotionBlock;

const bullet = (id: string, text: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "bulleted_list_item",
    has_children: false,
    bulleted_list_item: {
      rich_text: [
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
      ],
      color: "default",
    },
  }) as unknown as NotionBlock;

describe("NotionRenderer", () => {
  it("paragraph を描画する", () => {
    const { container } = render(
      <NotionRenderer blocks={[para("p1", "hello")]} />,
    );
    expect(container.textContent).toContain("hello");
  });

  it("連続する bulleted_list_item を 1 つの ul にまとめる", () => {
    const { container } = render(
      <NotionRenderer blocks={[bullet("a", "one"), bullet("b", "two")]} />,
    );
    const uls = container.querySelectorAll("ul");
    expect(uls).toHaveLength(1);
    expect(uls[0]?.querySelectorAll("li")).toHaveLength(2);
  });

  it("段落を間に挟むと ul は分割される", () => {
    const { container } = render(
      <NotionRenderer
        blocks={[bullet("a", "one"), para("p", "x"), bullet("b", "two")]}
      />,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("未対応 block type は Unsupported に落ちる", () => {
    const unsupported = {
      object: "block",
      id: "u1",
      type: "unknown_future_block",
      has_children: false,
    } as unknown as NotionBlock;
    const { container } = render(<NotionRenderer blocks={[unsupported]} />);
    expect(container.textContent).toContain("Unsupported");
  });
});
