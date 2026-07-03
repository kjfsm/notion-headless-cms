import { describe, expect, it } from "vitest";
import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import type { JsonValue } from "../../types/json-value.js";
import { renderBlocksToHtml, renderRichText } from "../html.js";

// 戻り値を明示的に JsonValue 互換の型として宣言する。関数越しに構築した値は
// 「fresh literal」ではなくなり、TS が index signature の有無を厳密にチェックする
// ため、宣言なしだと NormalizedBlock.data(JsonValue)への代入で型エラーになる。
function richText(
  text: string,
  annotations: Record<string, JsonValue> = {},
  href: string | null = null,
): Record<string, JsonValue> {
  return { type: "text", plain_text: text, href, annotations };
}

describe("renderRichText", () => {
  it("プレーンテキストをエスケープして返す", () => {
    expect(renderRichText([richText("<script>")])).toBe("&lt;script&gt;");
  });

  it("bold/italic/code/strikethrough/underline を入れ子にする", () => {
    const html = renderRichText([
      richText("hi", { bold: true, italic: true, code: true }),
    ]);
    expect(html).toBe("<em><strong><code>hi</code></strong></em>");
  });

  it("href があればリンクにする", () => {
    expect(renderRichText([richText("link", {}, "https://example.com")])).toBe(
      '<a href="https://example.com">link</a>',
    );
  });

  it("配列でなければ空文字", () => {
    expect(renderRichText(undefined)).toBe("");
  });
});

describe("renderBlocksToHtml", () => {
  it("paragraph / heading をタグに変換する", () => {
    const blocks: NormalizedBlock[] = [
      { id: "p1", type: "paragraph", data: { rich_text: [richText("hello")] } },
      { id: "h1", type: "heading_1", data: { rich_text: [richText("Title")] } },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("<p>hello</p><h1>Title</h1>");
  });

  it("連続する bulleted_list_item を <ul> にまとめる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "l1",
        type: "bulleted_list_item",
        data: { rich_text: [richText("a")] },
      },
      {
        id: "l2",
        type: "bulleted_list_item",
        data: { rich_text: [richText("b")] },
      },
      { id: "p1", type: "paragraph", data: { rich_text: [richText("after")] } },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      "<ul><li>a</li><li>b</li></ul><p>after</p>",
    );
  });

  it("numbered_list_item は <ol> にまとめる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "l1",
        type: "numbered_list_item",
        data: { rich_text: [richText("a")] },
      },
      {
        id: "l2",
        type: "numbered_list_item",
        data: { rich_text: [richText("b")] },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("異なるリスト種別の連続はまとめない", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "l1",
        type: "bulleted_list_item",
        data: { rich_text: [richText("a")] },
      },
      {
        id: "l2",
        type: "numbered_list_item",
        data: { rich_text: [richText("b")] },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      "<ul><li>a</li></ul><ol><li>b</li></ol>",
    );
  });

  it("code ブロックは language クラス付きの pre/code になる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "c1",
        type: "code",
        data: { rich_text: [richText("const x = 1;")], language: "typescript" },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      '<pre><code class="language-typescript">const x = 1;</code></pre>',
    );
  });

  it("divider は <hr /> になる", () => {
    expect(renderBlocksToHtml([{ id: "d1", type: "divider", data: {} }])).toBe(
      "<hr />",
    );
  });

  it("to_do は checked 状態を反映する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "t1",
        type: "to_do",
        data: { rich_text: [richText("done")], checked: true },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toContain("checked");
  });

  it("image は img タグに変換する(loading=lazy)", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "i1",
        type: "image",
        data: {
          type: "external",
          external: { url: "/images/abc" },
          caption: [],
        },
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('src="/images/abc"');
    expect(html).toContain('loading="lazy"');
  });

  it("children を再帰的に展開する(toggle)", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "toggle1",
        type: "toggle",
        data: { rich_text: [richText("more")] },
        children: [
          {
            id: "p1",
            type: "paragraph",
            data: { rich_text: [richText("inside")] },
          },
        ],
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toBe(
      "<details><summary>more</summary><p>inside</p></details>",
    );
  });

  it("未対応ブロックは子要素だけ描画する(何も失わない)", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "u1",
        type: "some_future_type",
        data: { type: "unsupported", raw: {} },
        children: [
          {
            id: "p1",
            type: "paragraph",
            data: { rich_text: [richText("kept")] },
          },
        ],
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("<p>kept</p>");
  });
});
