import { describe, expect, it } from "vitest";

import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import { extractPlainText } from "../plain-text.js";

function richText(text: string) {
  return [{ type: "text", plain_text: text, text: { content: text } }];
}

describe("extractPlainText", () => {
  it("paragraph の rich_text から本文を抽出する", () => {
    const blocks: NormalizedBlock[] = [
      { id: "b1", type: "paragraph", data: { rich_text: richText("Hello world") } },
    ];
    expect(extractPlainText(blocks)).toBe("Hello world");
  });

  it("children を再帰的に走査する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "toggle",
        data: { rich_text: richText("見出し") },
        children: [{ id: "b2", type: "paragraph", data: { rich_text: richText("本文") } }],
      },
    ];
    expect(extractPlainText(blocks)).toBe("見出し 本文");
  });

  it("caption・table cell 等ネストした rich_text も拾う", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "image",
        data: { type: "external", external: { url: "https://x" }, caption: richText("画像の説明") },
      },
      {
        id: "b2",
        type: "table_row",
        data: { cells: [richText("セルA"), richText("セルB")] },
      },
    ];
    expect(extractPlainText(blocks)).toBe("画像の説明 セルA セルB");
  });

  it("expression・title・name も可視テキストとして拾う", () => {
    const blocks: NormalizedBlock[] = [
      { id: "b1", type: "equation", data: { expression: "E = mc^2" } },
      { id: "b2", type: "child_page", data: { title: "サブページ" } },
      {
        id: "b3",
        type: "file",
        data: { type: "external", external: { url: "https://x" }, name: "doc.pdf" },
      },
    ];
    expect(extractPlainText(blocks)).toBe("E = mc^2 サブページ doc.pdf");
  });

  it("空文字の plain_text は無視する", () => {
    const blocks: NormalizedBlock[] = [
      { id: "b1", type: "paragraph", data: { rich_text: richText("") } },
    ];
    expect(extractPlainText(blocks)).toBe("");
  });

  it("未対応ブロック(unsupported)の raw からもテキストを拾える", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "unsupported",
        data: {
          type: "unsupported",
          raw: { some_new_type: { rich_text: richText("将来のブロック") } },
        },
      },
    ];
    expect(extractPlainText(blocks)).toBe("将来のブロック");
  });

  it("blocks が空なら空文字を返す", () => {
    expect(extractPlainText([])).toBe("");
  });
});
