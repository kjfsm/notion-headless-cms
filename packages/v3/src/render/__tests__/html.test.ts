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

  it("code の __cachedHtml があればそれを優先描画する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "c1",
        type: "code",
        data: {
          rich_text: [richText("const x = 1;")],
          language: "typescript",
          __cachedHtml: '<pre class="shiki">cached</pre>',
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe('<pre class="shiki">cached</pre>');
  });

  it("equation ブロックは __cachedHtml が無ければ $$...$$ フォールバックにする", () => {
    const blocks: NormalizedBlock[] = [
      { id: "e1", type: "equation", data: { expression: "x^2" } },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      '<div class="nhc-equation">$$x^2$$</div>',
    );
  });

  it("equation ブロックの __cachedHtml があればそれを優先描画する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "e1",
        type: "equation",
        data: { expression: "x^2", __cachedHtml: "<span>katex</span>" },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("<span>katex</span>");
  });

  it("inline equation は rich_text 内で $...$ フォールバックになる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        data: {
          rich_text: [
            {
              type: "equation",
              equation: { expression: "y" },
              plain_text: "y",
            },
          ],
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      '<p><span class="nhc-equation-inline">$y$</span></p>',
    );
  });

  it("inline equation の __cachedHtml があればそれを優先描画する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        data: {
          rich_text: [
            {
              type: "equation",
              equation: {
                expression: "y",
                __cachedHtml: "<span>katex-inline</span>",
              },
              plain_text: "y",
            },
          ],
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("<p><span>katex-inline</span></p>");
  });

  it("table/table_row を <table>/<tr>/<td> に変換する(has_column_header)", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "t1",
        type: "table",
        data: { has_column_header: true, has_row_header: false },
        children: [
          {
            id: "r1",
            type: "table_row",
            data: { cells: [[richText("a")], [richText("b")]] },
          },
        ],
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toBe(
      '<table class="nhc-table nhc-table--col-header"><tr><td>a</td><td>b</td></tr></table>',
    );
  });

  it("column_list/column を width_ratio 付き <div> に変換する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "cl1",
        type: "column_list",
        data: {},
        children: [
          {
            id: "col1",
            type: "column",
            data: { width_ratio: 0.5 },
            children: [
              {
                id: "p1",
                type: "paragraph",
                data: { rich_text: [richText("x")] },
              },
            ],
          },
        ],
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toBe(
      '<div class="nhc-column-list"><div class="nhc-column" style="flex:0.5000"><p>x</p></div></div>',
    );
  });

  it("synced_block は透過ラッパーとして children を展開する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "s1",
        type: "synced_block",
        data: { synced_from: null },
        children: [
          { id: "p1", type: "paragraph", data: { rich_text: [richText("x")] } },
        ],
      },
    ];
    expect(renderBlocksToHtml(blocks)).toBe(
      '<div class="nhc-synced-block nhc-synced-block--original"><p>x</p></div>',
    );
  });

  it("child_page/child_database をタイトル付きリンクに変換する", () => {
    const blocks: NormalizedBlock[] = [
      { id: "cp1", type: "child_page", data: { title: "サブページ" } },
      { id: "cd1", type: "child_database", data: { title: "サブDB" } },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain("nhc-child-page");
    expect(html).toContain("サブページ");
    expect(html).toContain("nhc-child-database");
    expect(html).toContain("サブDB");
  });

  it("link_to_page は links オプションで解決した href/title を使う", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "l1",
        type: "link_to_page",
        data: { type: "page_id", page_id: "AAAA-BBBB" },
      },
    ];
    const html = renderBlocksToHtml(blocks, {
      links: { aaaabbbb: { href: "/posts/hello", title: "Hello" } },
    });
    expect(html).toContain('href="/posts/hello"');
    expect(html).toContain("Hello");
  });

  it("link_to_page が解決できなければ # とページIDにフォールバックする", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "l1",
        type: "link_to_page",
        data: { type: "page_id", page_id: "unknown-id" },
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('href="#"');
    expect(html).toContain("unknown-id");
  });

  it("bookmark/link_preview は OGP シェル(data-nhc-ogp-url 付き)を返し fetch しない", () => {
    const blocks: NormalizedBlock[] = [
      { id: "b1", type: "bookmark", data: { url: "https://example.com" } },
      {
        id: "lp1",
        type: "link_preview",
        data: { url: "https://example.com/preview" },
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain('data-nhc-ogp-url="https://example.com"');
    expect(html).toContain('data-nhc-ogp-url="https://example.com/preview"');
  });

  it("embed は allowedEmbedHosts が無ければ OGP シェルにフォールバックする", () => {
    const blocks: NormalizedBlock[] = [
      { id: "em1", type: "embed", data: { url: "https://player.vimeo.com/x" } },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain("nhc-embed-block");
    expect(html).not.toContain("<iframe");
  });

  it("embed は allowedEmbedHosts に一致すれば iframe を直接埋め込む", () => {
    const blocks: NormalizedBlock[] = [
      { id: "em1", type: "embed", data: { url: "https://player.vimeo.com/x" } },
    ];
    const html = renderBlocksToHtml(blocks, {
      allowedEmbedHosts: ["vimeo.com"],
    });
    expect(html).toContain("<iframe");
    expect(html).toContain('src="https://player.vimeo.com/x"');
  });

  it("embed の YouTube URL は allowlist が無くても iframe になる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "em1",
        type: "embed",
        data: { url: "https://www.youtube.com/watch?v=abc12345678" },
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain("youtube.com/embed/abc12345678");
  });

  it("video(直接メディア)は <video> タグになる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "v1",
        type: "video",
        data: {
          type: "external",
          external: { url: "https://example.com/a.mp4" },
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toContain("<video");
  });

  it("audio は <audio> タグになる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "a1",
        type: "audio",
        data: {
          type: "external",
          external: { url: "https://example.com/a.mp3" },
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toContain("<audio");
  });

  it("file は名前付きダウンロードリンクになる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "f1",
        type: "file",
        data: {
          type: "external",
          external: { url: "https://example.com/a.pdf" },
          name: "資料.pdf",
        },
      },
    ];
    const html = renderBlocksToHtml(blocks);
    expect(html).toContain("nhc-file");
    expect(html).toContain("資料.pdf");
  });

  it("pdf は iframe/OGP シェルのいずれかで埋め込まれる", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "p1",
        type: "pdf",
        data: {
          type: "external",
          external: { url: "https://example.com/a.pdf" },
        },
      },
    ];
    expect(renderBlocksToHtml(blocks)).toContain("nhc-pdf");
  });

  it("breadcrumb/table_of_contents は children だけを描画する", () => {
    const blocks: NormalizedBlock[] = [
      { id: "bc1", type: "breadcrumb", data: {} },
      { id: "toc1", type: "table_of_contents", data: { color: "default" } },
    ];
    expect(renderBlocksToHtml(blocks)).toBe("");
  });
});
