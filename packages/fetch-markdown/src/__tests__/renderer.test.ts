import type { ContentExtension } from "@notion-headless-cms/notion-orm";
import { describe, expect, it } from "vitest";
import { createNotionMarkdownRenderer, notionMarkdownRenderer } from "../index";

describe("notionMarkdownRenderer", () => {
  it("通常の markdown を HTML へ変換する (GFM テーブル含む)", async () => {
    const html = await notionMarkdownRenderer(
      "# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
  });

  it("インライン数式 `$`expr`$` を $expr$ に正規化して KaTeX 互換にする", async () => {
    // remark-math は $expr$ を inlineMath ノードに変換する。
    // 既定パイプラインに rehype-katex は無いため、出力は inlineMath の素朴な hast。
    const html = await notionMarkdownRenderer("文中 $`x^2`$ の式");
    // バックティック付き形式が残っていれば preprocess が機能していない証拠。
    expect(html).not.toContain("$`");
  });

  it("Notion <callout icon color> を nhc-callout div に展開する", async () => {
    const md = '<callout icon="💡" color="blue">注意</callout>\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("nhc-callout");
    expect(html).toContain("nhc-color-blue");
    expect(html).toContain("nhc-callout-icon");
    expect(html).toContain("💡");
  });

  it("</callout> 直後の見出しが heading として変換される (preprocess の空行挿入)", async () => {
    const md = "<callout>x</callout>\n# After\n";
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("<h1>After</h1>");
  });

  it("<columns>/<column> を nhc-columns/nhc-column div に変換する", async () => {
    const md = "<columns>\n<column>\n本文\n</column>\n</columns>\n";
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain('class="nhc-columns"');
    expect(html).toContain('class="nhc-column"');
  });

  it("<span color underline> から color/underline 属性を剥がしクラス化する", async () => {
    const md = '<span color="red" underline="true">hi</span>\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("nhc-color-red");
    expect(html).toContain("nhc-underline");
    expect(html).not.toContain('color="red"');
  });

  it("<mention-page url> を data-mention 属性付き a タグに変換する", async () => {
    const md = '<mention-page url="https://example.com/p">P</mention-page>\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain('href="https://example.com/p"');
    expect(html).toContain('data-mention="page"');
  });

  it("<mention-date start end /> を time タグに変換 (range は from – to を結合)", async () => {
    const md1 = '<mention-date start="2024-01-01"></mention-date>\n';
    const html1 = await notionMarkdownRenderer(md1);
    expect(html1).toContain("<time ");
    expect(html1).toContain('datetime="2024-01-01"');
    expect(html1).toContain("2024-01-01</time>");

    const md2 =
      '<mention-date start="2024-01-01" end="2024-01-31"></mention-date>\n';
    const html2 = await notionMarkdownRenderer(md2);
    expect(html2).toContain("2024-01-01 – 2024-01-31");
  });

  it("<page url> / <database url> を data-link-type 付きリンクへ", async () => {
    const md =
      '<page url="https://p">P</page><database url="https://d">D</database>\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain('data-link-type="page"');
    expect(html).toContain('data-link-type="database"');
    expect(html).toContain('href="https://p"');
    expect(html).toContain('href="https://d"');
  });

  it("<file src> を download 属性付き a タグに変換する", async () => {
    const md = '<file src="https://x/y.pdf">y.pdf</file>\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain('href="https://x/y.pdf"');
    expect(html).toContain('class="nhc-file"');
    expect(html).toContain("download");
  });

  it("</table> 直後の見出しが取り込まれず変換される", async () => {
    const md = "<table><tr><td>1</td></tr></table>\n# After\n";
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("<h1>After</h1>");
  });

  it("<unknown .../> の前後に空行が確保され heading が壊れない", async () => {
    const md = '<unknown type="x"/>\n# After\n';
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("<h1>After</h1>");
  });

  it("未知のハイフン区切りタグには nhc-<tag> クラスのみ付与する", async () => {
    // remark の inline tag は p の中に来る。
    const md = "<custom-tag>x</custom-tag>\n";
    const html = await notionMarkdownRenderer(md);
    expect(html).toContain("nhc-custom-tag");
  });

  it("cacheImage が指定されると image src が返り値で書き換わる", async () => {
    const cacheImage = async (url: string) =>
      `/proxy/${encodeURIComponent(url)}`;
    const html = await notionMarkdownRenderer("![alt](https://img/x.png)", {
      cacheImage,
    });
    expect(html).toContain("/proxy/");
    expect(html).not.toContain("https://img/x.png");
  });

  it("remarkPlugins / rehypePlugins オプションはパイプラインへ追加される", async () => {
    let remarkCalled = false;
    let rehypeCalled = false;
    const remarkNoop = () => () => {
      remarkCalled = true;
    };
    const rehypeNoop = () => () => {
      rehypeCalled = true;
    };
    await notionMarkdownRenderer("# h", {
      remarkPlugins: [remarkNoop],
      rehypePlugins: [rehypeNoop],
    });
    expect(remarkCalled).toBe(true);
    expect(rehypeCalled).toBe(true);
  });
});

describe("createNotionMarkdownRenderer", () => {
  it("ContentExtension の getMarkdownPlugins() を後段プラグインとして注入する", async () => {
    let remarkSeen = false;
    let rehypeSeen = false;
    const ext: ContentExtension = {
      getMarkdownPlugins() {
        return {
          remarkPlugins: [
            () => () => {
              remarkSeen = true;
            },
          ],
          rehypePlugins: [
            () => () => {
              rehypeSeen = true;
            },
          ],
        };
      },
    };
    const renderer = createNotionMarkdownRenderer([ext]);
    await renderer("# h");
    expect(remarkSeen).toBe(true);
    expect(rehypeSeen).toBe(true);
  });

  it("getMarkdownPlugins を実装しない拡張も無害に扱える", async () => {
    const ext: ContentExtension = {};
    const renderer = createNotionMarkdownRenderer([ext]);
    const html = await renderer("# Title");
    expect(html).toContain("<h1>Title</h1>");
  });
});
