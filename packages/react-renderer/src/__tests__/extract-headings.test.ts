import { describe, expect, it } from "vitest";
import { extractHeadings } from "../lib/extract-headings";
import type { NotionBlock } from "../types";

const heading = (
  id: string,
  type: "heading_1" | "heading_2" | "heading_3" | "heading_4",
  text: string,
  children?: NotionBlock[],
): NotionBlock =>
  ({
    object: "block",
    id,
    type,
    has_children: (children?.length ?? 0) > 0,
    children,
    [type]: {
      rich_text: [{ plain_text: text }],
      color: "default",
      is_toggleable: false,
    },
  }) as unknown as NotionBlock;

const para = (id: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "paragraph",
    has_children: false,
    paragraph: { rich_text: [], color: "default" },
  }) as unknown as NotionBlock;

describe("extractHeadings", () => {
  it("heading_1..4 を DFS 順で抽出する", () => {
    const blocks: NotionBlock[] = [
      heading("a", "heading_1", "H1"),
      para("p1"),
      heading("b", "heading_2", "H2"),
      heading("c", "heading_3", "H3"),
    ];
    expect(extractHeadings(blocks)).toEqual([
      { id: "a", level: 1, text: "H1" },
      { id: "b", level: 2, text: "H2" },
      { id: "c", level: 3, text: "H3" },
    ]);
  });

  it("ネスト（toggle 配下）も含めて抽出する", () => {
    const blocks: NotionBlock[] = [
      heading("a", "heading_1", "Top", [heading("b", "heading_2", "Inner")]),
    ];
    expect(extractHeadings(blocks).map((h) => h.text)).toEqual([
      "Top",
      "Inner",
    ]);
  });

  it("見出しが無ければ空配列", () => {
    expect(extractHeadings([para("p")])).toEqual([]);
  });
});
